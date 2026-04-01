'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { getCurrentUser, verifyCandidateAccess } from '@/api/utils/auth';
import { getCandidateById } from '@/api/queries/candidates';
import {
  validateRequired,
  validateUUID,
  validateFutureDate,
  validateNumberRange,
  validateNonEmptyArray,
  validateEmail,
} from '@/api/utils/validation';
import { withErrorHandling } from '@/api/utils/errors';
import { Database } from '@/lib/supabase/types';
import {
  getBusyTimes,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  getEventAttendeesStatus,
  refreshAccessTokenIfNeeded,
  watchCalendarEvent,
  stopCalendarEventWatch,
} from '@/lib/calendar/google';
import { findAvailableTimeSlots } from '@/lib/ai/schedule';
import { sendEmailViaGmail, generateScheduleSelectionUrl } from '@/lib/email/gmail';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale/ko';
import { toZonedTime } from 'date-fns-tz';
import { extendDateRangeByWeek, shouldExtendDateRange, getDateRangeForRetry } from '@/api/utils/schedule-date-range';
import { getStageNameByStageId } from '@/constants/stages';
import { randomUUID } from 'crypto';
import { google } from 'googleapis';
import { upsertScheduleAutomationTimeline } from '@/api/actions/timeline';

type ScheduleInsert = Database['public']['Tables']['schedules']['Insert'];
type ScheduleUpdate = Database['public']['Tables']['schedules']['Update'];

type ExcludedTimeRange = {
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
};

type AllowedTimeRange = ExcludedTimeRange;

// KST 타임존 상수 (타임라인/이력/메일 표기 통일용)
const KST_TIMEZONE = 'Asia/Seoul';

/**
 * 서버 타임존(UTC 등)과 상관없이 KST 기준으로 시간을 포맷합니다.
 */
function formatInKst(dateLike: string | Date, fmt: string) {
  const date = typeof dateLike === 'string' ? new Date(dateLike) : dateLike;
  const kstDate = toZonedTime(date, KST_TIMEZONE);
  return format(kstDate, fmt, { locale: ko });
}

function readExternalInterviewerEmails(formData: FormData): string[] {
  const raw = formData.get('external_interviewer_emails');
  if (!raw) return [];

  const parsed = JSON.parse(String(raw));
  if (!Array.isArray(parsed)) return [];

  const deduped = new Set<string>();
  for (const value of parsed) {
    if (typeof value !== 'string') continue;
    const email = validateEmail(value.trim().toLowerCase());
    deduped.add(email);
  }

  return Array.from(deduped);
}

function readExcludedTimeRangesFromFormData(formData: FormData): ExcludedTimeRange[] {
  // 새 업무시간/점심 입력이 오면 이를 우선 사용하여 "허용 구간 밖"을 제외 구간으로 변환
  const workStartHour = formData.get('work_start_hour');
  const workStartMinute = formData.get('work_start_minute');
  const workEndHour = formData.get('work_end_hour');
  const workEndMinute = formData.get('work_end_minute');
  const lunchStartHour = formData.get('lunch_start_hour');
  const lunchStartMinute = formData.get('lunch_start_minute');
  const lunchEndHour = formData.get('lunch_end_hour');
  const lunchEndMinute = formData.get('lunch_end_minute');

  const hasWorkInputs =
    workStartHour !== null &&
    workStartMinute !== null &&
    workEndHour !== null &&
    workEndMinute !== null &&
    lunchStartHour !== null &&
    lunchStartMinute !== null &&
    lunchEndHour !== null &&
    lunchEndMinute !== null;

  if (hasWorkInputs) {
    const wsH = Number(workStartHour);
    const wsM = Number(workStartMinute);
    const weH = Number(workEndHour);
    const weM = Number(workEndMinute);
    const lsH = Number(lunchStartHour);
    const lsM = Number(lunchStartMinute);
    const leH = Number(lunchEndHour);
    const leM = Number(lunchEndMinute);

    const valid = (...nums: number[]) => nums.every(n => Number.isFinite(n));
    const inRange = (h: number, m: number) =>
      h >= 0 && h <= 23 && m >= 0 && m <= 59;
    const toMin = (h: number, m: number) => h * 60 + m;

    if (
      valid(wsH, wsM, weH, weM, lsH, lsM, leH, leM) &&
      inRange(wsH, wsM) &&
      inRange(weH, weM) &&
      inRange(lsH, lsM) &&
      inRange(leH, leM) &&
      toMin(wsH, wsM) < toMin(weH, weM) &&
      toMin(lsH, lsM) < toMin(leH, leM)
    ) {
      const ranges: ExcludedTimeRange[] = [];
      // 00:00 ~ 업무 시작
      ranges.push({ startHour: 0, startMinute: 0, endHour: wsH, endMinute: wsM });
      // 점심 시간
      ranges.push({ startHour: lsH, startMinute: lsM, endHour: leH, endMinute: leM });
      // 업무 종료 ~ 24:00
      ranges.push({ startHour: weH, startMinute: weM, endHour: 23, endMinute: 59 });
      return ranges;
    }
    // 유효성 실패 시 아래의 구(기존) 단일 제외 파라미터 해석으로 폴백
  }

  const startHourRaw = formData.get('exclude_start_hour');
  const startMinuteRaw = formData.get('exclude_start_minute');
  const endHourRaw = formData.get('exclude_end_hour');
  const endMinuteRaw = formData.get('exclude_end_minute');

  if (
    startHourRaw === null ||
    startMinuteRaw === null ||
    endHourRaw === null ||
    endMinuteRaw === null
  ) {
    return [];
  }

  const startHour = Number(startHourRaw);
  const startMinute = Number(startMinuteRaw);
  const endHour = Number(endHourRaw);
  const endMinute = Number(endMinuteRaw);

  if (
    Number.isNaN(startHour) ||
    Number.isNaN(startMinute) ||
    Number.isNaN(endHour) ||
    Number.isNaN(endMinute)
  ) {
    return [];
  }

  if (
    startHour < 0 || startHour > 23 ||
    endHour < 0 || endHour > 23 ||
    startMinute < 0 || startMinute > 59 ||
    endMinute < 0 || endMinute > 59
  ) {
    return [];
  }

  const startTotal = startHour * 60 + startMinute;
  const endTotal = endHour * 60 + endMinute;
  if (startTotal >= endTotal) {
    return [];
  }

  return [{ startHour, startMinute, endHour, endMinute }];
}

function readAllowedTimeRangesFromFormData(formData: FormData): AllowedTimeRange[] | undefined {
  // allowed_time_ranges 가 JSON 문자열로 전달되는 것을 가정
  const raw = formData.get('allowed_time_ranges');
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(String(raw));
    if (!Array.isArray(parsed)) return undefined;
    const ranges: AllowedTimeRange[] = [];
    for (const r of parsed) {
      if (
        typeof r?.startHour === 'number' &&
        typeof r?.startMinute === 'number' &&
        typeof r?.endHour === 'number' &&
        typeof r?.endMinute === 'number'
      ) {
        ranges.push({
          startHour: r.startHour,
          startMinute: r.startMinute,
          endHour: r.endHour,
          endMinute: r.endMinute,
        });
      }
    }
    return ranges.length > 0 ? ranges : undefined;
  } catch {
    return undefined;
  }
}

function readExcludedTimeRangesFromSchedule(schedule: any): ExcludedTimeRange[] {
  const meta = schedule?.interviewer_responses as any;
  const ranges = meta?._metadata?.excludedTimeRanges;
  if (!Array.isArray(ranges)) return [];

  return ranges.filter((range: any) =>
    typeof range?.startHour === 'number' &&
    typeof range?.startMinute === 'number' &&
    typeof range?.endHour === 'number' &&
    typeof range?.endMinute === 'number'
  );
}

/**
 * 면접 일정 생성
 * @param formData 면접 일정 정보
 * @returns 생성된 면접 일정 데이터
 */
export async function createSchedule(formData: FormData) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const supabase = await createClient();

    // 입력값 검증
    const candidateId = validateUUID(validateRequired(formData.get('candidate_id'), '후보자 ID'), '후보자 ID');
    const stageId = validateRequired(formData.get('stage_id'), '단계 ID');
    const scheduledAt = validateFutureDate(
      new Date(validateRequired(formData.get('scheduled_at'), '면접 일시')),
      '면접 일시'
    );
    const durationMinutes = validateNumberRange(
      parseInt(validateRequired(formData.get('duration_minutes'), '면접 시간')),
      15,
      480,
      '면접 시간'
    );
    const interviewerIdsRaw = formData.get('interviewer_ids');
    const interviewerIdsParsed = interviewerIdsRaw ? JSON.parse(String(interviewerIdsRaw)) : [];
    if (!Array.isArray(interviewerIdsParsed)) {
      throw new Error('면접관 목록 형식이 올바르지 않습니다.');
    }
    const interviewerIds = Array.from(
      new Set(
        interviewerIdsParsed.map((id) => {
          if (typeof id !== 'string') throw new Error('면접관 ID 형식이 올바르지 않습니다.');
          return validateUUID(id, '면접관 ID');
        }),
      ),
    );
    const externalInterviewerEmails = readExternalInterviewerEmails(formData);
    if (interviewerIds.length === 0 && externalInterviewerEmails.length === 0) {
      throw new Error('면접관은 최소 1명 이상 필요합니다.');
    }

    // 후보자 접근 권한 확인
    await verifyCandidateAccess(candidateId);

    // 면접관들이 같은 organization에 속하는지 확인
    const { data: interviewers } = await supabase
      .from('users')
      .select('id, organization_id')
      .in('id', interviewerIds);

    if (!interviewers || interviewers.length !== interviewerIds.length) {
      throw new Error('일부 면접관을 찾을 수 없습니다.');
    }

    const invalidInterviewers = interviewers.filter(
      inv => inv.organization_id !== user.organizationId
    );
    if (invalidInterviewers.length > 0) {
      throw new Error('다른 조직의 면접관은 추가할 수 없습니다.');
    }

    // 면접 일정 생성
    const scheduleData: ScheduleInsert = {
      candidate_id: candidateId,
      stage_id: stageId,
      scheduled_at: scheduledAt.toISOString(),
      duration_minutes: durationMinutes,
      status: 'pending',
      interviewer_ids: interviewerIds,
      candidate_response: 'pending',
    };

    const { data, error } = await supabase
      .from('schedules')
      .insert(scheduleData)
      .select()
      .single();

    if (error) {
      throw new Error(`면접 일정 생성 실패: ${error.message}`);
    }

    // 타임라인 이벤트 생성
    const { error: timelineError } = await supabase.from('timeline_events').insert({
      candidate_id: candidateId,
      type: 'schedule_created',
      content: {
        message: '면접 일정이 생성되었습니다.',
        schedule_id: data.id,
        scheduled_at: scheduledAt.toISOString(),
        interviewers: interviewerIds,
      },
      created_by: user.userId,
    });

    if (timelineError) {
      console.error('[타임라인] 이벤트 생성 실패 (일정 생성):', {
        error: timelineError,
        code: timelineError.code,
        message: timelineError.message,
        details: timelineError.details,
        hint: timelineError.hint,
        candidateId,
        type: 'schedule_created',
        scheduleId: data.id,
      });
      if (timelineError.code === '23514') {
        console.error('[타임라인] DB 스키마 제약 조건 위반 - schedule_created 타입이 허용되지 않음.');
      }
      if (timelineError.code === '42501' || timelineError.message?.includes('row-level security')) {
        console.error('[타임라인] RLS 정책 위반 - 권한 문제.');
      }
    }

    // 캐시 무효화
    revalidatePath('/dashboard/calendar');
    revalidatePath(`/dashboard/candidates/${candidateId}`);

    return data;
  });
}

/**
 * 면접 일정 수정
 * @param id 면접 일정 ID
 * @param formData 수정할 정보
 * @returns 수정된 면접 일정 데이터
 */
export async function updateSchedule(id: string, formData: FormData) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const supabase = await createClient();

    // 면접 일정 조회 및 권한 확인
    const { data: schedule, error: scheduleError } = await supabase
      .from('schedules')
      .select('candidate_id')
      .eq('id', id)
      .single();

    if (scheduleError || !schedule) {
      throw new Error('면접 일정을 찾을 수 없습니다.');
    }

    await verifyCandidateAccess(schedule.candidate_id);

    // 수정할 데이터 구성
    const updateData: ScheduleUpdate = {};

    if (formData.get('scheduled_at')) {
      updateData.scheduled_at = validateFutureDate(
        new Date(validateRequired(formData.get('scheduled_at'), '면접 일시')),
        '면접 일시'
      ).toISOString();
    }

    if (formData.get('duration_minutes')) {
      updateData.duration_minutes = validateNumberRange(
        parseInt(validateRequired(formData.get('duration_minutes'), '면접 시간')),
        15,
        480,
        '면접 시간'
      );
    }

    if (formData.get('status')) {
      const status = formData.get('status') as string;
      const validStatuses: Array<'pending' | 'confirmed' | 'rejected' | 'completed'> = 
        ['pending', 'confirmed', 'rejected', 'completed'];
      if (validStatuses.includes(status as typeof validStatuses[number])) {
        updateData.status = status as 'pending' | 'confirmed' | 'rejected' | 'completed';
      }
    }

    if (formData.get('interviewer_ids')) {
      // JSON.parse 결과는 타입 추론이 `unknown[]`이 되기 쉬우므로, 면접관 ID는 반드시 `string[]`임을 명시합니다.
      const interviewerIds = validateNonEmptyArray<string>(
        JSON.parse(validateRequired(formData.get('interviewer_ids'), '면접관 목록')) as string[],
        '면접관 목록'
      );

      // 면접관 권한 확인
      const { data: interviewers } = await supabase
        .from('users')
        .select('id, organization_id')
        .in('id', interviewerIds);

      if (!interviewers || interviewers.length !== interviewerIds.length) {
        throw new Error('일부 면접관을 찾을 수 없습니다.');
      }

      const invalidInterviewers = interviewers.filter(
        inv => inv.organization_id !== user.organizationId
      );
      if (invalidInterviewers.length > 0) {
        throw new Error('다른 조직의 면접관은 추가할 수 없습니다.');
      }

      updateData.interviewer_ids = interviewerIds;
    }

    if (formData.get('candidate_response')) {
      const response = formData.get('candidate_response') as string;
      const validResponses: Array<'accepted' | 'rejected' | 'pending'> = 
        ['accepted', 'rejected', 'pending'];
      if (validResponses.includes(response as typeof validResponses[number])) {
        updateData.candidate_response = response as 'accepted' | 'rejected' | 'pending';
      }
    }

    if (formData.get('beverage_preference')) {
      updateData.beverage_preference = formData.get('beverage_preference') as string;
    }

    const { data, error } = await supabase
      .from('schedules')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`면접 일정 수정 실패: ${error.message}`);
    }

    // 타임라인 이벤트 생성
    if (updateData.status === 'confirmed') {
      const { error: timelineError } = await supabase.from('timeline_events').insert({
        candidate_id: schedule.candidate_id,
        type: 'schedule_confirmed',
        content: {
          message: '면접 일정이 확정되었습니다.',
          schedule_id: id,
        },
        created_by: user.userId,
      });

      if (timelineError) {
        console.error('[타임라인] 이벤트 생성 실패 (일정 확정):', timelineError);
        if (timelineError.code === '23514') {
          console.error('[타임라인] DB 스키마 제약 조건 위반 - schedule_confirmed 타입이 허용되지 않음.');
        }
      }
    }

    // 캐시 무효화
    revalidatePath('/dashboard/calendar');
    revalidatePath(`/dashboard/candidates/${schedule.candidate_id}`);

    return data;
  });
}

/**
 * 면접 일정 삭제
 * 구글 캘린더 이벤트도 함께 삭제하고 타임라인 이벤트를 생성합니다.
 * @param id 면접 일정 ID
 */
export async function deleteSchedule(id: string) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const isAdmin = user.role === 'admin';
    const supabase = isAdmin ? createServiceClient() : await createClient();

    // 면접 일정 조회 및 권한 확인
    const { data: schedule, error: scheduleError } = await supabase
      .from('schedules')
      .select('id, candidate_id, interviewer_ids')
      .eq('id', id)
      .single();

    if (scheduleError || !schedule) {
      throw new Error('면접 일정을 찾을 수 없습니다.');
    }

    await verifyCandidateAccess(schedule.candidate_id);

    // schedule_options 별도 조회 (구글 캘린더 이벤트 ID 포함)
    const { data: scheduleOptions, error: optionsError } = await supabase
      .from('schedule_options')
      .select('id, google_event_id, watch_channel_id, watch_resource_id')
      .eq('schedule_id', id)
      .not('google_event_id', 'is', null);

    if (optionsError) {
      console.error('schedule_options 조회 실패:', optionsError);
    }

    // 면접관 정보 조회 (구글 캘린더 이벤트 삭제용)
    const { data: interviewers } = await supabase
      .from('users')
      .select('id, email, calendar_provider, calendar_access_token, calendar_refresh_token')
      .in('id', schedule.interviewer_ids || []);

    // 구글 캘린더 이벤트 삭제
    if (scheduleOptions && scheduleOptions.length > 0 && interviewers && interviewers.length > 0) {
      // 구글 캘린더에 연동된 면접관 찾기
      const organizer = interviewers.find(
        inv => inv.calendar_provider === 'google' && inv.calendar_access_token && inv.calendar_refresh_token
      );
      
      if (organizer && organizer.calendar_access_token && organizer.calendar_refresh_token) {
        for (const option of scheduleOptions) {
          if (option.google_event_id) {
            try {
              // 1) 먼저 watch 채널을 중지 (이후 calendar event 삭제)
              if (option.watch_channel_id && option.watch_resource_id) {
                await stopCalendarEventWatch(
                  organizer.calendar_access_token,
                  organizer.calendar_refresh_token,
                  {
                    channelId: option.watch_channel_id,
                    resourceId: option.watch_resource_id,
                  },
                );

                // watch 매핑 값 정리 (선택: 실패해도 계속 진행)
                const { error: clearWatchError } = await supabase
                  .from('schedule_options')
                  .update({
                    watch_channel_id: null,
                    watch_resource_id: null,
                    watch_token: null,
                    watch_expiration: null,
                  })
                  .eq('id', option.id);

                if (clearWatchError) {
                  console.error('watch 매핑 정리 실패:', clearWatchError);
                }
              }

              // 2) 구글 캘린더 이벤트 삭제
              await deleteCalendarEvent(
                organizer.calendar_access_token,
                organizer.calendar_refresh_token,
                option.google_event_id
              );
              console.log(`구글 캘린더 이벤트 삭제 완료: ${option.google_event_id}`);
            } catch (error) {
              console.error(`구글 캘린더 이벤트 삭제 실패 (${option.google_event_id}):`, error);
              // 이벤트 삭제 실패해도 DB 삭제는 계속 진행
            }
          }
        }
      } else {
        console.warn('구글 캘린더에 연동된 면접관을 찾을 수 없습니다. 이벤트 삭제를 건너뜁니다.');
      }
    }

    // ✅ 타임라인은 새 이벤트를 쌓지 않고, 해당 schedule_id의 자동화 카드 상태를 'deleted'로 갱신합니다.
    try {
      await upsertScheduleAutomationTimeline({
        candidateId: schedule.candidate_id,
        scheduleId: id,
        createdBy: user.userId,
        latestMessage: '면접 일정이 삭제되었습니다.',
        automationStatus: 'deleted',
        appendHistory: [{ at: new Date().toISOString(), message: '채용담당자가 면접 일정을 삭제했습니다.' }],
      });
    } catch (e) {
      console.error('[타임라인] 일정 삭제 카드 업데이트 실패(계속 진행):', e);
    }

    // 면접 일정 삭제 (CASCADE로 schedule_options도 자동 삭제됨)
    const { error } = await supabase
      .from('schedules')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`면접 일정 삭제 실패: ${error.message}`);
    }

    // 캐시 무효화
    revalidatePath('/dashboard/calendar');
    revalidatePath('/dashboard/schedules');
    revalidatePath(`/dashboard/candidates/${schedule.candidate_id}`);
  });
}

/**
 * 면접 일정 초기화 (취소)
 * 워크플로우 상태를 'cancelled'로 변경하고 구글 캘린더 이벤트를 삭제합니다.
 * @param id 면접 일정 ID
 */
export async function cancelSchedule(id: string) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const isAdmin = user.role === 'admin';
    const supabase = isAdmin ? createServiceClient() : await createClient();

    // 면접 일정 조회 및 권한 확인
    const { data: schedule, error: scheduleError } = await supabase
      .from('schedules')
      .select('id, candidate_id, interviewer_ids, workflow_status')
      .eq('id', id)
      .single();

    if (scheduleError || !schedule) {
      throw new Error('면접 일정을 찾을 수 없습니다.');
    }

    await verifyCandidateAccess(schedule.candidate_id);

    // 이미 취소된 경우
    if (schedule.workflow_status === 'cancelled') {
      throw new Error('이미 취소된 면접 일정입니다.');
    }

    // schedule_options 별도 조회 (구글 캘린더 이벤트 ID 포함)
    const { data: scheduleOptions, error: optionsError } = await supabase
      .from('schedule_options')
      .select('id, google_event_id')
      .eq('schedule_id', id)
      .not('google_event_id', 'is', null);

    if (optionsError) {
      console.error('schedule_options 조회 실패:', optionsError);
    }

    // 면접관 정보 조회 (구글 캘린더 이벤트 삭제용)
    const { data: interviewers } = await supabase
      .from('users')
      .select('id, email, calendar_provider, calendar_access_token, calendar_refresh_token')
      .in('id', schedule.interviewer_ids || []);

    // 구글 캘린더 이벤트 삭제
    if (scheduleOptions && scheduleOptions.length > 0 && interviewers && interviewers.length > 0) {
      // 구글 캘린더에 연동된 면접관 찾기
      const organizer = interviewers.find(
        inv => inv.calendar_provider === 'google' && inv.calendar_access_token && inv.calendar_refresh_token
      );
      
      if (organizer && organizer.calendar_access_token && organizer.calendar_refresh_token) {
        for (const option of scheduleOptions) {
          if (option.google_event_id) {
            try {
              await deleteCalendarEvent(
                organizer.calendar_access_token,
                organizer.calendar_refresh_token,
                option.google_event_id
              );
              console.log(`구글 캘린더 이벤트 삭제 완료: ${option.google_event_id}`);
            } catch (error) {
              console.error(`구글 캘린더 이벤트 삭제 실패 (${option.google_event_id}):`, error);
              // 이벤트 삭제 실패해도 취소는 계속 진행
            }
          }
        }
      } else {
        console.warn('구글 캘린더에 연동된 면접관을 찾을 수 없습니다. 이벤트 삭제를 건너뜁니다.');
      }
    }

    // 워크플로우 상태를 'cancelled'로 변경
    const { error: updateError } = await supabase
      .from('schedules')
      .update({ workflow_status: 'cancelled' })
      .eq('id', id);

    if (updateError) {
      throw new Error(`면접 일정 취소 실패: ${updateError.message}`);
    }

    // ✅ 타임라인은 새 이벤트를 쌓지 않고, 해당 schedule_id의 자동화 카드 상태를 'cancelled'로 갱신합니다.
    try {
      await upsertScheduleAutomationTimeline({
        candidateId: schedule.candidate_id,
        scheduleId: id,
        createdBy: user.userId,
        latestMessage: '면접 일정이 취소되었습니다.',
        automationStatus: 'cancelled',
        appendHistory: [{ at: new Date().toISOString(), message: '채용담당자가 면접 일정을 취소했습니다.' }],
      });
    } catch (e) {
      console.error('[타임라인] 일정 취소 카드 업데이트 실패(계속 진행):', e);
    }

    // 캐시 무효화
    revalidatePath('/dashboard/calendar');
    revalidatePath('/dashboard/schedules');
    revalidatePath(`/dashboard/candidates/${schedule.candidate_id}`);
  });
}

/**
 * 후보자가 면접 일정에 응답 (수락/거절)
 * @param scheduleId 면접 일정 ID
 * @param token 후보자 토큰
 * @param response 응답 (accepted/rejected)
 * @param beveragePreference 음료 선호도 (선택)
 */
export async function respondToSchedule(
  scheduleId: string,
  token: string,
  response: 'accepted' | 'rejected',
  beveragePreference?: string
) {
  return withErrorHandling(async () => {
    // Service Role Client를 사용하여 RLS 정책 우회 (타임라인 이벤트 생성 안정성을 위해)
    const supabase = createServiceClient();

    // 면접 일정과 후보자 조회 (workflow_status, interviewer_ids 포함)
    const { data: schedule, error: scheduleError } = await supabase
      .from('schedules')
      .select(`
        id,
        candidate_id,
        workflow_status,
        interviewer_ids,
        candidates!inner (
          id,
          token
        )
      `)
      .eq('id', scheduleId)
      .single();

    if (scheduleError || !schedule) {
      throw new Error('면접 일정을 찾을 수 없습니다.');
    }

    // nested select(`candidates!inner`) 결과는 배열로 들어올 수 있으므로, 첫 번째 후보자를 사용합니다.
    const candidate = (schedule.candidates as { id: string; token: string }[] | null | undefined)?.[0];
    if (!candidate || candidate.token !== token) {
      throw new Error('인증 토큰이 올바르지 않습니다.');
    }

    // 응답 업데이트
    const updateData: ScheduleUpdate = {
      candidate_response: response,
    };

    if (beveragePreference) {
      updateData.beverage_preference = beveragePreference;
    }

    const { data, error } = await supabase
      .from('schedules')
      .update(updateData)
      .eq('id', scheduleId)
      .select()
      .single();

    if (error) {
      throw new Error(`응답 저장 실패: ${error.message}`);
    }

    // 면접관 ID 조회 (타임라인 이벤트 생성용)
    let interviewerId: string | null = null;
    if (schedule.interviewer_ids && schedule.interviewer_ids.length > 0) {
      const { data: interviewer } = await supabase
        .from('users')
        .select('id')
        .eq('id', schedule.interviewer_ids[0])
        .single();
      interviewerId = interviewer?.id || null;
    }

    // 타임라인 이벤트 생성
    const { data: timelineData, error: timelineError } = await supabase.from('timeline_events').insert({
      candidate_id: candidate.id,
      type: 'schedule_confirmed',
      content: {
        message: `후보자가 면접 일정을 ${response === 'accepted' ? '수락' : '거절'}했습니다.`,
        schedule_id: scheduleId,
        response,
      },
      created_by: interviewerId, // 첫 번째 면접관 ID 사용
    }).select();

    if (timelineError) {
      console.error('[타임라인] 이벤트 생성 실패 (후보자 응답):', {
        error: timelineError,
        code: timelineError.code,
        message: timelineError.message,
        details: timelineError.details,
        hint: timelineError.hint,
        candidateId: candidate.id,
        type: 'schedule_confirmed',
        scheduleId,
        interviewerId,
      });
      if (timelineError.code === '23514') {
        console.error('[타임라인] DB 스키마 제약 조건 위반 - schedule_confirmed 타입이 허용되지 않음.');
      }
      if (timelineError.code === '42501' || timelineError.message?.includes('row-level security')) {
        console.error('[타임라인] RLS 정책 위반 - 권한 문제.');
      }
    } else {
      console.log(`[타임라인] 이벤트 생성 성공:`, timelineData?.[0]?.id);
    }

    // 후보자가 거절했고, workflow_status가 'pending_candidate'인 경우 새로운 일정 옵션 자동 생성
    // ✅ 동시/중복 호출(링크 재클릭 등)에도 재생성이 2번 실행되지 않도록 락을 잡습니다.
    if (response === 'rejected' && schedule.workflow_status === 'pending_candidate') {
      console.log(`후보자가 거절함. 새로운 일정 옵션 자동 생성 시작: scheduleId=${scheduleId}`);
      try {
        // 1) 재생성 락 획득 (pending_candidate → regenerating)
        const { data: lockedRows, error: lockError } = await supabase
          .from('schedules')
          .update({ workflow_status: 'regenerating' as any })
          .eq('id', scheduleId)
          .eq('workflow_status', 'pending_candidate')
          .select('id');

        if (lockError) {
          console.error('재생성 락 획득 실패(후보자 거절):', lockError);
        }

        // 이미 다른 요청이 재생성을 시작한 경우
        if (!lockedRows || lockedRows.length === 0) {
          return {
            ...data,
            regenerated: false,
            message: '이미 일정 재생성이 진행 중입니다. 잠시 후 다시 확인해주세요.',
          };
        }

        // ✅ 후보자 응답 경로(세션 있음)에서도 동일 함수를 재사용합니다.
        // createdBy는 타임라인 표시용(누가 실행했는지)입니다.
        // 후보자 응답은 "로그인 세션"이 없을 수 있으므로, 여기서는 첫 번째 면접관 ID(있으면)를 사용합니다.
        const regenerateResult = await regenerateScheduleOptions(scheduleId, {
          createdBy: interviewerId ?? null,
        });
        console.log('새로운 일정 옵션 생성 완료:', regenerateResult);
        
        // 캐시 무효화
        revalidatePath(`/dashboard/candidates/${schedule.candidate_id}`);
        revalidatePath('/dashboard/schedules');
        
        return {
          ...data,
          regenerated: true,
          message: regenerateResult.message,
        };
      } catch (regenerateError) {
        console.error('새로운 일정 옵션 생성 실패:', regenerateError);
        // 재생성 실패해도 후보자 응답은 저장되었으므로 경고만 반환
        return {
          ...data,
          regenerated: false,
          error: regenerateError instanceof Error ? regenerateError.message : '알 수 없는 오류',
        };
      }
    }

    return data;
  });
}

/**
 * 인터뷰 스케줄링 자동화 - 전체 워크플로우 실행
 * 1. 면접관들의 구글 캘린더에서 공통 가능 일정 찾기 (2개)
 * 2. 구글 캘린더에 block 일정 생성 및 초대 전송
 * 3. schedule_options에 저장
 * 4. 면접관 수락 대기 상태로 설정
 */
export async function scheduleInterviewAutomated(formData: FormData) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const isAdmin = user.role === 'admin';
    
    // 관리자일 경우 Service Role Client를 사용하여 RLS 정책 우회
    const supabase = isAdmin ? createServiceClient() : await createClient();

    // 입력값 검증
    const candidateId = validateUUID(validateRequired(formData.get('candidate_id'), '후보자 ID'), '후보자 ID');
    const stageId = validateRequired(formData.get('stage_id'), '단계 ID');
    const interviewerIdsRaw = formData.get('interviewer_ids');
    const interviewerIdsParsed = interviewerIdsRaw ? JSON.parse(String(interviewerIdsRaw)) : [];
    if (!Array.isArray(interviewerIdsParsed)) {
      throw new Error('면접관 목록 형식이 올바르지 않습니다.');
    }
    const interviewerIds = Array.from(
      new Set(
        interviewerIdsParsed.map((id) => {
          if (typeof id !== 'string') throw new Error('면접관 ID 형식이 올바르지 않습니다.');
          return validateUUID(id, '면접관 ID');
        }),
      ),
    );
    const externalInterviewerEmails = readExternalInterviewerEmails(formData);
    if (interviewerIds.length === 0 && externalInterviewerEmails.length === 0) {
      throw new Error('면접관은 최소 1명 이상 필요합니다.');
    }
    const startDate = validateFutureDate(
      new Date(validateRequired(formData.get('start_date'), '시작 날짜')),
      '시작 날짜'
    );
    const endDate = validateFutureDate(
      new Date(validateRequired(formData.get('end_date'), '종료 날짜')),
      '종료 날짜'
    );
    const durationMinutes = validateNumberRange(
      parseInt(validateRequired(formData.get('duration_minutes'), '면접 시간') || '60'),
      15,
      480,
      '면접 시간'
    );
    const numOptions = validateNumberRange(
      parseInt(validateRequired(formData.get('num_options'), '일정 옵션 개수') || '2'),
      1,
      5,
      '일정 옵션 개수'
    );
    let excludedTimeRanges = readExcludedTimeRangesFromFormData(formData);
    // 제외시간 미설정 시 기본 점심시간(11:30~12:30) 적용
    if (!excludedTimeRanges || excludedTimeRanges.length === 0) {
      excludedTimeRanges = [{ startHour: 11, startMinute: 30, endHour: 12, endMinute: 30 }];
    }
    // 허용시간(가능시간) 읽기 - 없으면 서버에서 BUSINESS_HOURS 사용
    const allowedTimeRanges = readAllowedTimeRangesFromFormData(formData);
    // 면접관 선호 읽기 (id -> morning|afternoon|none)
    let interviewerPreferences: Record<string, 'morning' | 'afternoon' | 'none'> | undefined = undefined;
    const prefRaw = formData.get('interviewer_preferences');
    if (prefRaw) {
      try {
        const obj = JSON.parse(String(prefRaw));
        if (obj && typeof obj === 'object') {
          interviewerPreferences = {};
          for (const [k, v] of Object.entries(obj)) {
            if (v === 'morning' || v === 'afternoon' || v === 'none') {
              interviewerPreferences[k] = v;
            }
          }
        }
      } catch {
        // 무시하고 진행
      }
    }

    // 비가입 면접관 이메일 개인 저장 (중복은 unique(user_id, email)로 방지)
    if (externalInterviewerEmails.length > 0) {
      const { error: upsertExternalError } = await supabase.from('external_interviewers').upsert(
        externalInterviewerEmails.map((email) => ({
          user_id: user.userId,
          email,
        })),
        { onConflict: 'user_id,email', ignoreDuplicates: false },
      );

      if (upsertExternalError) {
        console.error('비가입 면접관 저장 실패(계속 진행):', upsertExternalError);
      }
    }

    // 후보자 정보 조회 (권한 확인 포함, 관리자일 경우 Service Role Client 사용)
    // job_post 정보도 함께 조회하여 포지션명 가져오기
    const { data: candidateWithJob, error: candidateError } = await supabase
      .from('candidates')
      .select(`
        *,
        job_posts (
          id,
          title
        )
      `)
      .eq('id', candidateId)
      .single();

    if (candidateError || !candidateWithJob) {
      console.error('후보자 조회 실패:', candidateError);
      throw new Error(candidateError?.message || '후보자를 찾을 수 없습니다.');
    }

    const candidate = candidateWithJob as any;
    const jobPost = candidate.job_posts as { id: string; title: string } | null | undefined;
    const positionName = jobPost?.title || '포지션 미지정';

    // 내부 면접관 정보 조회 (구글 캘린더 연동 정보 포함)
    let interviewers: Array<{
      id: string;
      email: string;
      organization_id: string;
      calendar_provider: string | null;
      calendar_access_token: string | null;
      calendar_refresh_token: string | null;
    }> = [];

    if (interviewerIds.length > 0) {
      const { data: internalInterviewers, error: interviewersError } = await supabase
        .from('users')
        .select('id, email, organization_id, calendar_provider, calendar_access_token, calendar_refresh_token')
        .in('id', interviewerIds);

      if (interviewersError || !internalInterviewers || internalInterviewers.length !== interviewerIds.length) {
        throw new Error('일부 면접관을 찾을 수 없습니다.');
      }
      interviewers = internalInterviewers;
    }

    // 구글 캘린더 연동 확인
    const interviewersWithCalendar = interviewers.filter(
      inv => inv.calendar_provider === 'google' && inv.calendar_access_token && inv.calendar_refresh_token
    );

    if (interviewerIds.length > 0 && interviewersWithCalendar.length !== interviewerIds.length) {
      // 연동되지 않은 면접관 목록 생성
      const interviewersWithoutCalendar = interviewers.filter(
        inv => !(inv.calendar_provider === 'google' && inv.calendar_access_token && inv.calendar_refresh_token)
      );
      
      const missingEmails = interviewersWithoutCalendar.map(inv => inv.email).join(', ');
      throw new Error(
        `모든 면접관이 구글 캘린더에 연동되어 있어야 합니다. 연동되지 않은 면접관: ${missingEmails}`
      );
    }

    // 주최자(이벤트를 생성할 구글 캘린더 소유자) 정보 조회
    // - 기존 로직은 "선택된 면접관 중 첫 번째(연동된 사람)"를 주최자로 잡을 수 있어
    //   자동화를 시작한 사람이 자신의 캘린더에서 일정을 못 찾는 혼란이 생길 수 있습니다.
    // - 따라서 기본 정책을 "자동화를 시작한 현재 사용자 캘린더에 block 일정을 생성"으로 고정합니다.
    const { data: currentUserForCalendar, error: currentUserError } = await supabase
      .from('users')
      .select('id, email, calendar_provider, calendar_access_token, calendar_refresh_token')
      .eq('id', user.userId)
      .single();

    if (currentUserError || !currentUserForCalendar) {
      throw new Error('현재 사용자 정보를 찾을 수 없습니다.');
    }

    // ✅ 주최자 캘린더는 "자동화를 시작한 현재 사용자"로 고정
    const organizer = currentUserForCalendar;
    if (
      organizer.calendar_provider !== 'google' ||
      !organizer.calendar_access_token ||
      !organizer.calendar_refresh_token
    ) {
      throw new Error('일정 생성을 위해 먼저 구글 캘린더를 연동해주세요. (/dashboard/connect-calendar)');
    }

    // 가용시간 계산 기준: 내부 면접관이 있으면 내부 면접관, 없으면 주최자(로그인 사용자)
    const availabilityParticipants =
      interviewersWithCalendar.length > 0 ? interviewersWithCalendar : [organizer];
    const availabilityInterviewerIds =
      interviewerIds.length > 0 ? interviewerIds : [organizer.id];

    // 원본 날짜 범위 저장 (재시도 시 기준점)
    const originalStartDate = new Date(startDate);
    const originalEndDate = new Date(endDate);
    
    // 일정 검색 및 날짜 범위 확장 재시도 로직
    let retryCount = 0;
    let currentStartDate = new Date(startDate);
    let currentEndDate = new Date(endDate);
    let selectedSlots: Array<{ 
      scheduledAt: Date; 
      duration: number; 
      availableInterviewers: string[];
      missingInterviewers?: string[];
      isPartialConflict?: boolean;
    }> = [];
    let lastError: Error | null = null;
    let allowPartialConflict = false; // 부분적 충돌 허용 플래그

    while (retryCount <= 5) {
      // 면접관들의 바쁜 시간 조회
      const allBusyTimes: Array<{ start: { dateTime: string; timeZone: string }; end: { dateTime: string; timeZone: string } }> = [];
      
      for (const interviewer of availabilityParticipants) {
        try {
          // userId를 전달하여 갱신된 토큰을 DB에 자동 저장
          const token = await refreshAccessTokenIfNeeded(
            interviewer.calendar_access_token!,
            interviewer.calendar_refresh_token!,
            interviewer.id
          );
          
          const busyTimes = await getBusyTimes(
            token,
            ['primary'],
            currentStartDate,
            currentEndDate
          );

          allBusyTimes.push(...busyTimes.map(bt => ({
            start: bt.start,
            end: bt.end,
          })));
        } catch (error) {
          console.error(`면접관 ${interviewer.email}의 캘린더 조회 실패:`, error);
          const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
          throw new Error(
            `면접관 ${interviewer.email}의 캘린더를 조회할 수 없습니다. ` +
            `${errorMessage} ` +
            `면접관이 구글 캘린더를 재연동해야 할 수 있습니다. (/dashboard/connect-calendar)`
          );
        }
      }

      // 공통 가능 일정 찾기
      // 1차 시도: 모든 면접관이 가능한 일정만 찾기
      // 2차 시도 이후: 부분적 충돌 허용 모드로 전환
      let availableSlots = await findAvailableTimeSlots({
        candidateName: candidate.name,
        stageName: stageId,
        interviewerIds: availabilityInterviewerIds,
        busyTimes: allBusyTimes.map(bt => ({
          id: '',
          summary: '',
          start: bt.start,
          end: bt.end,
        })),
        startDate: currentStartDate,
        endDate: currentEndDate,
        durationMinutes,
        allowPartialConflict: allowPartialConflict,
        minAvailableInterviewers: allowPartialConflict
          ? Math.max(1, Math.floor(availabilityInterviewerIds.length * 0.5))
          : availabilityInterviewerIds.length, // 부분적 충돌 시 최소 50% 이상
        allowedTimeRanges,
        excludedTimeRanges,
        interviewerPreferences,
      });

      // 주말 제외 옵션 처리: formData로부터 읽어서 토/일은 제거
      const excludeWeekendsRaw = formData.get('exclude_weekends');
      const excludeWeekends =
        typeof excludeWeekendsRaw === 'string'
          ? excludeWeekendsRaw === 'true'
          : false;
      if (excludeWeekends) {
        availableSlots = availableSlots.filter(slot => {
          const d = slot.scheduledAt;
          const day = d.getDay(); // 0=일,6=토
          return day !== 0 && day !== 6;
        });
      }

      // 상위 N개 일정 선택 (numOptions만큼)
      // 부분적 충돌이 없는 옵션을 우선 선택
      const perfectSlots = availableSlots.filter(slot => !slot.isPartialConflict);
      const partialSlots = availableSlots.filter(slot => slot.isPartialConflict);
      
      if (perfectSlots.length > 0) {
        // 모든 면접관이 가능한 일정이 있으면 우선 선택
        selectedSlots = perfectSlots.slice(0, numOptions);
      } else if (partialSlots.length > 0) {
        // 부분적 충돌 옵션만 있는 경우
        selectedSlots = partialSlots.slice(0, numOptions);
      } else {
        selectedSlots = availableSlots.slice(0, numOptions);
      }
      
      if (selectedSlots.length > 0) {
        // 일정을 찾았으면 반복문 종료
        const conflictInfo = selectedSlots.some(s => s.isPartialConflict) 
          ? ` (일부 면접관 제외 옵션 포함)` 
          : '';
        console.log(`일정 검색 성공: retryCount=${retryCount}, 날짜 범위=${format(currentStartDate, 'yyyy-MM-dd', { locale: ko })} ~ ${format(currentEndDate, 'yyyy-MM-dd', { locale: ko })}${conflictInfo}`);
        break;
      }

      // 일정을 찾지 못한 경우 처리
      if (!allowPartialConflict && retryCount >= 2) {
        // 2회 재시도 후에도 일정이 없으면 부분적 충돌 허용 모드로 전환
        allowPartialConflict = true;
        retryCount = 0; // 부분적 충돌 모드에서 다시 시도
        currentStartDate = new Date(startDate); // 날짜 범위 초기화
        currentEndDate = new Date(endDate);
        console.log('모든 면접관이 가능한 일정이 없습니다. 부분적 충돌 허용 모드로 전환합니다.');
        continue;
      }

      // 일정을 찾지 못했고, 재시도 가능한 경우 날짜 범위 확장
      if (shouldExtendDateRange(retryCount)) {
        retryCount++;
        const extended = extendDateRangeByWeek(currentStartDate, currentEndDate);
        currentStartDate = extended.newStartDate;
        currentEndDate = extended.newEndDate;
        console.log(`일정 없음. 날짜 범위 확장 시도 ${retryCount}: ${format(currentStartDate, 'yyyy-MM-dd', { locale: ko })} ~ ${format(currentEndDate, 'yyyy-MM-dd', { locale: ko })}`);
      } else {
        // 최대 재시도 횟수 초과
        // 부분적 충돌 허용 모드로 마지막 시도
        if (!allowPartialConflict) {
          allowPartialConflict = true;
          retryCount = 0;
          currentStartDate = new Date(startDate);
          currentEndDate = new Date(endDate);
          console.log('최대 재시도 횟수 초과. 부분적 충돌 허용 모드로 마지막 시도합니다.');
          continue;
        }
        
        // 부분적 충돌 모드에서도 실패한 경우
        const partialConflictInfo = allowPartialConflict 
          ? ' 부분적 충돌 허용 모드에서도' 
          : '';
        lastError = new Error(
          `면접관들의 공통 가능 일정을 찾을 수 없습니다.${partialConflictInfo} ` +
          `원본 날짜 범위(${format(originalStartDate, 'yyyy-MM-dd', { locale: ko })} ~ ${format(originalEndDate, 'yyyy-MM-dd', { locale: ko })})부터 ` +
          `총 ${retryCount + 1}회 시도했지만 가능한 일정이 없습니다. 다른 날짜 범위를 선택하거나 면접관을 변경해주세요.`
        );
        break;
      }
    }

    if (selectedSlots.length === 0) {
      throw lastError || new Error('면접관들의 공통 가능 일정을 찾을 수 없습니다.');
    }

    // 메인 스케줄 생성 (워크플로우 상태: pending_interviewers)
    // original_start_date, original_end_date, retry_count 필드는 마이그레이션이 적용된 경우에만 사용
    // 타입 단언을 사용하여 필드가 없어도 작동하도록 처리
    const scheduleData = {
      candidate_id: candidateId,
      stage_id: stageId,
      scheduled_at: selectedSlots[0].scheduledAt.toISOString(), // 임시로 첫 번째 일정 사용
      duration_minutes: durationMinutes,
      status: 'pending' as const,
      interviewer_ids: interviewerIds,
      external_interviewer_emails: externalInterviewerEmails,
      candidate_response: 'pending' as const,
      workflow_status: 'pending_interviewers' as const,
      // ✅ 최초 옵션 개수 저장: 재생성 시 이 값을 사용하여 옵션 개수를 고정합니다.
      initial_num_options: numOptions,
      // 마이그레이션이 적용된 경우에만 이 필드들을 포함 (타입 단언 사용)
      original_start_date: originalStartDate.toISOString(),
      original_end_date: originalEndDate.toISOString(),
      retry_count: retryCount,
      interviewer_responses: excludedTimeRanges.length > 0
        ? {
            _metadata: {
              excludedTimeRanges,
            },
          }
        : {},
    } as ScheduleInsert & {
      original_start_date?: string;
      original_end_date?: string;
      retry_count?: number;
    };

    const { data: schedule, error: scheduleError } = await supabase
      .from('schedules')
      .insert(scheduleData)
      .select()
      .single();

    if (scheduleError || !schedule) {
      throw new Error(`면접 일정 생성 실패: ${scheduleError?.message || '알 수 없는 오류'}`);
    }

    // 각 일정 옵션에 대해 구글 캘린더 block 일정 생성
    const scheduleOptions = [];

    // 웹훅으로 사용할 공개 주소(구글이 호출하는 URL)
    const webhookAddressBase =
      process.env.GOOGLE_CALENDAR_WEBHOOK_URL ||
      (process.env.NEXT_PUBLIC_APP_URL
        ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/google-calendar-events`
        : '');

    if (!webhookAddressBase) {
      throw new Error(
        '웹훅 주소를 찾을 수 없습니다. `GOOGLE_CALENDAR_WEBHOOK_URL` 또는 `NEXT_PUBLIC_APP_URL`을 .env에 설정해주세요.',
      );
    }

    const webhookAddress = webhookAddressBase.replace(/\/$/, '');
    
    for (const slot of selectedSlots) {
      const endTime = new Date(slot.scheduledAt);
      endTime.setMinutes(endTime.getMinutes() + durationMinutes);

      // 주최자(내부 면접관 또는 로그인 사용자)의 토큰을 사용하여 이벤트 생성
      const organizerToken = await refreshAccessTokenIfNeeded(
        organizer.calendar_access_token!,
        organizer.calendar_refresh_token!,
        organizer.id
      );

      // ✅ 안전장치: 토큰이 실제로 어떤 구글 계정에 연결되어 있는지 확인합니다.
      // - 사용자가 다른 구글 계정을 선택해 연동했으면, 이벤트가 '다른 계정 캘린더'에 생성되어
      //   현재 보고 있는 캘린더에 보이지 않는 문제가 발생할 수 있습니다.
      // - 따라서 organizer.email(앱 계정)과 google userinfo.email(토큰 소유자)이 다르면 즉시 중단합니다.
      try {
        const oauth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/google`
        );
        oauth2Client.setCredentials({ access_token: organizerToken });
        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const { data: googleUserInfo } = await oauth2.userinfo.get();
        const googleEmail = googleUserInfo.email?.toLowerCase();
        const organizerEmail = organizer.email?.toLowerCase();

        // 운영 추적용(민감정보 제외): 어떤 이메일로 생성 시도했는지 기록
        console.log('[Google Calendar][면접 일정 자동화] 토큰 계정 진단', {
          organizerUserId: organizer.id,
          organizerEmail: organizer.email,
          googleEmail: googleUserInfo.email,
          scheduleId: schedule.id,
          candidateId,
        });

        if (organizerEmail && googleEmail && organizerEmail !== googleEmail) {
          throw new Error(
            `현재 로그인 계정(${organizer.email})과 다른 구글 계정(${googleUserInfo.email})이 연동되어 있습니다. ` +
              `이 상태에서는 일정이 "다른 구글 캘린더"에 생성되어 보이지 않을 수 있습니다. ` +
              `올바른 계정으로 다시 연동해주세요. (/dashboard/connect-calendar)`
          );
        }
      } catch (e) {
        // userinfo 조회 실패는 대부분 권한/토큰 문제이므로 사용자에게 재연동을 안내합니다.
        // 단, 위에서 던진 “계정 불일치” 에러는 그대로 전파합니다.
        if (e instanceof Error && e.message.includes('다른 구글 계정')) throw e;
        console.error('[Google Calendar][면접 일정 자동화] 토큰 계정 진단 실패:', e);
        throw new Error(
          '구글 계정 연동 상태를 확인하지 못했습니다. 구글 캘린더를 재연동 후 다시 시도해주세요. (/dashboard/connect-calendar)'
        );
      }

      // 운영 환경에서 원인 추적을 위해 최소한의 진단 로그를 남깁니다.
      // ⚠️ 토큰(access/refresh)은 절대 로그로 남기지 않습니다.
      console.log('[Google Calendar][면접 일정 자동화] 이벤트 생성 시도', {
        candidateId,
        scheduleId: schedule.id,
        organizerUserId: organizer.id,
        organizerEmail: organizer.email,
        start: slot.scheduledAt.toISOString(),
        end: endTime.toISOString(),
        attendeesCount:
          interviewersWithCalendar.filter(inv => !slot.missingInterviewers?.includes(inv.id)).length +
          externalInterviewerEmails.length,
      });

      // 부분적 충돌 정보 처리
      const missingInterviewerEmails = slot.missingInterviewers 
        ? interviewersWithCalendar
            .filter(inv => slot.missingInterviewers?.includes(inv.id))
            .map(inv => inv.email)
        : [];
      
      const isPartialConflict = slot.isPartialConflict || missingInterviewerEmails.length > 0;
      const conflictNote = isPartialConflict && missingInterviewerEmails.length > 0
        ? `\n\n⚠️ 주의: 이 일정은 일부 면접관(${missingInterviewerEmails.join(', ')})이 참석할 수 없습니다.`
        : '';

      // 구글 캘린더에 block 일정 생성
      const createdEvent = await createCalendarEvent(
        organizerToken,
        organizer.calendar_refresh_token!,
        {
          summary: `[Block] ${positionName} - ${candidate.name} 면접 일정 (확정 대기)${isPartialConflict ? ' [일부 면접관 제외]' : ''}`,
          description: `포지션: ${positionName}\n후보자: ${candidate.name}\n면접 단계: ${stageId}${conflictNote}\n\n이 일정은 아직 확정되지 않았습니다. 모든 면접관이 수락하면 후보자에게 전송됩니다.`,
          start: {
            dateTime: slot.scheduledAt.toISOString(),
            timeZone: 'Asia/Seoul',
          },
          end: {
            dateTime: endTime.toISOString(),
            timeZone: 'Asia/Seoul',
          },
          attendees: [
            ...interviewersWithCalendar
            .filter(inv => !slot.missingInterviewers?.includes(inv.id))
            .map(inv => ({ email: inv.email })),
            ...externalInterviewerEmails.map((email) => ({ email })),
          ],
          transparency: 'opaque', // block 일정이므로 불투명
        }
      );

      // 방어 로직: eventId가 비어있으면 성공으로 처리하지 않습니다.
      if (!createdEvent?.id) {
        throw new Error(
          '구글 캘린더 일정 생성에 실패했습니다. (이벤트 ID를 받지 못함) 구글 캘린더를 재연동 후 다시 시도해주세요. (/dashboard/connect-calendar)'
        );
      }
      const eventId = createdEvent.id;
      const eventHtmlLink = createdEvent.htmlLink;

      // schedule_options에 저장
      // 부분적 충돌 정보는 interviewer_responses에 메타데이터로 저장
      const optionData: any = {
        schedule_id: schedule.id,
        scheduled_at: slot.scheduledAt.toISOString(),
        status: 'pending',
        google_event_id: eventId,
        interviewer_responses: {}, // 초기값: 빈 객체
      };
      
      // ✅ 운영 디버깅용: 생성된 이벤트 링크를 메타데이터로 저장해두면,
      // “어느 캘린더에 생겼는지”를 사용자가 즉시 확인할 수 있습니다.
      if (eventHtmlLink) {
        optionData.interviewer_responses = {
          _metadata: {
            googleEventHtmlLink: eventHtmlLink,
          },
        };
      }

      // 부분적 충돌 정보를 메타데이터로 저장 (나중에 스키마 확장 가능)
      if (isPartialConflict && slot.missingInterviewers && slot.missingInterviewers.length > 0) {
        optionData.interviewer_responses = {
          _metadata: {
            ...(optionData.interviewer_responses?._metadata || {}),
            isPartialConflict: true,
            missingInterviewers: slot.missingInterviewers,
            availableInterviewers: slot.availableInterviewers,
          },
        };
      }

      const { data: option, error: optionError } = await supabase
        .from('schedule_options')
        .insert(optionData)
        .select()
        .single();

      if (optionError || !option) {
        // 이벤트는 생성되었지만 DB 저장 실패 시 이벤트 삭제 시도
        try {
          await deleteCalendarEvent(organizerToken, organizer.calendar_refresh_token!, eventId);
        } catch (deleteError) {
          console.error('이벤트 삭제 실패:', deleteError);
        }
        throw new Error(`일정 옵션 저장 실패: ${optionError?.message || '알 수 없는 오류'}`);
      }

      // 구글 캘린더 이벤트 watch 등록 (웹훅으로 응답 변경 감지)
      // - watch 등록 실패는 일정 생성 실패로 처리하지 않음 (수동 확인/cron으로 대체 가능)
      try {
        if (option.google_event_id) {
          // Google Calendar watch channel id는 길이 제한이 있어(최대 64자),
          // schedule/option UUID를 모두 포함하면 등록이 실패할 수 있습니다.
          const channelId = `calwatch-${randomUUID()}`;
          const watchToken = randomUUID();

          const watchInfo = await watchCalendarEvent(organizerToken, organizer.calendar_refresh_token!, option.google_event_id, {
            address: webhookAddress,
            channelId,
            token: watchToken,
          });

          const { error: watchUpdateError } = await supabase
            .from('schedule_options')
            .update({
              watch_channel_id: watchInfo.channelId,
              watch_resource_id: watchInfo.resourceId,
              watch_token: watchToken,
              watch_expiration: watchInfo.expiration ? new Date(watchInfo.expiration) : null,
            })
            .eq('id', option.id);

          if (watchUpdateError) {
            console.error('watch 정보 저장 실패:', watchUpdateError);
          } else {
            // 이후 로직에서 scheduleOptions 목록에 watch 값이 필요할 수 있으므로 option 객체에도 반영
            (option as any).watch_channel_id = watchInfo.channelId;
            (option as any).watch_resource_id = watchInfo.resourceId;
            (option as any).watch_token = watchToken;
            (option as any).watch_expiration = watchInfo.expiration ? new Date(watchInfo.expiration) : null;
          }
        }
      } catch (watchError) {
        console.error('이벤트 watch 등록 실패 (계속 진행):', watchError);
      }

      scheduleOptions.push(option);
    }

    // 방어 로직: 일정 옵션이 0개거나, google_event_id가 누락되면 성공으로 처리하지 않습니다.
    // (사용자 입장에서 “시작되었습니다”가 떠도 캘린더에 아무것도 없는 혼란을 방지)
    if (scheduleOptions.length === 0) {
      throw new Error(
        '면접 일정 옵션을 생성하지 못했습니다. 구글 캘린더 권한/연동 상태를 확인 후 다시 시도해주세요. (/dashboard/connect-calendar)'
      );
    }

    const optionsMissingEventId = scheduleOptions.filter((opt: any) => !opt?.google_event_id);
    if (optionsMissingEventId.length > 0) {
      throw new Error(
        '구글 캘린더 일정 생성이 완료되지 않았습니다. 구글 캘린더를 재연동 후 다시 시도해주세요. (/dashboard/connect-calendar)'
      );
    }

    // 면접관들에게 일정 확인 안내 메일 발송
    if (organizer.calendar_access_token && organizer.calendar_refresh_token && organizer.email) {
      // stage ID를 프로세스 이름으로 변환
      const stageName = getStageNameByStageId(stageId) || stageId;
      
      // 일정 옵션 목록을 HTML로 포맷팅
      const optionsListHtml = scheduleOptions.map((opt, index) => {
        // ✅ 메일 표기는 KST로 통일
        const dateKst = toZonedTime(new Date(opt.scheduled_at), KST_TIMEZONE);
        const endTimeKst = new Date(dateKst);
        endTimeKst.setMinutes(endTimeKst.getMinutes() + durationMinutes);
        
        return `
          <div style="margin: 15px 0; padding: 15px; background-color: #f5f5f5; border-radius: 5px;">
            <p style="margin: 0; font-weight: bold; color: #333;">
              옵션 ${index + 1}: ${format(dateKst, 'yyyy년 MM월 dd일 (EEE) HH:mm', { locale: ko })} - ${format(endTimeKst, 'HH:mm', { locale: ko })}
            </p>
          </div>
        `;
      }).join('');

      const notificationMessage = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: 'Malgun Gothic', Arial, sans-serif; line-height: 1.6; color: #333; }
          </style>
        </head>
        <body>
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">
              면접 일정 확인 요청
            </h2>
            
            <p style="font-size: 16px; margin-top: 20px;">
              안녕하세요,
            </p>
            
            <p style="font-size: 14px; margin-top: 15px;">
              <strong>${candidate.name}</strong>님의 면접 일정이 생성되었습니다. 
              구글 캘린더에 초대가 전송되었으니 확인 후 수락 또는 거절해주시기 바랍니다.
            </p>
            
            <div style="margin: 25px 0; padding: 20px; background-color: #f0f9ff; border-left: 4px solid #2563eb; border-radius: 5px;">
              <p style="margin: 0 0 10px 0; font-weight: bold; color: #1e40af;">
                면접 정보
              </p>
              <p style="margin: 5px 0; font-size: 14px;">
                <strong>포지션:</strong> ${positionName}
              </p>
              <p style="margin: 5px 0; font-size: 14px;">
                <strong>후보자:</strong> ${candidate.name}
              </p>
              <p style="margin: 5px 0; font-size: 14px;">
                <strong>면접 단계:</strong> ${stageName}
              </p>
              <p style="margin: 5px 0; font-size: 14px;">
                <strong>면접 시간:</strong> ${durationMinutes}분
              </p>
            </div>
            
            <div style="margin: 25px 0;">
              <p style="font-weight: bold; color: #333; margin-bottom: 10px;">
                생성된 일정 옵션:
              </p>
              ${optionsListHtml}
            </div>
            
            <div style="margin: 30px 0; padding: 15px; background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 5px;">
              <p style="margin: 0; font-size: 14px; color: #92400e;">
                <strong>⚠️ 중요:</strong> 구글 캘린더에서 각 일정 초대에 대해 수락 또는 거절을 선택해주세요. 
                모든 면접관이 수락한 일정이 후보자에게 전송됩니다.
              </p>
            </div>
            
            <p style="margin-top: 30px; font-size: 14px; color: #666;">
              구글 캘린더에서 일정을 확인하고 응답해주시기 바랍니다.
            </p>
            
            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
            <p style="font-size: 12px; color: #999; text-align: center;">
              이 메일은 VNTG ATS 시스템에서 자동으로 발송되었습니다.
            </p>
          </div>
        </body>
        </html>
      `;

      // 모든 면접관에게 안내 메일 발송
      for (const interviewer of interviewersWithCalendar) {
        if (interviewer.email) {
          try {
            await sendEmailViaGmail(
              organizer.calendar_access_token,
              organizer.calendar_refresh_token,
              {
                to: interviewer.email,
                from: organizer.email,
                subject: `[면접 일정 확인 요청] ${candidate.name}님의 면접 일정이 생성되었습니다`,
                html: notificationMessage,
                replyTo: organizer.email,
              }
            );
            console.log(`면접관 ${interviewer.email}에게 안내 메일 발송 완료`);
          } catch (error) {
            console.error(`면접관 ${interviewer.email}에게 안내 메일 발송 실패:`, error);
            // 메일 발송 실패해도 일정 생성은 성공한 것으로 처리
          }
        }
      }
    }

    // 타임라인 이벤트 생성
    const timelineMessage = retryCount > 0
      ? `면접 일정 자동화가 시작되었습니다. 원본 날짜 범위에 일정이 없어 ${retryCount}회 날짜 범위를 확장하여 검색했습니다. 면접관들의 수락을 기다리는 중입니다.`
      : '면접 일정 자동화가 시작되었습니다. 면접관들의 수락을 기다리는 중입니다.';
    
    // 요약 로그: 제외 설정을 간단히 표기
    try {
      const ws = formData.get('work_start_hour');
      const wm = formData.get('work_start_minute');
      const we = formData.get('work_end_hour');
      const wem = formData.get('work_end_minute');
      const ls = formData.get('lunch_start_hour');
      const lsm = formData.get('lunch_start_minute');
      const le = formData.get('lunch_end_hour');
      const lem = formData.get('lunch_end_minute');
      const ew = formData.get('exclude_weekends');
      console.log('[스케줄 자동화] 제외 설정 요약', {
        work: ws !== null && wm !== null && we !== null && wem !== null
          ? `${String(ws).padStart(2,'0')}:${String(wm).padStart(2,'0')}~${String(we).padStart(2,'0')}:${String(wem).padStart(2,'0')}`
          : '미설정',
        lunch: ls !== null && lsm !== null && le !== null && lem !== null
          ? `${String(ls).padStart(2,'0')}:${String(lsm).padStart(2,'0')}~${String(le).padStart(2,'0')}:${String(lem).padStart(2,'0')}`
          : '미설정',
        excludeWeekends: String(ew),
      });
    } catch {}
    
    console.log(`[타임라인] 일정 자동화 카드 업서트: candidateId=${candidateId}, scheduleId=${schedule.id}`);

    // ✅ 중요한 UX 정책
    // - 타임라인에 새 줄을 계속 쌓지 않고, "면접 일정 자동화 카드 1개"를 업데이트합니다.
    // - 면접관 거절/재생성/삭제 등도 같은 카드에서 상태가 바뀌는 형태로 보이게 됩니다.
    try {
      await upsertScheduleAutomationTimeline({
        candidateId,
        scheduleId: schedule.id,
        createdBy: user.userId,
        latestMessage: timelineMessage,
        automationStatus: 'pending_interviewers',
        scheduleOptions: scheduleOptions.map((opt) => ({
          id: opt.id,
          scheduled_at: opt.scheduled_at,
        })),
        appendHistory: [
          {
            at: new Date().toISOString(),
            message: '면접 일정 자동화가 시작되었습니다. 면접관들의 수락/거절 응답을 기다리는 중입니다.',
          },
        ],
        extraContent: {
          interviewers: interviewerIds,
          external_interviewers: externalInterviewerEmails,
          retry_count: retryCount,
          original_date_range: {
            start: originalStartDate.toISOString(),
            end: originalEndDate.toISOString(),
          },
        },
      });
    } catch (e) {
      // 타임라인 업데이트 실패해도 "일정 자동화" 자체는 성공할 수 있으므로, 여기서는 로그만 남기고 계속 진행합니다.
      console.error('[타임라인] 일정 자동화 카드 업서트 실패(계속 진행):', e);
    }

    // 캐시 무효화
    revalidatePath('/dashboard/calendar');
    revalidatePath(`/dashboard/candidates/${candidateId}`);

    return {
      schedule,
      options: scheduleOptions,
      message: `${selectedSlots.length}개의 일정 옵션이 생성되었고, 면접관들에게 초대가 전송되었습니다.`,
    };
  });
}

/**
 * 기존 스케줄에 대해 새로운 일정 옵션을 자동 생성
 * 모든 일정 옵션이 거절되었을 때 호출되어 새로운 일정을 찾아서 생성
 */
async function regenerateScheduleOptions(
  scheduleId: string,
  opts?: {
    /**
     * 웹훅/백그라운드 경로에서는 세션이 없을 수 있으므로 권한 검사를 생략할지 여부
     * - true: Service Role 기반으로 진행 (세션/쿠키 불필요)
     * - false/undefined: 기존 권한 검증 수행
     */
    bypassAuth?: boolean;
    /**
     * 타임라인 카드 업데이트 시 "누가 실행했는지" 표시용
     * - 웹훅 경로에서는 세션이 없어도, 주최자/시스템 사용자 ID를 넣어줄 수 있습니다.
     */
    createdBy?: string | null;
  },
) {
  // ✅ 재생성은 웹훅(세션 없음)에서도 반드시 동작해야 합니다.
  // 따라서 기본은 Service Role Client를 사용합니다.
  const supabase = createServiceClient();

  // 기존 스케줄 정보 조회
  const { data: schedule, error: scheduleError } = await supabase
    .from('schedules')
    .select(`
      *,
      candidates!inner (
        id,
        name,
        email,
        job_posts (
          id,
          title
        )
      )
    `)
    .eq('id', scheduleId)
    .single();

  if (scheduleError || !schedule) {
    throw new Error('면접 일정을 찾을 수 없습니다.');
  }

  // ✅ 세션이 없는 웹훅 경로에서는 접근권한 검증을 생략합니다.
  if (!opts?.bypassAuth) {
    await verifyCandidateAccess(schedule.candidate_id);
  }

  const candidate = schedule.candidates as any;
  const jobPost = candidate.job_posts as { id: string; title: string } | null | undefined;
  const positionName = jobPost?.title || '포지션 미지정';

  // 면접관 정보 조회 (구글 캘린더 연동 정보 포함)
  const { data: interviewers, error: interviewersError } = await supabase
    .from('users')
    .select('id, email, organization_id, calendar_provider, calendar_access_token, calendar_refresh_token')
    .in('id', schedule.interviewer_ids);

  if (interviewersError || !interviewers || interviewers.length !== schedule.interviewer_ids.length) {
    throw new Error('일부 면접관을 찾을 수 없습니다.');
  }

  // 구글 캘린더 연동 확인
  const interviewersWithCalendar = interviewers.filter(
    inv => inv.calendar_provider === 'google' && inv.calendar_access_token && inv.calendar_refresh_token
  );

  if (interviewersWithCalendar.length !== schedule.interviewer_ids.length) {
    const interviewersWithoutCalendar = interviewers.filter(
      inv => !(inv.calendar_provider === 'google' && inv.calendar_access_token && inv.calendar_refresh_token)
    );
    const missingEmails = interviewersWithoutCalendar.map(inv => inv.email).join(', ');
    throw new Error(
      `모든 면접관이 구글 캘린더에 연동되어 있어야 합니다. 연동되지 않은 면접관: ${missingEmails}`
    );
  }

  // 기존 거절된 일정 옵션 조회 (새로운 일정을 찾을 때 제외하기 위해)
  const { data: existingOptions } = await supabase
    .from('schedule_options')
    .select('scheduled_at')
    .eq('schedule_id', scheduleId)
    .in('status', ['rejected', 'pending']); // 거절된 옵션과 대기 중인 옵션 모두 제외

  // ✅ 재생성 옵션 개수는 "최초 설정값"으로 고정합니다.
  // - schedule_options 누적 개수로 계산하면 2→4→6처럼 증가할 수 있어 정책 위반이 됩니다.
  // - 최초 값이 없다면 안전하게 2개를 기본으로 사용합니다.
  const numOptions =
    typeof (schedule as any).initial_num_options === 'number' && (schedule as any).initial_num_options > 0
      ? (schedule as any).initial_num_options
      : 2;

  // 원본 날짜 범위 확인 (없으면 현재 날짜 기준으로 설정)
  const originalStartDate = schedule.original_start_date 
    ? new Date(schedule.original_start_date) 
    : new Date();
  const originalEndDate = schedule.original_end_date 
    ? new Date(schedule.original_end_date) 
    : (() => {
        const end = new Date();
        end.setDate(end.getDate() + 5); // 기본값: 5일 후
        return end;
      })();
  
  // 현재 재시도 횟수 확인
  const currentRetryCount = schedule.retry_count || 0;
  const excludedTimeRanges = readExcludedTimeRangesFromSchedule(schedule);
  
  // 일정 검색 및 날짜 범위 확장 재시도 로직
  let retryCount = currentRetryCount;
  let currentStartDate: Date;
  let currentEndDate: Date;
  let selectedSlots: Array<{ scheduledAt: Date; duration: number; availableInterviewers: string[] }> = [];
  let lastError: Error | null = null;

  // 재시도 횟수에 따라 날짜 범위 계산
  const dateRange = getDateRangeForRetry(originalStartDate, originalEndDate, retryCount);
  currentStartDate = dateRange.startDate;
  currentEndDate = dateRange.endDate;

  while (retryCount <= 5) {
    // 면접관들의 바쁜 시간 조회
    const allBusyTimes: Array<{ start: { dateTime: string; timeZone: string }; end: { dateTime: string; timeZone: string } }> = [];
    
    for (const interviewer of interviewersWithCalendar) {
      try {
        // userId를 전달하여 갱신된 토큰을 DB에 자동 저장
        const token = await refreshAccessTokenIfNeeded(
          interviewer.calendar_access_token!,
          interviewer.calendar_refresh_token!,
          interviewer.id
        );
        
        const busyTimes = await getBusyTimes(
          token,
          ['primary'],
          currentStartDate,
          currentEndDate
        );

        allBusyTimes.push(...busyTimes.map(bt => ({
          start: bt.start,
          end: bt.end,
        })));
      } catch (error) {
        console.error(`면접관 ${interviewer.email}의 캘린더 조회 실패:`, error);
        const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
        throw new Error(
          `면접관 ${interviewer.email}의 캘린더를 조회할 수 없습니다. ` +
          `${errorMessage} ` +
          `면접관이 구글 캘린더를 재연동해야 할 수 있습니다. (/dashboard/connect-calendar)`
        );
      }
    }

    // 기존 거절된 일정 시간대도 바쁜 시간에 추가 (중복 방지)
    if (existingOptions && existingOptions.length > 0) {
      for (const option of existingOptions) {
        const optionStart = new Date(option.scheduled_at);
        const optionEnd = new Date(optionStart);
        optionEnd.setMinutes(optionEnd.getMinutes() + schedule.duration_minutes);
        
        allBusyTimes.push({
          start: { dateTime: optionStart.toISOString(), timeZone: 'Asia/Seoul' },
          end: { dateTime: optionEnd.toISOString(), timeZone: 'Asia/Seoul' },
        });
      }
    }

    // 공통 가능 일정 찾기
    const availableSlots = await findAvailableTimeSlots({
      candidateName: candidate.name,
      stageName: schedule.stage_id,
      interviewerIds: schedule.interviewer_ids,
      busyTimes: allBusyTimes.map(bt => ({
        id: '',
        summary: '',
        start: bt.start,
        end: bt.end,
      })),
      startDate: currentStartDate,
      endDate: currentEndDate,
      durationMinutes: schedule.duration_minutes,
    allowedTimeRanges: undefined,
    excludedTimeRanges,
    });

    // 상위 N개 일정 선택 (기존에 생성된 일정 옵션 개수와 동일하게)
    selectedSlots = availableSlots.slice(0, numOptions);
    
    if (selectedSlots.length > 0) {
      // 일정을 찾았으면 반복문 종료
      console.log(`일정 검색 성공: retryCount=${retryCount}, 날짜 범위=${format(currentStartDate, 'yyyy-MM-dd', { locale: ko })} ~ ${format(currentEndDate, 'yyyy-MM-dd', { locale: ko })}`);
      break;
    }

    // 일정을 찾지 못했고, 재시도 가능한 경우 날짜 범위 확장
    if (shouldExtendDateRange(retryCount)) {
      retryCount++;
      const extended = extendDateRangeByWeek(currentStartDate, currentEndDate);
      currentStartDate = extended.newStartDate;
      currentEndDate = extended.newEndDate;
      console.log(`일정 없음. 날짜 범위 확장 시도 ${retryCount}: ${format(currentStartDate, 'yyyy-MM-dd', { locale: ko })} ~ ${format(currentEndDate, 'yyyy-MM-dd', { locale: ko })}`);
    } else {
      // 최대 재시도 횟수 초과
      lastError = new Error(
        `면접관들의 공통 가능 일정을 찾을 수 없습니다. ` +
        `원본 날짜 범위(${format(originalStartDate, 'yyyy-MM-dd', { locale: ko })} ~ ${format(originalEndDate, 'yyyy-MM-dd', { locale: ko })})부터 ` +
        `총 ${retryCount + 1}회 시도했지만 가능한 일정이 없습니다. 다른 날짜 범위를 선택하거나 면접관을 변경해주세요.`
      );
      break;
    }
  }

  if (selectedSlots.length === 0) {
    throw lastError || new Error('면접관들의 공통 가능 일정을 찾을 수 없습니다. 날짜 범위를 늘리거나 다른 면접관을 선택해주세요.');
  }

  // 각 일정 옵션에 대해 구글 캘린더 block 일정 생성
  const scheduleOptions = [];

  // 웹훅으로 사용할 공개 주소(구글이 호출하는 URL)
  const webhookAddressBase =
    process.env.GOOGLE_CALENDAR_WEBHOOK_URL ||
    (process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/google-calendar-events`
      : '');

  if (!webhookAddressBase) {
    throw new Error(
      '웹훅 주소를 찾을 수 없습니다. `GOOGLE_CALENDAR_WEBHOOK_URL` 또는 `NEXT_PUBLIC_APP_URL`을 .env에 설정해주세요.',
    );
  }

  const webhookAddress = webhookAddressBase.replace(/\/$/, '');
  
  const externalInterviewerEmails = schedule.external_interviewer_emails || [];
  for (const slot of selectedSlots) {
    const endTime = new Date(slot.scheduledAt);
    endTime.setMinutes(endTime.getMinutes() + schedule.duration_minutes);

    // 첫 번째 면접관의 토큰을 사용하여 이벤트 생성 (주최자)
    const organizer = interviewersWithCalendar[0];
    const organizerToken = await refreshAccessTokenIfNeeded(
      organizer.calendar_access_token!,
      organizer.calendar_refresh_token!,
      organizer.id
    );

    // 구글 캘린더에 block 일정 생성
    const createdEvent = await createCalendarEvent(
      organizerToken,
      organizer.calendar_refresh_token!,
      {
        summary: `[Block] ${positionName} - ${candidate.name} 면접 일정 (확정 대기)`,
        description: `포지션: ${positionName}\n후보자: ${candidate.name}\n면접 단계: ${schedule.stage_id}\n\n이 일정은 아직 확정되지 않았습니다. 모든 면접관이 수락하면 후보자에게 전송됩니다.`,
        start: {
          dateTime: slot.scheduledAt.toISOString(),
          timeZone: 'Asia/Seoul',
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: 'Asia/Seoul',
        },
        attendees: [
          ...interviewersWithCalendar.map(inv => ({ email: inv.email })),
          ...externalInterviewerEmails.map((email: string) => ({ email })),
        ],
        transparency: 'opaque',
      }
    );
    const eventId = createdEvent.id;

    // schedule_options에 저장
    const { data: option, error: optionError } = await supabase
      .from('schedule_options')
      .insert({
        schedule_id: scheduleId,
        scheduled_at: slot.scheduledAt.toISOString(),
        status: 'pending',
        google_event_id: eventId,
        interviewer_responses: {},
      })
      .select()
      .single();

    if (optionError || !option) {
      // 이벤트는 생성되었지만 DB 저장 실패 시 이벤트 삭제 시도
      try {
        await deleteCalendarEvent(organizerToken, organizer.calendar_refresh_token!, eventId);
      } catch (deleteError) {
        console.error('이벤트 삭제 실패:', deleteError);
      }
      throw new Error(`일정 옵션 저장 실패: ${optionError?.message || '알 수 없는 오류'}`);
    }

    // 구글 캘린더 이벤트 watch 등록 (웹훅으로 응답 변경 감지)
    // - watch 등록 실패는 일정 생성 실패로 처리하지 않음 (수동 확인/cron으로 대체 가능)
    try {
      if (option.google_event_id) {
        // Google Calendar watch channel id는 길이 제한이 있어(최대 64자),
        // schedule/option UUID를 모두 포함하면 등록이 실패할 수 있습니다.
        const channelId = `calwatch-${randomUUID()}`;
        const watchToken = randomUUID();

        const watchInfo = await watchCalendarEvent(
          organizerToken,
          organizer.calendar_refresh_token!,
          option.google_event_id,
          {
            address: webhookAddress,
            channelId,
            token: watchToken,
          },
        );

        const { error: watchUpdateError } = await supabase
          .from('schedule_options')
          .update({
            watch_channel_id: watchInfo.channelId,
            watch_resource_id: watchInfo.resourceId,
            watch_token: watchToken,
            watch_expiration: watchInfo.expiration ? new Date(watchInfo.expiration) : null,
          })
          .eq('id', option.id);

        if (watchUpdateError) {
          console.error('watch 정보 저장 실패:', watchUpdateError);
        } else {
          (option as any).watch_channel_id = watchInfo.channelId;
          (option as any).watch_resource_id = watchInfo.resourceId;
          (option as any).watch_token = watchToken;
          (option as any).watch_expiration = watchInfo.expiration ? new Date(watchInfo.expiration) : null;
        }
      }
    } catch (watchError) {
      console.error('이벤트 watch 등록 실패 (계속 진행):', watchError);
    }

    scheduleOptions.push(option);
  }

  // 스케줄의 workflow_status를 다시 'pending_interviewers'로 변경 및 재시도 횟수 업데이트
  // original_start_date, original_end_date, retry_count 필드는 마이그레이션이 적용된 경우에만 사용
  const updateData = {
    workflow_status: 'pending_interviewers' as const,
    scheduled_at: selectedSlots[0].scheduledAt.toISOString(), // 첫 번째 옵션으로 업데이트
    // 마이그레이션이 적용된 경우에만 이 필드들을 포함
    retry_count: retryCount,
    original_start_date: schedule.original_start_date || originalStartDate.toISOString(),
    original_end_date: schedule.original_end_date || originalEndDate.toISOString(),
  } as ScheduleUpdate & {
    retry_count?: number;
    original_start_date?: string;
    original_end_date?: string;
  };

  const { error: updateScheduleError } = await supabase
    .from('schedules')
    .update(updateData)
    .eq('id', scheduleId);

  if (updateScheduleError) {
    console.error('스케줄 workflow_status 업데이트 실패:', updateScheduleError);
    throw new Error(`스케줄 상태 업데이트 실패: ${updateScheduleError.message}`);
  }

  // 면접관들에게 새로운 일정 확인 안내 메일 발송
  const organizer = interviewersWithCalendar[0];
  if (organizer.calendar_access_token && organizer.calendar_refresh_token && organizer.email) {
    // stage ID를 프로세스 이름으로 변환
    const stageName = getStageNameByStageId(schedule.stage_id) || schedule.stage_id;
    
    const optionsListHtml = scheduleOptions.map((opt, index) => {
      // ✅ 메일 표기는 KST로 통일
      const dateKst = toZonedTime(new Date(opt.scheduled_at), KST_TIMEZONE);
      const endTimeKst = new Date(dateKst);
      endTimeKst.setMinutes(endTimeKst.getMinutes() + schedule.duration_minutes);
      
      return `
        <div style="margin: 15px 0; padding: 15px; background-color: #f5f5f5; border-radius: 5px;">
          <p style="margin: 0; font-weight: bold; color: #333;">
            옵션 ${index + 1}: ${format(dateKst, 'yyyy년 MM월 dd일 (EEE) HH:mm', { locale: ko })} - ${format(endTimeKst, 'HH:mm', { locale: ko })}
          </p>
        </div>
      `;
    }).join('');

    const notificationMessage = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: 'Malgun Gothic', Arial, sans-serif; line-height: 1.6; color: #333; }
        </style>
      </head>
      <body>
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">
            새로운 면접 일정 확인 요청
          </h2>
          
          <p style="font-size: 16px; margin-top: 20px;">
            안녕하세요,
          </p>
          
          <p style="font-size: 14px; margin-top: 15px;">
            이전 일정 옵션이 모두 거절되어 <strong>${candidate.name}</strong>님의 새로운 면접 일정 옵션이 생성되었습니다. 
            구글 캘린더에 초대가 전송되었으니 확인 후 수락 또는 거절해주시기 바랍니다.
          </p>
          
          <div style="margin: 25px 0; padding: 20px; background-color: #f0f9ff; border-left: 4px solid #2563eb; border-radius: 5px;">
            <p style="margin: 0 0 10px 0; font-weight: bold; color: #1e40af;">
              면접 정보
            </p>
            <p style="margin: 5px 0; font-size: 14px;">
              <strong>포지션:</strong> ${positionName}
            </p>
            <p style="margin: 5px 0; font-size: 14px;">
              <strong>후보자:</strong> ${candidate.name}
            </p>
            <p style="margin: 5px 0; font-size: 14px;">
              <strong>면접 단계:</strong> ${stageName}
            </p>
            <p style="margin: 5px 0; font-size: 14px;">
              <strong>면접 시간:</strong> ${schedule.duration_minutes}분
            </p>
          </div>
          
          <div style="margin: 25px 0;">
            <p style="font-weight: bold; color: #333; margin-bottom: 10px;">
              새로 생성된 일정 옵션:
            </p>
            ${optionsListHtml}
          </div>
          
          <div style="margin: 30px 0; padding: 15px; background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 5px;">
            <p style="margin: 0; font-size: 14px; color: #92400e;">
              <strong>⚠️ 중요:</strong> 구글 캘린더에서 각 일정 초대에 대해 수락 또는 거절을 선택해주세요. 
              모든 면접관이 수락한 일정이 후보자에게 전송됩니다.
            </p>
          </div>
          
          <p style="margin-top: 30px; font-size: 14px; color: #666;">
            구글 캘린더에서 일정을 확인하고 응답해주시기 바랍니다.
          </p>
          
          <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
          <p style="font-size: 12px; color: #999; text-align: center;">
            이 메일은 VNTG ATS 시스템에서 자동으로 발송되었습니다.
          </p>
        </div>
      </body>
      </html>
    `;

    // 모든 면접관에게 안내 메일 발송
    for (const interviewer of interviewersWithCalendar) {
      if (interviewer.email) {
        try {
          await sendEmailViaGmail(
            organizer.calendar_access_token,
            organizer.calendar_refresh_token,
            {
              to: interviewer.email,
              from: organizer.email,
              subject: `[새로운 면접 일정 확인 요청] ${candidate.name}님의 면접 일정이 재생성되었습니다`,
              html: notificationMessage,
              replyTo: organizer.email,
            }
          );
          console.log(`면접관 ${interviewer.email}에게 새로운 일정 안내 메일 발송 완료`);
        } catch (error) {
          console.error(`면접관 ${interviewer.email}에게 안내 메일 발송 실패:`, error);
          // 메일 발송 실패해도 일정 생성은 성공한 것으로 처리
        }
      }
    }
  }

  // 타임라인 이벤트 생성
  const timelineMessage = retryCount > currentRetryCount
    ? `이전 일정 옵션이 모두 거절되어 새로운 면접 일정 옵션이 자동으로 생성되었습니다. 날짜 범위를 ${retryCount - currentRetryCount}회 확장하여 검색했습니다.`
    : '이전 일정 옵션이 모두 거절되어 새로운 면접 일정 옵션이 자동으로 생성되었습니다.';
  
  console.log(`[타임라인] 일정 재생성 → 자동화 카드 업데이트: candidateId=${schedule.candidate_id}, scheduleId=${scheduleId}`);

  // ✅ 타임라인은 새 줄을 쌓지 않고, 기존 "면접 일정 생성" 카드의 상태를 갱신합니다.
  try {
    await upsertScheduleAutomationTimeline({
      candidateId: schedule.candidate_id,
      scheduleId,
      // 웹훅/백그라운드에서는 createdBy를 전달받고, 없으면 null로 둡니다.
      createdBy: (opts?.createdBy ?? null) as any,
      latestMessage: timelineMessage,
      automationStatus: 'regenerated',
      scheduleOptions: scheduleOptions.map((opt) => ({
        id: opt.id,
        scheduled_at: opt.scheduled_at,
      })),
      appendHistory: [
        {
          at: new Date().toISOString(),
          message: '이전 일정 옵션이 모두 거절되어 새 일정 옵션을 자동으로 재생성했습니다.',
        },
      ],
      extraContent: {
        interviewers: schedule.interviewer_ids,
        retry_count: retryCount,
        previous_retry_count: currentRetryCount,
      },
    });
  } catch (e) {
    console.error('[타임라인] 일정 재생성 카드 업데이트 실패(계속 진행):', e);
  }

  // 캐시 무효화
  revalidatePath('/dashboard/calendar');
  revalidatePath(`/dashboard/candidates/${schedule.candidate_id}`);
  revalidatePath('/dashboard/schedules');

  return {
    scheduleId,
    options: scheduleOptions,
    message: `${selectedSlots.length}개의 새로운 일정 옵션이 생성되었고, 면접관들에게 초대가 전송되었습니다.`,
  };
}

/**
 * 면접관 응답 상태 확인
 * 구글 캘린더 API로 각 block 일정의 참석자 응답 확인
 * 모두 수락한 일정이 있으면 후보자에게 전송
 */
export async function checkInterviewerResponses(
  scheduleId: string,
  opts?: {
    // 웹훅 경로에서는 세션이 없으므로 인증/접근권한 검증을 생략합니다.
    bypassAuth?: boolean;
  },
) {
  return withErrorHandling(async () => {
    // 웹훅/서버 내부 처리에서는 세션이 없으므로 Service Role Client로 RLS를 우회합니다.
    const supabase = createServiceClient();

    // 스케줄 및 옵션 조회
    const { data: schedule, error: scheduleError } = await supabase
      .from('schedules')
      .select(`
        *,
        candidates!inner (
          id,
          name,
          email,
          token
        )
      `)
      .eq('id', scheduleId)
      .single();

    if (scheduleError || !schedule) {
      throw new Error('면접 일정을 찾을 수 없습니다.');
    }

    if (!opts?.bypassAuth) {
      await verifyCandidateAccess(schedule.candidate_id);
    }

    // workflow_status가 pending_interviewers가 아니면 확인 불필요
    if (schedule.workflow_status !== 'pending_interviewers') {
      return { message: '이미 처리된 일정입니다.', alreadyProcessed: true };
    }

    // ✅ 타임라인은 "새 이벤트 추가"가 아니라 "자동화 카드 1개 업데이트"가 목표입니다.
    // - 면접관 응답 변경/전원 거절/재생성/혼합 응답 등 중요한 변화는 history로 누적합니다.
    // ✅ history에 멱등 키(key)를 넣어 중복 웹훅 호출에도 같은 로그가 2번 쌓이지 않게 합니다.
    const timelineHistory: Array<{ at: string; message: string; key?: string }> = [];
    const nowIso = new Date().toISOString();

    // 일정 옵션 조회
    const { data: options, error: optionsError } = await supabase
      .from('schedule_options')
      .select('*')
      .eq('schedule_id', scheduleId)
      .eq('status', 'pending');

    if (optionsError || !options || options.length === 0) {
      throw new Error('일정 옵션을 찾을 수 없습니다.');
    }

    // 면접관 정보 조회
    const { data: interviewers } = await supabase
      .from('users')
      .select('id, email, calendar_access_token, calendar_refresh_token')
      .in('id', schedule.interviewer_ids);

    if (!interviewers || interviewers.length === 0) {
      throw new Error('면접관 정보를 찾을 수 없습니다.');
    }

    // 각 옵션의 면접관 응답 확인
    let allAcceptedOption: typeof options[0] | null = null;
    type UpdatedOption = {
      id: string;
      googleEventExists: boolean;
      allDeclined: boolean;
      hasAnyDeclined: boolean;
      hasAllResponded: boolean;
    };
    const updatedOptions: UpdatedOption[] = [];

    for (const option of options) {
      if (!option.google_event_id) {
        updatedOptions.push({
          id: option.id,
          googleEventExists: false,
          allDeclined: false,
          hasAnyDeclined: false,
          hasAllResponded: false,
        });
        continue;
      }

      // 첫 번째 면접관의 토큰 사용
      const organizer = interviewers.find(inv => inv.calendar_access_token);
      if (!organizer || !organizer.calendar_access_token || !organizer.calendar_refresh_token) {
        updatedOptions.push({
          id: option.id,
          googleEventExists: true,
          allDeclined: false,
          hasAnyDeclined: false,
          hasAllResponded: false,
        });
        continue;
      }

      try {
        const responses = await getEventAttendeesStatus(
          organizer.calendar_access_token,
          organizer.calendar_refresh_token,
          option.google_event_id
        );

        // 옵션의 이전 저장값(변경 감지 및 부분 충돌 메타데이터 보존용)
        const previousResponsesAny = (option.interviewer_responses as any) || {};
        const previousMetadata = previousResponsesAny?._metadata;

        // 부분 충돌로 인해 "초대에서 제외된 면접관"은 completion 판정에서 제외합니다.
        const missingInterviewers = Array.isArray(previousMetadata?.missingInterviewers)
          ? (previousMetadata.missingInterviewers as string[])
          : [];
        const activeInterviewers = interviewers.filter((inv) => !missingInterviewers.includes(inv.id));

        // 면접관별 응답 상태 업데이트
        const interviewerResponses: Record<string, string> = {};
        let allAccepted = activeInterviewers.length > 0;
        let allDeclined = activeInterviewers.length > 0;
        let hasAllResponded = activeInterviewers.length > 0;
        let hasAnyDeclined = false;

        for (const interviewer of interviewers) {
          const response = responses[interviewer.email] || 'needsAction';
          interviewerResponses[interviewer.id] = response;

          // 제외된 면접관은 "전원 수락/거절/완료" 판정에서 제외합니다.
          if (missingInterviewers.includes(interviewer.id)) continue;

          if (response !== 'accepted') {
            allAccepted = false;
          }

          if (response !== 'declined') {
            allDeclined = false;
          }

          // ✅ 응답 완료 판정은 더 엄격하게:
          // - needsAction: 미응답
          // - tentative: 보류(확정 응답 아님) → 대기로 처리
          if (response === 'needsAction' || response === 'tentative') {
            hasAllResponded = false;
          }

          // ✅ “한 명이라도 거절이면 해당 옵션은 불가”
          if (response === 'declined') {
            hasAnyDeclined = true;
          }
        }
        
        // DB에 응답 상태 저장
        const interviewerResponsesToStore = previousMetadata
          ? { _metadata: previousMetadata, ...interviewerResponses }
          : interviewerResponses;

        const { error: updateError } = await supabase
          .from('schedule_options')
          .update({ interviewer_responses: interviewerResponsesToStore })
          .eq('id', option.id);

        if (updateError) {
          console.error(`옵션 ${option.id}의 응답 상태 업데이트 실패:`, updateError);
        } else {
          console.log(`옵션 ${option.id}의 응답 상태 업데이트 완료:`, interviewerResponses);
          
          // 면접관 응답이 변경된 경우 타임라인 이벤트 생성
          const changedResponses: Array<{
            interviewerId: string;
            interviewerEmail: string;
            previousResponse: string;
            newResponse: string;
          }> = [];

          for (const interviewer of interviewers) {
            const previousResponse = previousResponsesAny[interviewer.id] || 'needsAction';
            const newResponse = interviewerResponses[interviewer.id] || 'needsAction';
            
            if (previousResponse !== newResponse && newResponse !== 'needsAction') {
              changedResponses.push({
                interviewerId: interviewer.id,
                interviewerEmail: interviewer.email,
                previousResponse,
                newResponse,
              });
            }
          }
          
          // ✅ 변경된 응답은 새 타임라인 이벤트를 insert하지 않고, 자동화 카드(history)에 누적합니다.
          if (changedResponses.length > 0) {
            console.log(`[타임라인] 변경된 응답 ${changedResponses.length}개 발견 (카드 history로 누적)`);
            for (const changed of changedResponses) {
              const responseText =
                changed.newResponse === 'accepted'
                  ? '수락'
                  : changed.newResponse === 'declined'
                    ? '거절'
                    : '보류';
              // ✅ 타임라인 표기는 KST로 통일 (서버 타임존이 UTC여도 깨지지 않게)
              const optionKst = formatInKst(option.scheduled_at, 'yyyy-MM-dd HH:mm');
              const msg = `${changed.interviewerEmail}님이 일정 옵션(${optionKst})을 ${responseText}했습니다.`;
              // ✅ 웹훅 중복 호출에도 같은 변경은 1번만 누적되도록 멱등 키를 부여합니다.
              const historyKey = `interviewer_response::${option.id}::${changed.interviewerId}::${changed.newResponse}`;
              timelineHistory.push({ at: new Date().toISOString(), message: msg, key: historyKey });
            }
          } else {
            console.log(
              `[타임라인] 변경된 응답 없음 (previous: ${JSON.stringify(previousResponsesAny)}, current: ${JSON.stringify(interviewerResponses)})`,
            );
          }
        }

        // 모든 면접관이 수락한 경우
        if (allAccepted && !allAcceptedOption) {
          console.log(`모든 면접관이 수락한 일정 옵션 발견: ${option.id} (${option.scheduled_at})`);
          allAcceptedOption = option;
        }

        // 옵션 상태 업데이트 정보 저장
        updatedOptions.push({
          id: option.id,
          googleEventExists: true,
          allDeclined,
          hasAnyDeclined,
          hasAllResponded,
        });
      } catch (error) {
        console.error(`옵션 ${option.id}의 응답 확인 실패:`, error);
        // 에러가 발생해도 다른 옵션은 계속 확인
        updatedOptions.push({
          id: option.id,
          googleEventExists: true,
          allDeclined: false,
          hasAnyDeclined: false,
          hasAllResponded: false,
        });
      }
    }

    // ✅ 면접관 응답 요약(카드 표시용)
    // - 여러 옵션이 존재하므로, 면접관 기준으로 "어떤 옵션이든 수락했는지 / 모든 옵션을 거절했는지"로 요약합니다.
    // - pending: 아직 선택을 안 했거나(tentative/needsAction), 옵션별로 혼합 응답인 상태
    const activeInterviewerIds = (() => {
      // 부분 충돌(초대 제외 면접관)은 옵션마다 다를 수 있어, 여기서는 "전체 면접관" 기준으로 요약합니다.
      // 실제 UI에서는 옵션별 상세가 필요하면 content 확장으로 처리할 수 있습니다.
      return (schedule.interviewer_ids as string[]) || [];
    })();

    const interviewerSummary = (() => {
      const summaryByInterviewer = new Map<
        string,
        { acceptedAny: boolean; declinedAll: boolean; hasPending: boolean }
      >();
      for (const id of activeInterviewerIds) {
        summaryByInterviewer.set(id, { acceptedAny: false, declinedAll: true, hasPending: false });
      }

      for (const opt of options) {
        const responsesAny = (opt.interviewer_responses as any) || {};
        const metadata = responsesAny?._metadata;
        const missingInterviewers = Array.isArray(metadata?.missingInterviewers)
          ? (metadata.missingInterviewers as string[])
          : [];

        for (const interviewerId of activeInterviewerIds) {
          // 옵션에서 초대 제외된 면접관은 이 옵션의 응답 판단에서 제외합니다.
          if (missingInterviewers.includes(interviewerId)) continue;

          const r = (responsesAny[interviewerId] as string | undefined) || 'needsAction';
          const row = summaryByInterviewer.get(interviewerId);
          if (!row) continue;

          if (r === 'accepted') row.acceptedAny = true;
          if (r !== 'declined') row.declinedAll = false;
          if (r === 'needsAction' || r === 'tentative') row.hasPending = true;
        }
      }

      let accepted = 0;
      let declined = 0;
      let pending = 0;

      for (const row of summaryByInterviewer.values()) {
        if (row.acceptedAny) accepted++;
        else if (row.declinedAll) declined++;
        else pending++;
      }

      return {
        accepted,
        declined,
        pending,
        total: activeInterviewerIds.length,
      };
    })();

    // 모든 면접관이 수락한 일정이 있으면 후보자에게 전송
    if (allAcceptedOption) {
      console.log(`모든 면접관이 수락한 일정이 있어 후보자에게 전송 시작: scheduleId=${scheduleId}, optionId=${allAcceptedOption.id}`);
      
      // ✅ 전원 수락 이벤트도 새 줄로 쌓지 않고, 자동화 카드(history)에 누적합니다.
      const optionKst = formatInKst(allAcceptedOption.scheduled_at, 'yyyy-MM-dd HH:mm');
      const allAcceptedMsg = `모든 면접관이 일정 옵션(${optionKst})을 수락했습니다. 후보자에게 전송됩니다.`;
      // ✅ 전원 수락 메시지도 중복 누적 방지(멱등 키)
      const allAcceptedKey = `all_accepted::${allAcceptedOption.id}`;
      timelineHistory.push({ at: nowIso, message: allAcceptedMsg, key: allAcceptedKey });
      
      try {
        // 후보자에게 일정 옵션 전송
        const sendResult = await sendScheduleOptionsToCandidate(scheduleId);
        console.log('후보자에게 일정 옵션 전송 완료:', sendResult);
        
        // 캐시 무효화하여 최신 상태 반영
        revalidatePath(`/dashboard/candidates/${schedule.candidate_id}`);
        revalidatePath('/dashboard/schedules');
        
        // 이메일 발송 실패 시 경고 메시지 포함
        if (sendResult.data && !sendResult.data.emailSent) {
          return {
            message: '모든 면접관이 수락한 일정이 있습니다. 하지만 이메일 발송에 실패했습니다. 메일 재전송 버튼을 사용해주세요.',
            allAccepted: true,
            acceptedOptionId: allAcceptedOption.id,
            emailSent: false,
            error: sendResult.data.error,
          };
        }
        
        // 타임라인 카드 업데이트 (상태: pending_candidate)
        try {
          await upsertScheduleAutomationTimeline({
            candidateId: schedule.candidate_id,
            scheduleId,
            createdBy: (interviewers.find((inv) => inv.calendar_access_token)?.id || interviewers[0]?.id || null) as any,
            latestMessage: '모든 면접관이 수락한 일정이 있어 후보자에게 전송되었습니다.',
            automationStatus: 'pending_candidate',
            scheduleOptions: options.map((opt) => ({ id: opt.id, scheduled_at: opt.scheduled_at })),
            interviewerSummary,
            appendHistory: [
              ...timelineHistory,
              { at: nowIso, message: '후보자에게 일정 선택 링크를 발송했습니다.' },
            ],
            extraContent: { all_accepted: true, accepted_option_id: allAcceptedOption.id },
          });
        } catch (e) {
          console.error('[타임라인] 전원 수락 후 카드 업데이트 실패(계속 진행):', e);
        }

        return {
          message: '모든 면접관이 수락한 일정이 있습니다. 후보자에게 전송되었습니다.',
          allAccepted: true,
          acceptedOptionId: allAcceptedOption.id,
          emailSent: true,
        };
      } catch (error) {
        console.error('후보자에게 일정 옵션 전송 실패:', error);
        // 메일 전송 실패해도 응답 상태는 업데이트되었으므로 경고만 반환
        revalidatePath(`/dashboard/candidates/${schedule.candidate_id}`);
        revalidatePath('/dashboard/schedules');
        
        return {
          message: '모든 면접관이 수락한 일정이 있습니다. 하지만 이메일 발송에 실패했습니다. 메일 재전송 버튼을 사용해주세요.',
          allAccepted: true,
          acceptedOptionId: allAcceptedOption.id,
          emailSent: false,
          error: error instanceof Error ? error.message : '알 수 없는 오류',
        };
      }
    }

    // 전원 수락 옵션이 없으므로 "전원 응답 완료" 여부를 기준으로 다음 단계를 결정합니다.
    const optionsWithGoogle = updatedOptions.filter((opt) => opt.googleEventExists);

    const allOptionsResponded = optionsWithGoogle.length > 0 && optionsWithGoogle.every((opt) => opt.hasAllResponded);

    if (!allOptionsResponded) {
      console.log(`아직 일부 옵션의 응답이 남아있습니다. scheduleId=${scheduleId}`);
      // 타임라인 카드 업데이트: 아직 대기 중
      try {
        await upsertScheduleAutomationTimeline({
          candidateId: schedule.candidate_id,
          scheduleId,
          createdBy: (interviewers.find((inv) => inv.calendar_access_token)?.id || interviewers[0]?.id || null) as any,
          latestMessage: '아직 모든 면접관의 응답이 완료되지 않았습니다. 계속 대기 중입니다.',
          automationStatus: 'pending_interviewers',
          scheduleOptions: options.map((opt) => ({ id: opt.id, scheduled_at: opt.scheduled_at })),
          interviewerSummary,
          appendHistory: timelineHistory.length > 0 ? timelineHistory : undefined,
        });
      } catch (e) {
        console.error('[타임라인] 대기 상태 카드 업데이트 실패(계속 진행):', e);
      }
      revalidatePath(`/dashboard/candidates/${schedule.candidate_id}`);
      revalidatePath('/dashboard/schedules');
      return {
        message: '아직 모든 면접관의 응답이 완료되지 않았습니다. 계속 대기 중입니다.',
        allAccepted: false,
        allDeclined: false,
      };
    }

    // allOptionsResponded=true 인 경우:
    // 1) 모든 옵션이 전원 거절이거나, “한 명이라도 거절이면 옵션 불가” 규칙 때문에 모든 옵션이 불가해진 경우:
    //    - 후보자에게 전송 가능한 옵션이 없으므로 자동 재생성(regenerate)
    // 2) 그 외(혼합 케이스)이면: needs_rescheduling으로 전환하고 채용담당자 액션을 기다립니다.
    const allOptionsDeclined = optionsWithGoogle.every((opt) => opt.allDeclined);
    const allOptionsInvalidByAnyDecline = optionsWithGoogle.every((opt) => opt.hasAnyDeclined);

    if (allOptionsDeclined || allOptionsInvalidByAnyDecline) {
      console.log(
        `재조율 필요(전원 거절 또는 1명 이상 거절로 옵션 불가): scheduleId=${scheduleId}, 옵션 수=${optionsWithGoogle.length}`,
      );

      const declinedOptionIds = optionsWithGoogle.map((opt) => opt.id);
      const { error: updateStatusError } = await supabase
        .from('schedule_options')
        .update({ status: 'rejected' })
        .in('id', declinedOptionIds);

      if (updateStatusError) {
        console.error('거절된 옵션 status 업데이트 실패:', updateStatusError);
      } else {
        console.log(`거절된 옵션 ${declinedOptionIds.length}개의 status를 'rejected'로 업데이트 완료`);
      }

      try {
        // ✅ 전원 거절 감지 → 재생성 시작을 같은 자동화 카드(history)에 기록합니다.
        try {
          await upsertScheduleAutomationTimeline({
            candidateId: schedule.candidate_id,
            scheduleId,
            createdBy: (interviewers.find((inv) => inv.calendar_access_token)?.id || interviewers[0]?.id || null) as any,
            latestMessage:
              allOptionsDeclined
                ? '모든 일정 옵션이 전원 거절되어 새로운 일정 옵션을 자동으로 생성합니다.'
                : '일정 옵션에 “거절”이 포함되어(한 명이라도 거절) 후보자에게 전송할 수 없어, 새로운 일정 옵션을 자동으로 생성합니다.',
            automationStatus: 'pending_interviewers',
            scheduleOptions: options.map((opt) => ({ id: opt.id, scheduled_at: opt.scheduled_at })),
            interviewerSummary,
            appendHistory: [
              ...timelineHistory,
              {
                at: nowIso,
                message: allOptionsDeclined
                  ? '모든 일정 옵션이 전원 거절되어 재생성을 시작합니다.'
                  : '일정 옵션에 거절이 포함되어(한 명이라도 거절) 재생성을 시작합니다.',
              },
            ],
          });
        } catch (e) {
          console.error('[타임라인] 전원 거절 감지 카드 업데이트 실패(계속 진행):', e);
        }

        console.log(`새로운 일정 옵션 자동 생성 시작: scheduleId=${scheduleId}`);
        // ✅ 동시 웹훅/중복 호출에도 재생성이 2번 실행되지 않도록 락을 잡습니다.
        // - pending_interviewers → regenerating 으로 원자적 전이를 시도
        // - 성공한 1개의 요청만 재생성을 수행
        const { data: lockedRows, error: lockError } = await supabase
          .from('schedules')
          .update({ workflow_status: 'regenerating' as any })
          .eq('id', scheduleId)
          .eq('workflow_status', 'pending_interviewers')
          .select('id');

        if (lockError) {
          console.error('재생성 락 획득 실패(웹훅):', lockError);
        }

        if (!lockedRows || lockedRows.length === 0) {
          // 이미 다른 요청이 재생성을 시작한 경우
          revalidatePath(`/dashboard/candidates/${schedule.candidate_id}`);
          revalidatePath('/dashboard/schedules');
          return {
            message: '이미 일정 재생성이 진행 중입니다. 잠시 후 다시 확인해주세요.',
            allAccepted: false,
            allDeclined: true,
            regenerated: false,
          };
        }

        // ✅ 웹훅/백그라운드 경로에서는 세션이 없으므로 bypassAuth로 실행합니다.
        const regenerateResult = await regenerateScheduleOptions(scheduleId, {
          bypassAuth: true,
          createdBy: (interviewers.find((inv) => inv.calendar_access_token)?.id || interviewers[0]?.id || null) as any,
        });

        revalidatePath(`/dashboard/candidates/${schedule.candidate_id}`);
        revalidatePath('/dashboard/schedules');

        return {
          message:
            regenerateResult.message ||
            '모든 일정 옵션이 거절되어 새로운 일정 옵션이 자동으로 생성되었습니다.',
          allAccepted: false,
          allDeclined: true,
          regenerated: true,
        };
      } catch (regenerateError) {
        console.error('새로운 일정 옵션 생성 실패:', regenerateError);

        const { error: updateScheduleError } = await supabase
          .from('schedules')
          .update({ workflow_status: 'cancelled' })
          .eq('id', scheduleId);

        if (updateScheduleError) {
          console.error('스케줄 workflow_status 업데이트 실패:', updateScheduleError);
        }

        revalidatePath(`/dashboard/candidates/${schedule.candidate_id}`);
        revalidatePath('/dashboard/schedules');

        return {
          message: `모든 일정 옵션이 거절되었지만 새로운 일정을 찾을 수 없습니다: ${
            regenerateError instanceof Error ? regenerateError.message : '알 수 없는 오류'
          }. 면접 일정이 취소되었습니다.`,
          allAccepted: false,
          allDeclined: true,
          regenerated: false,
          error: regenerateError instanceof Error ? regenerateError.message : '알 수 없는 오류',
        };
      }
    }

    // (2) 혼합 케이스: 전원 응답 완료, 하지만 전원 수락 옵션은 없음
    console.log(`혼합 응답 처리 필요: scheduleId=${scheduleId}`);

    const organizer = interviewers.find((inv) => inv.calendar_access_token) || interviewers[0];
    const organizerId = organizer?.id || null;

    // 스케줄 상태를 needs_rescheduling으로 전환하여 채용담당자가 다시 자동화를 실행할 수 있게 합니다.
    const { error: updateScheduleError } = await supabase
      .from('schedules')
      .update({
        workflow_status: 'needs_rescheduling',
        needs_rescheduling: true,
        rescheduling_reason: '면접관 응답이 혼합되어 전원 수락 옵션이 존재하지 않음',
      })
      .eq('id', scheduleId);

    if (updateScheduleError) {
      console.error('혼합 케이스 스케줄 상태 전환 실패:', updateScheduleError);
    }

    // ✅ 혼합 응답도 새 줄을 추가하지 않고, 자동화 카드 상태를 needs_rescheduling으로 갱신합니다.
    try {
      await upsertScheduleAutomationTimeline({
        candidateId: schedule.candidate_id,
        scheduleId,
        createdBy: organizerId,
        latestMessage:
          '면접관들의 응답이 모두 확인되었지만, 후보자에게 전송 가능한 "전원 수락" 일정 옵션이 없습니다. 재조율이 필요합니다.',
        automationStatus: 'needs_rescheduling',
        scheduleOptions: options.map((opt) => ({ id: opt.id, scheduled_at: opt.scheduled_at })),
        interviewerSummary,
        appendHistory: [
          ...timelineHistory,
          {
            at: nowIso,
            message:
              '면접관 응답이 혼합되어 전원 수락 옵션이 없어서 재조율이 필요합니다. (needs_rescheduling)',
          },
        ],
      });
    } catch (e) {
      console.error('[타임라인] 혼합 응답 카드 업데이트 실패(계속 진행):', e);
    }

    revalidatePath(`/dashboard/candidates/${schedule.candidate_id}`);
    revalidatePath('/dashboard/schedules');

    return {
      message:
        '면접관 응답이 모두 확인되었지만 전원 수락 옵션이 없습니다. needs_rescheduling 상태로 전환했습니다.',
      allAccepted: false,
      allDeclined: false,
      mixedResponses: true,
    };
  });
}

/**
 * 모든 대기 중인 면접 일정의 응답을 일괄 확인
 * workflow_status가 pending_interviewers인 모든 일정의 응답을 확인
 */
export async function checkAllPendingSchedules() {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const isAdmin = user.role === 'admin';
    
    // 관리자일 경우 Service Role Client를 사용하여 RLS 정책 우회
    const supabase = isAdmin ? createServiceClient() : await createClient();

    // organization_id에 속한 job_posts 조회
    let jobPostsQuery = supabase
      .from('job_posts')
      .select('id');
    
    if (!isAdmin) {
      jobPostsQuery = jobPostsQuery.eq('organization_id', user.organizationId);
    }
    
    const { data: jobPosts } = await jobPostsQuery;

    if (!jobPosts || jobPosts.length === 0) {
      return {
        checked: 0,
        allAccepted: 0,
        stillPending: 0,
        errors: [],
      };
    }

    const jobPostIds = jobPosts.map(jp => jp.id);

    // 해당 job_posts의 후보자들 조회
    const { data: candidates } = await supabase
      .from('candidates')
      .select('id')
      .in('job_post_id', jobPostIds);

    if (!candidates || candidates.length === 0) {
      return {
        checked: 0,
        allAccepted: 0,
        stillPending: 0,
        errors: [],
      };
    }

    const candidateIds = candidates.map(c => c.id);

    // pending_interviewers 상태인 모든 일정 조회
    const { data: pendingSchedules, error } = await supabase
      .from('schedules')
      .select('id, candidate_id')
      .in('candidate_id', candidateIds)
      .eq('workflow_status', 'pending_interviewers');

    if (error) {
      throw new Error(`대기 중인 일정 조회 실패: ${error.message}`);
    }

    if (!pendingSchedules || pendingSchedules.length === 0) {
      return {
        checked: 0,
        allAccepted: 0,
        stillPending: 0,
        errors: [],
      };
    }

    // 각 일정의 응답 확인
    let allAcceptedCount = 0;
    let stillPendingCount = 0;
    const errors: Array<{ scheduleId: string; error: string }> = [];

    for (const schedule of pendingSchedules) {
      try {
        const result = await checkInterviewerResponses(schedule.id);
        if (result.data?.allAccepted) {
          allAcceptedCount++;
        } else {
          stillPendingCount++;
        }
      } catch (error) {
        errors.push({
          scheduleId: schedule.id,
          error: error instanceof Error ? error.message : '알 수 없는 오류',
        });
      }
    }

    // 캐시 무효화
    revalidatePath('/dashboard/schedules');
    pendingSchedules.forEach(schedule => {
      revalidatePath(`/dashboard/candidates/${schedule.candidate_id}`);
    });

    return {
      checked: pendingSchedules.length,
      allAccepted: allAcceptedCount,
      stillPending: stillPendingCount,
      errors,
    };
  });
}

/**
 * 후보자에게 일정 옵션 전송
 * 이메일 발송 및 일정 선택 링크 포함
 */
export async function sendScheduleOptionsToCandidate(scheduleId: string) {
  return withErrorHandling(async () => {
    // 웹훅/서버 내부 처리에서는 세션이 없으므로 Service Role로 처리합니다.
    const supabase = createServiceClient();

    // 스케줄 및 후보자 정보 조회
    const { data: schedule, error: scheduleError } = await supabase
      .from('schedules')
      .select(`
        *,
        candidates!inner (
          id,
          name,
          email,
          token
        )
      `)
      .eq('id', scheduleId)
      .single();

    if (scheduleError || !schedule) {
      throw new Error('면접 일정을 찾을 수 없습니다.');
    }

    const candidate = schedule.candidates as { id: string; name: string; email: string; token: string } | null | undefined;
    if (!candidate) {
      throw new Error('후보자 정보를 찾을 수 없습니다.');
    }

    // 스케줄의 "주최자(organizer)"를 찾아 Gmail API 발송에 사용할 토큰을 얻습니다.
    const { data: interviewers } = await supabase
      .from('users')
      .select('id, email, calendar_access_token, calendar_refresh_token')
      .in('id', schedule.interviewer_ids);

    if (!interviewers || interviewers.length === 0) {
      throw new Error('면접관 정보를 찾을 수 없습니다.');
    }

    const organizer = interviewers.find(
      (inv: any) => inv.calendar_access_token && inv.calendar_refresh_token,
    );

    if (!organizer || !organizer.calendar_access_token || !organizer.calendar_refresh_token) {
      throw new Error('주최자 면접관의 Google Workspace 연동 정보가 없습니다. 구글 캘린더를 먼저 연동해주세요.');
    }

    const organizerAccessToken = await refreshAccessTokenIfNeeded(
      organizer.calendar_access_token,
      organizer.calendar_refresh_token,
      organizer.id,
    );

    // 모든 면접관이 수락한 일정 옵션 조회 (pending 또는 accepted 상태 모두 포함)
    const { data: options, error: optionsError } = await supabase
      .from('schedule_options')
      .select('*')
      .eq('schedule_id', scheduleId)
      .in('status', ['pending', 'accepted'])
      .order('scheduled_at', { ascending: true });

    if (optionsError || !options || options.length === 0) {
      throw new Error('일정 옵션을 찾을 수 없습니다.');
    }

    // "초대에서 제외된 면접관(부분 충돌)"은 completion 판정에서 제외합니다.
    // 즉, activeInterviewers(제외 면접관 제외) 전원이 accepted일 때만 후보자에게 전송합니다.
    const acceptedOptions: typeof options = [];
    for (const option of options) {
      if (!option.interviewer_responses || typeof option.interviewer_responses !== 'object') continue;

      const responsesAny = option.interviewer_responses as any;
      const metadata = responsesAny?._metadata;
      const missingInterviewers = Array.isArray(metadata?.missingInterviewers)
        ? (metadata.missingInterviewers as string[])
        : [];

      const activeInterviewers = schedule.interviewer_ids.filter(
        (interviewerId: string) => !missingInterviewers.includes(interviewerId),
      );

      if (activeInterviewers.length === 0) continue;

      const allAccepted = activeInterviewers.every(
        (interviewerId: string) => responsesAny[interviewerId] === 'accepted',
      );

      if (allAccepted) acceptedOptions.push(option);
    }

    if (acceptedOptions.length === 0) {
      throw new Error('모든 면접관이 수락한 일정 옵션이 없습니다.');
    }

    // 모든 면접관이 수락한 옵션의 status를 'accepted'로 업데이트 (후보자에게 전송할 옵션임을 표시)
    const acceptedOptionIds = acceptedOptions.map(opt => opt.id);
    const { error: updateStatusError } = await supabase
      .from('schedule_options')
      .update({ status: 'accepted' })
      .in('id', acceptedOptionIds);

    if (updateStatusError) {
      console.error('옵션 status 업데이트 실패:', updateStatusError);
    }

    // 이메일 본문 생성
    const selectionUrl = generateScheduleSelectionUrl(candidate.id, candidate.token);
    const optionsHtml = acceptedOptions
      .map((opt, index) => {
        const date = new Date(opt.scheduled_at);
        return `
          <div style="margin: 20px 0; padding: 15px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h3 style="margin: 0 0 10px 0; color: #333;">옵션 ${index + 1}</h3>
            <p style="margin: 0; font-size: 16px; color: #666;">
              📅 ${format(date, 'yyyy년 MM월 dd일 (EEE)', { locale: ko })} ${format(date, 'HH:mm')}
            </p>
            <p style="margin: 5px 0 0 0; font-size: 14px; color: #999;">
              소요 시간: ${schedule.duration_minutes}분
            </p>
          </div>
        `;
      })
      .join('');

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2563eb;">면접 일정 선택 요청</h2>
        <p>안녕하세요, ${candidate.name}님.</p>
        <p>면접 일정을 확정하기 위해 아래 일정 중 하나를 선택해주시기 바랍니다.</p>
        
        ${optionsHtml}
        
        <div style="margin: 30px 0; text-align: center;">
          <a href="${selectionUrl}" 
             style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">
            일정 선택하기
          </a>
        </div>
        
        <p style="margin-top: 30px; font-size: 14px; color: #666;">
          위 링크를 클릭하시면 일정 선택 페이지로 이동합니다.
        </p>
        
        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
        <p style="font-size: 12px; color: #999; text-align: center;">
          이 메일은 VNTG ATS 시스템에서 자동으로 발송되었습니다.
        </p>
      </body>
      </html>
    `;

    // Gmail API를 사용하여 이메일 발송
    console.log(`후보자에게 이메일 발송 시작: ${candidate.email}, 옵션 수: ${acceptedOptions.length}`);
    const emailResult = await sendEmailViaGmail(
      organizerAccessToken,
      organizer.calendar_refresh_token,
      {
        to: candidate.email,
        from: organizer.email,
        subject: `[면접 일정] ${candidate.name}님, 면접 일정을 선택해주세요`,
        html: emailHtml,
        replyTo: organizer.email,
      },
      organizer.id,
    );

    console.log('이메일 발송 결과:', emailResult);

    if (!emailResult.success) {
      console.error('이메일 발송 실패:', emailResult.error);
      // 이메일 발송 실패해도 DB에는 기록하고 계속 진행
    }

    // 이메일 기록 저장
    const { error: emailInsertError } = await supabase.from('emails').insert({
      candidate_id: candidate.id,
      message_id: emailResult.messageId || `email-${Date.now()}`,
      subject: `[면접 일정] ${candidate.name}님, 면접 일정을 선택해주세요`,
      body: emailHtml,
      from_email: organizer.email,
      to_email: candidate.email,
      direction: 'outbound',
      sent_at: new Date().toISOString(),
    });

    if (emailInsertError) {
      console.error('이메일 기록 저장 실패:', emailInsertError);
    }

    // 워크플로우 상태 업데이트
    await supabase
      .from('schedules')
      .update({ workflow_status: 'pending_candidate' })
      .eq('id', scheduleId);

    // 타임라인 이벤트 생성
    const { data: timelineData, error: timelineError } = await supabase.from('timeline_events').insert({
      candidate_id: candidate.id,
      type: 'email',
      content: {
        message: '면접 일정 옵션이 후보자에게 전송되었습니다.',
        subject: `[면접 일정] ${candidate.name}님, 면접 일정을 선택해주세요`,
        schedule_id: scheduleId,
        options_count: acceptedOptions.length,
      },
      created_by: organizer.id,
    }).select();

    if (timelineError) {
      console.error('[타임라인] 이벤트 생성 실패 (일정 옵션 전송):', {
        error: timelineError,
        code: timelineError.code,
        message: timelineError.message,
        details: timelineError.details,
        hint: timelineError.hint,
        candidateId: candidate.id,
        type: 'email',
        scheduleId,
        userId: organizer.id,
      });
      if (timelineError.code === '23514') {
        console.error('[타임라인] DB 스키마 제약 조건 위반 - email 타입이 허용되지 않음.');
      }
      if (timelineError.code === '42501' || timelineError.message?.includes('row-level security')) {
        console.error('[타임라인] RLS 정책 위반 - 권한 문제.');
      }
    } else {
      console.log(`[타임라인] 이벤트 생성 성공:`, timelineData?.[0]?.id);
    }

    // 캐시 무효화
    revalidatePath(`/dashboard/candidates/${candidate.id}`);
    revalidatePath('/dashboard/schedules');

    // 이메일 발송 실패 시 경고만 표시 (에러는 던지지 않음 - 이미 workflow_status는 업데이트되었으므로)
    if (!emailResult.success) {
      console.error('이메일 발송 실패:', emailResult.error);
      // 이메일 발송 실패해도 workflow_status는 업데이트되었으므로 경고만 반환
      // lib/email/gmail.ts에서 이미 개선된 에러 메시지를 반환하므로 그대로 전달
      const errorMessage = emailResult.error || '알 수 없는 오류';
      // 이미 에러 메시지에 해결 방법이 포함되어 있으면 그대로 사용, 아니면 추가 안내
      const finalErrorMessage = errorMessage.includes('재연동') || errorMessage.includes('권한')
        ? errorMessage
        : `${errorMessage}. 워크플로우 상태는 업데이트되었습니다.`;
      
      return {
        success: false,
        emailSent: false,
        optionsCount: acceptedOptions.length,
        error: finalErrorMessage,
      };
    }

    return {
      success: true,
      emailSent: emailResult.success,
      optionsCount: acceptedOptions.length,
    };
  });
}

/**
 * 후보자가 선택한 일정 확정
 * 선택된 일정을 확정으로 변경하고, 구글 캘린더에서 block → 확정 이벤트로 변경
 * 다른 block 일정 삭제 및 최종 확정 안내 메시지 전송
 */
export async function confirmCandidateSchedule(
  scheduleId: string,
  optionId: string,
  token: string
) {
  return withErrorHandling(async () => {
    // 후보자가 직접 선택하는 경우이므로 Service Role Client를 사용하여 RLS 우회
    const supabase = createServiceClient();

    // 스케줄 및 후보자 정보 조회 (job_posts 포함하여 포지션명 가져오기)
    const { data: schedule, error: scheduleError } = await supabase
      .from('schedules')
      .select(`
        *,
        candidates!inner (
          id,
          name,
          email,
          token,
          job_posts (
            id,
            title
          )
        )
      `)
      .eq('id', scheduleId)
      .single();

    if (scheduleError || !schedule) {
      throw new Error('면접 일정을 찾을 수 없습니다.');
    }

    const candidate = schedule.candidates as any;
    if (!candidate || candidate.token !== token) {
      throw new Error('인증 토큰이 올바르지 않습니다.');
    }

    // 포지션명 추출
    const jobPost = candidate.job_posts as { id: string; title: string } | null | undefined;
    const positionName = jobPost?.title || '포지션 미지정';

    // 선택된 옵션 조회
    const { data: selectedOption, error: optionError } = await supabase
      .from('schedule_options')
      .select('*')
      .eq('id', optionId)
      .eq('schedule_id', scheduleId)
      .single();

    if (optionError || !selectedOption) {
      throw new Error('선택한 일정 옵션을 찾을 수 없습니다.');
    }

    // 모든 옵션 조회 (삭제용)
    const { data: allOptions } = await supabase
      .from('schedule_options')
      .select('*')
      .eq('schedule_id', scheduleId);

    // 면접관 정보 조회
    const { data: interviewers } = await supabase
      .from('users')
      .select('id, email, calendar_access_token, calendar_refresh_token')
      .in('id', schedule.interviewer_ids);

    if (!interviewers || interviewers.length === 0) {
      throw new Error('면접관 정보를 찾을 수 없습니다.');
    }

    const organizer = interviewers.find(inv => inv.calendar_access_token);
    if (!organizer || !organizer.calendar_access_token || !organizer.calendar_refresh_token) {
      throw new Error('면접관의 캘린더 정보를 찾을 수 없습니다.');
    }

    // 선택된 일정을 구글 캘린더에서 확정으로 변경
    if (selectedOption.google_event_id) {
      const endTime = new Date(selectedOption.scheduled_at);
      endTime.setMinutes(endTime.getMinutes() + schedule.duration_minutes);

      await updateCalendarEvent(
        organizer.calendar_access_token,
        organizer.calendar_refresh_token,
        selectedOption.google_event_id,
        {
          summary: `[확정] ${positionName} - ${candidate.name} 면접`,
          description: `포지션: ${positionName}\n후보자: ${candidate.name}\n면접 단계: ${schedule.stage_id}\n\n면접 일정이 확정되었습니다.`,
          start: {
            dateTime: selectedOption.scheduled_at,
            timeZone: 'Asia/Seoul',
          },
          end: {
            dateTime: endTime.toISOString(),
            timeZone: 'Asia/Seoul',
          },
          transparency: 'opaque',
        }
      );
    }

    // 다른 block 일정 삭제
    if (allOptions) {
      for (const option of allOptions) {
        if (option.id !== optionId && option.google_event_id) {
          try {
            await deleteCalendarEvent(
              organizer.calendar_access_token,
              organizer.calendar_refresh_token,
              option.google_event_id
            );
          } catch (error) {
            console.error(`옵션 ${option.id}의 이벤트 삭제 실패:`, error);
          }
        }
      }
    }

    // 선택된 옵션을 selected로 변경
    await supabase
      .from('schedule_options')
      .update({ status: 'selected' })
      .eq('id', optionId);

    // 다른 옵션들을 rejected로 변경
    if (allOptions) {
      const otherOptionIds = allOptions
        .filter(opt => opt.id !== optionId)
        .map(opt => opt.id);
      
      if (otherOptionIds.length > 0) {
        await supabase
          .from('schedule_options')
          .update({ status: 'rejected' })
          .in('id', otherOptionIds);
      }
    }

    // 메인 스케줄 업데이트
    await supabase
      .from('schedules')
      .update({
        scheduled_at: selectedOption.scheduled_at,
        status: 'confirmed',
        workflow_status: 'confirmed',
        google_event_id: selectedOption.google_event_id,
        candidate_response: 'accepted',
      })
      .eq('id', scheduleId);

    // 최종 확정 안내 메시지 전송 (면접관 및 후보자)
    const confirmedDate = new Date(selectedOption.scheduled_at);
    const confirmedEndTime = new Date(confirmedDate);
    confirmedEndTime.setMinutes(confirmedEndTime.getMinutes() + schedule.duration_minutes);

    const confirmationMessage = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #16a34a;">면접 일정이 확정되었습니다</h2>
        <p>안녕하세요.</p>
        <p>면접 일정이 확정되었습니다. 아래 일정을 확인해주세요.</p>
        
        <div style="margin: 20px 0; padding: 20px; background-color: #f0f9ff; border-radius: 8px; border-left: 4px solid #2563eb;">
          <h3 style="margin: 0 0 10px 0; color: #333;">확정된 면접 일정</h3>
          <p style="margin: 5px 0; font-size: 16px;">
            <strong>후보자:</strong> ${candidate.name}
          </p>
          <p style="margin: 5px 0; font-size: 16px;">
            <strong>일시:</strong> ${format(confirmedDate, 'yyyy년 MM월 dd일 (EEE) HH:mm', { locale: ko })} - ${format(confirmedEndTime, 'HH:mm')}
          </p>
          <p style="margin: 5px 0; font-size: 16px;">
            <strong>소요 시간:</strong> ${schedule.duration_minutes}분
          </p>
        </div>
        
        <p style="margin-top: 30px; font-size: 14px; color: #666;">
          구글 캘린더에 일정이 추가되었습니다. 확인해주세요.
        </p>
        
        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
        <p style="font-size: 12px; color: #999; text-align: center;">
          이 메일은 VNTG ATS 시스템에서 자동으로 발송되었습니다.
        </p>
      </body>
      </html>
    `;

    // 면접관(organizer)의 Google Workspace 토큰을 사용하여 이메일 발송
    // organizer는 이미 위에서 찾았고, calendar_access_token과 calendar_refresh_token이 있음
    if (organizer.calendar_access_token && organizer.calendar_refresh_token && organizer.email) {
      // 후보자에게 확정 안내
      await sendEmailViaGmail(
        organizer.calendar_access_token,
        organizer.calendar_refresh_token,
        {
          to: candidate.email,
          from: organizer.email,
          subject: `[면접 일정 확정] ${candidate.name}님의 면접 일정이 확정되었습니다`,
          html: confirmationMessage,
          replyTo: organizer.email,
        }
      );

      // 면접관들에게 확정 안내
      for (const interviewer of interviewers) {
        if (interviewer.email && interviewer.id !== organizer.id) {
          await sendEmailViaGmail(
            organizer.calendar_access_token,
            organizer.calendar_refresh_token,
            {
              to: interviewer.email,
              from: organizer.email,
              subject: `[면접 일정 확정] ${candidate.name}님의 면접 일정이 확정되었습니다`,
              html: confirmationMessage,
              replyTo: organizer.email,
            }
          );
        }
      }
    } else {
      console.warn('면접관의 Google Workspace 계정이 연동되지 않아 이메일을 발송할 수 없습니다.');
    }

    // 타임라인 이벤트 생성
    const { data: timelineData, error: timelineError } = await supabase.from('timeline_events').insert({
      candidate_id: candidate.id,
      type: 'schedule_confirmed',
      content: {
        message: '면접 일정이 확정되었습니다.',
        schedule_id: scheduleId,
        scheduled_at: selectedOption.scheduled_at,
        interviewers: schedule.interviewer_ids,
      },
      created_by: organizer.id, // organizer ID 사용 (이미 조회됨)
    }).select();

    if (timelineError) {
      console.error('[타임라인] 이벤트 생성 실패 (일정 확정):', {
        error: timelineError,
        code: timelineError.code,
        message: timelineError.message,
        details: timelineError.details,
        hint: timelineError.hint,
        candidateId: candidate.id,
        type: 'schedule_confirmed',
        scheduleId,
        organizerId: organizer.id,
      });
      if (timelineError.code === '23514') {
        console.error('[타임라인] DB 스키마 제약 조건 위반 - schedule_confirmed 타입이 허용되지 않음.');
      }
      if (timelineError.code === '42501' || timelineError.message?.includes('row-level security')) {
        console.error('[타임라인] RLS 정책 위반 - 권한 문제.');
      }
    } else {
      console.log(`[타임라인] 이벤트 생성 성공:`, timelineData?.[0]?.id);
    }

    // 캐시 무효화
    revalidatePath('/dashboard/calendar');
    revalidatePath(`/dashboard/candidates/${candidate.id}`);

    return {
      success: true,
      schedule: {
        ...schedule,
        scheduled_at: selectedOption.scheduled_at,
        status: 'confirmed',
      },
    };
  });
}

/**
 * 면접관 응답 미확인 시 데일리 리마인드 메일 발송
 * pending_interviewers 상태인 스케줄의 면접관 중 응답하지 않은 사람에게만 발송
 */
export async function sendReminderEmailsToInterviewers() {
  return withErrorHandling(async () => {
    // Service Role Client를 사용하여 RLS 정책 우회 (cron job이므로)
    const supabase = createServiceClient();

    // pending_interviewers 상태인 모든 스케줄 조회
    const { data: schedules, error: schedulesError } = await supabase
      .from('schedules')
      .select(`
        *,
        candidates!inner (
          id,
          name,
          email
        )
      `)
      .eq('workflow_status', 'pending_interviewers');

    if (schedulesError || !schedules || schedules.length === 0) {
      return {
        success: true,
        message: '리마인드 메일을 보낼 스케줄이 없습니다.',
        sentCount: 0,
      };
    }

    let totalSentCount = 0;
    const errors: string[] = [];

    // 각 스케줄에 대해 처리
    for (const schedule of schedules) {
      try {
        const candidate = schedule.candidates as { id: string; name: string; email: string } | null | undefined;
        if (!candidate) continue;

        // 일정 옵션 조회
        const { data: options, error: optionsError } = await supabase
          .from('schedule_options')
          .select('*')
          .eq('schedule_id', schedule.id)
          .eq('status', 'pending');

        if (optionsError || !options || options.length === 0) continue;

        // 면접관 정보 조회
        const { data: interviewers } = await supabase
          .from('users')
          .select('id, email, calendar_access_token, calendar_refresh_token')
          .in('id', schedule.interviewer_ids);

        if (!interviewers || interviewers.length === 0) continue;

        // 첫 번째 면접관의 토큰을 사용 (organizer)
        const organizer = interviewers.find(inv => inv.calendar_access_token);
        if (!organizer || !organizer.calendar_access_token || !organizer.calendar_refresh_token) continue;

        // 각 옵션의 면접관 응답 확인
        const interviewersNeedingReminder = new Set<string>();

        for (const option of options) {
          if (!option.google_event_id) continue;

          try {
            const responses = await getEventAttendeesStatus(
              organizer.calendar_access_token,
              organizer.calendar_refresh_token,
              option.google_event_id
            );

            // 응답하지 않은 면접관 찾기 (needsAction 상태)
            for (const interviewer of interviewers) {
              if (interviewer.email) {
                const response = responses[interviewer.email] || 'needsAction';
                if (response === 'needsAction') {
                  interviewersNeedingReminder.add(interviewer.id);
                }
              }
            }
          } catch (error) {
            console.error(`옵션 ${option.id}의 응답 상태 확인 실패:`, error);
            // 에러가 나도 계속 진행
          }
        }

        // 응답하지 않은 면접관들에게 리마인드 메일 발송
        if (interviewersNeedingReminder.size > 0) {
          // stage ID를 프로세스 이름으로 변환
          const stageName = getStageNameByStageId(schedule.stage_id) || schedule.stage_id;
          
          // 일정 옵션 목록을 HTML로 포맷팅
          const optionsListHtml = options.map((opt, index) => {
            // ✅ 메일 표기는 KST로 통일
            const dateKst = toZonedTime(new Date(opt.scheduled_at), KST_TIMEZONE);
            const endTimeKst = new Date(dateKst);
            endTimeKst.setMinutes(endTimeKst.getMinutes() + schedule.duration_minutes);
            
            return `
              <div style="margin: 15px 0; padding: 15px; background-color: #f5f5f5; border-radius: 5px;">
                <p style="margin: 0; font-weight: bold; color: #333;">
                  옵션 ${index + 1}: ${format(dateKst, 'yyyy년 MM월 dd일 (EEE) HH:mm', { locale: ko })} - ${format(endTimeKst, 'HH:mm', { locale: ko })}
                </p>
              </div>
            `;
          }).join('');

          const reminderMessage = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <style>
                body { font-family: 'Malgun Gothic', Arial, sans-serif; line-height: 1.6; color: #333; }
              </style>
            </head>
            <body>
              <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #dc2626; border-bottom: 2px solid #dc2626; padding-bottom: 10px;">
                  ⏰ 면접 일정 확인 리마인드
                </h2>
                
                <p style="font-size: 16px; margin-top: 20px;">
                  안녕하세요,
                </p>
                
                <p style="font-size: 14px; margin-top: 15px;">
                  <strong>${candidate.name}</strong>님의 면접 일정에 대한 응답을 아직 받지 못했습니다. 
                  구글 캘린더에서 일정 초대를 확인하고 수락 또는 거절해주시기 바랍니다.
                </p>
                
                <div style="margin: 25px 0; padding: 20px; background-color: #f0f9ff; border-left: 4px solid #2563eb; border-radius: 5px;">
                  <p style="margin: 0 0 10px 0; font-weight: bold; color: #1e40af;">
                    면접 정보
                  </p>
                  <p style="margin: 5px 0; font-size: 14px;">
                    <strong>후보자:</strong> ${candidate.name}
                  </p>
                  <p style="margin: 5px 0; font-size: 14px;">
                    <strong>면접 단계:</strong> ${stageName}
                  </p>
                  <p style="margin: 5px 0; font-size: 14px;">
                    <strong>면접 시간:</strong> ${schedule.duration_minutes}분
                  </p>
                </div>
                
                <div style="margin: 25px 0;">
                  <p style="font-weight: bold; color: #333; margin-bottom: 10px;">
                    일정 옵션:
                  </p>
                  ${optionsListHtml}
                </div>
                
                <div style="margin: 30px 0; padding: 15px; background-color: #fee2e2; border-left: 4px solid #dc2626; border-radius: 5px;">
                  <p style="margin: 0; font-size: 14px; color: #991b1b;">
                    <strong>⚠️ 긴급:</strong> 구글 캘린더에서 각 일정 초대에 대해 수락 또는 거절을 선택해주세요. 
                    모든 면접관이 수락한 일정이 후보자에게 전송됩니다.
                  </p>
                </div>
                
                <p style="margin-top: 30px; font-size: 14px; color: #666;">
                  구글 캘린더에서 일정을 확인하고 응답해주시기 바랍니다.
                </p>
                
                <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
                <p style="font-size: 12px; color: #999; text-align: center;">
                  이 메일은 VNTG ATS 시스템에서 자동으로 발송되었습니다.
                </p>
              </div>
            </body>
            </html>
          `;

          // 응답하지 않은 면접관들에게만 메일 발송
          for (const interviewerId of interviewersNeedingReminder) {
            const interviewer = interviewers.find(inv => inv.id === interviewerId);
            if (interviewer && interviewer.email) {
              try {
                await sendEmailViaGmail(
                  organizer.calendar_access_token,
                  organizer.calendar_refresh_token,
                  {
                    to: interviewer.email,
                    from: organizer.email,
                    subject: `[리마인드] ${candidate.name}님의 면접 일정 확인 요청`,
                    html: reminderMessage,
                    replyTo: organizer.email,
                  }
                );
                totalSentCount++;
                console.log(`면접관 ${interviewer.email}에게 리마인드 메일 발송 완료`);
              } catch (error) {
                const errorMsg = `면접관 ${interviewer.email}에게 리마인드 메일 발송 실패: ${error}`;
                console.error(errorMsg);
                errors.push(errorMsg);
              }
            }
          }
        }
      } catch (error) {
        const errorMsg = `스케줄 ${schedule.id} 처리 중 오류: ${error}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    return {
      success: true,
      message: `총 ${totalSentCount}개의 리마인드 메일이 발송되었습니다.`,
      sentCount: totalSentCount,
      errors: errors.length > 0 ? errors : undefined,
    };
  });
}

/**
 * 확정된 면접 일정 재조율
 * 기존 일정을 취소하고 새로운 일정 옵션을 생성합니다.
 * @param scheduleId 면접 일정 ID
 * @param formData 재조율 정보 (rescheduling_reason 포함)
 * @returns 재조율 결과
 */
export async function rescheduleInterview(scheduleId: string, formData: FormData) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const isAdmin = user.role === 'admin';
    const supabase = isAdmin ? createServiceClient() : await createClient();

    // 면접 일정 조회 및 권한 확인
    const { data: schedule, error: scheduleError } = await supabase
      .from('schedules')
      .select(`
        *,
        candidates!inner (
          id,
          name,
          email,
          job_posts (
            id,
            title
          )
        )
      `)
      .eq('id', scheduleId)
      .single();

    if (scheduleError || !schedule) {
      throw new Error('면접 일정을 찾을 수 없습니다.');
    }

    await verifyCandidateAccess(schedule.candidate_id);

    // 재조율 사유 확인
    const reschedulingReason = formData.get('rescheduling_reason') as string || '재조율 필요';

    // 재조율 가능한 상태인지 확인 (confirmed 또는 needs_rescheduling 상태)
    if (schedule.workflow_status !== 'confirmed' && schedule.workflow_status !== 'needs_rescheduling') {
      throw new Error('재조율할 수 있는 상태가 아닙니다. 확정된 일정만 재조율할 수 있습니다.');
    }

    const candidate = schedule.candidates as any;
    const jobPost = candidate.job_posts as { id: string; title: string } | null | undefined;
    const positionName = jobPost?.title || '포지션 미지정';
    const excludedTimeRangesFromForm = readExcludedTimeRangesFromFormData(formData);
    const excludedTimeRanges = excludedTimeRangesFromForm.length > 0
      ? excludedTimeRangesFromForm
      : readExcludedTimeRangesFromSchedule(schedule);

    // 면접관 정보 조회
    const { data: interviewers } = await supabase
      .from('users')
      .select('id, email, calendar_provider, calendar_access_token, calendar_refresh_token')
      .in('id', schedule.interviewer_ids);

    if (!interviewers || interviewers.length === 0) {
      throw new Error('면접관 정보를 찾을 수 없습니다.');
    }

    // 재조율 시작 전: 기존 schedule_options watch 채널을 먼저 stop 처리합니다.
    // (이후 block 일정(calendar event)을 삭제하므로, stop을 먼저 해제해두면 불필요한 웹훅 호출을 줄일 수 있습니다.)
    const organizerForWatch = interviewers.find(
      (inv) => inv.calendar_provider === 'google' && inv.calendar_access_token && inv.calendar_refresh_token,
    );

    if (organizerForWatch && organizerForWatch.calendar_access_token && organizerForWatch.calendar_refresh_token) {
      const { data: optionsForWatch } = await supabase
        .from('schedule_options')
        .select('id, watch_channel_id, watch_resource_id')
        .eq('schedule_id', scheduleId)
        .not('watch_channel_id', 'is', null);

      if (optionsForWatch && optionsForWatch.length > 0) {
        for (const option of optionsForWatch) {
          if (!option.watch_channel_id || !option.watch_resource_id) continue;
          try {
            await stopCalendarEventWatch(organizerForWatch.calendar_access_token, organizerForWatch.calendar_refresh_token, {
              channelId: option.watch_channel_id,
              resourceId: option.watch_resource_id,
            });

            // watch 매핑 값 정리 (선택)
            await supabase
              .from('schedule_options')
              .update({
                watch_channel_id: null,
                watch_resource_id: null,
                watch_token: null,
                watch_expiration: null,
              })
              .eq('id', option.id);
          } catch (error) {
            console.error('watch stop 중 오류(재조율):', error);
          }
        }
      }
    }

    // 기존 구글 캘린더 이벤트 삭제
    if (schedule.google_event_id) {
      const organizer = interviewers.find(
        inv => inv.calendar_provider === 'google' && inv.calendar_access_token && inv.calendar_refresh_token
      );
      
      if (organizer && organizer.calendar_access_token && organizer.calendar_refresh_token) {
        try {
          await deleteCalendarEvent(
            organizer.calendar_access_token,
            organizer.calendar_refresh_token,
            schedule.google_event_id
          );
          console.log(`기존 구글 캘린더 이벤트 삭제 완료: ${schedule.google_event_id}`);
        } catch (error) {
          console.error(`기존 구글 캘린더 이벤트 삭제 실패:`, error);
          // 이벤트 삭제 실패해도 재조율은 계속 진행
        }
      }
    }

    // 기존 schedule_options의 구글 캘린더 이벤트도 삭제
    const { data: existingOptions } = await supabase
      .from('schedule_options')
      .select('id, google_event_id')
      .eq('schedule_id', scheduleId)
      .not('google_event_id', 'is', null);

    if (existingOptions && existingOptions.length > 0) {
      const organizer = interviewers.find(
        inv => inv.calendar_provider === 'google' && inv.calendar_access_token && inv.calendar_refresh_token
      );
      
      if (organizer && organizer.calendar_access_token && organizer.calendar_refresh_token) {
        for (const option of existingOptions) {
          if (option.google_event_id) {
            try {
              await deleteCalendarEvent(
                organizer.calendar_access_token,
                organizer.calendar_refresh_token,
                option.google_event_id
              );
            } catch (error) {
              console.error(`옵션 ${option.id}의 이벤트 삭제 실패:`, error);
            }
          }
        }
      }
    }

    // 재조율을 위한 새로운 날짜 범위 확인
    const newStartDate = formData.get('start_date') 
      ? new Date(formData.get('start_date') as string)
      : new Date(); // 기본값: 오늘부터
    const newEndDate = formData.get('end_date')
      ? new Date(formData.get('end_date') as string)
      : (() => {
          const end = new Date();
          end.setDate(end.getDate() + 7); // 기본값: 7일 후
          return end;
        })();

    if (newStartDate >= newEndDate) {
      throw new Error('종료 날짜는 시작 날짜보다 이후여야 합니다.');
    }

    // 새로운 일정 옵션 생성 (regenerateScheduleOptions 로직 재사용)
    // 하지만 재조율이므로 기존 일정을 참고하여 새로운 일정 생성
    const numOptions = parseInt(formData.get('num_options') as string || '2');

    // 면접관들의 바쁜 시간 조회
    const allBusyTimes: Array<{ start: { dateTime: string; timeZone: string }; end: { dateTime: string; timeZone: string } }> = [];
    
    const interviewersWithCalendar = interviewers.filter(
      inv => inv.calendar_provider === 'google' && inv.calendar_access_token && inv.calendar_refresh_token
    );

    for (const interviewer of interviewersWithCalendar) {
      try {
        // userId를 전달하여 갱신된 토큰을 DB에 자동 저장
        const token = await refreshAccessTokenIfNeeded(
          interviewer.calendar_access_token!,
          interviewer.calendar_refresh_token!,
          interviewer.id
        );
        
        const busyTimes = await getBusyTimes(
          token,
          ['primary'],
          newStartDate,
          newEndDate
        );

        allBusyTimes.push(...busyTimes.map(bt => ({
          start: bt.start,
          end: bt.end,
        })));
      } catch (error) {
        console.error(`면접관 ${interviewer.email}의 캘린더 조회 실패:`, error);
      }
    }

    // 기존 일정 시간대도 바쁜 시간에 추가 (중복 방지)
    const oldScheduleStart = new Date(schedule.scheduled_at);
    const oldScheduleEnd = new Date(oldScheduleStart);
    oldScheduleEnd.setMinutes(oldScheduleEnd.getMinutes() + schedule.duration_minutes);
    
    allBusyTimes.push({
      start: { dateTime: oldScheduleStart.toISOString(), timeZone: 'Asia/Seoul' },
      end: { dateTime: oldScheduleEnd.toISOString(), timeZone: 'Asia/Seoul' },
    });

    // 공통 가능 일정 찾기
    const availableSlots = await findAvailableTimeSlots({
      candidateName: candidate.name,
      stageName: schedule.stage_id,
      interviewerIds: schedule.interviewer_ids,
      busyTimes: allBusyTimes.map(bt => ({
        id: '',
        summary: '',
        start: bt.start,
        end: bt.end,
      })),
      startDate: newStartDate,
      endDate: newEndDate,
      durationMinutes: schedule.duration_minutes,
    allowedTimeRanges: undefined,
    excludedTimeRanges,
    });

    if (availableSlots.length === 0) {
      throw new Error('재조율 가능한 일정을 찾을 수 없습니다. 날짜 범위를 늘리거나 다른 면접관을 선택해주세요.');
    }

    // 상위 N개 일정 선택
    const selectedSlots = availableSlots.slice(0, numOptions);

    // 각 일정 옵션에 대해 구글 캘린더 block 일정 생성
    const scheduleOptions = [];
    
    const externalInterviewerEmails = schedule.external_interviewer_emails || [];
    for (const slot of selectedSlots) {
      const endTime = new Date(slot.scheduledAt);
      endTime.setMinutes(endTime.getMinutes() + schedule.duration_minutes);

      // 첫 번째 면접관의 토큰을 사용하여 이벤트 생성 (주최자)
      const organizer = interviewersWithCalendar[0];
      if (!organizer || !organizer.calendar_access_token || !organizer.calendar_refresh_token) {
        throw new Error('구글 캘린더에 연동된 면접관이 없습니다.');
      }

      const organizerToken = await refreshAccessTokenIfNeeded(
        organizer.calendar_access_token,
        organizer.calendar_refresh_token,
        organizer.id
      );

      // 구글 캘린더에 block 일정 생성
      const createdEvent = await createCalendarEvent(
        organizerToken,
        organizer.calendar_refresh_token,
        {
          summary: `[재조율] ${positionName} - ${candidate.name} 면접 일정 (확정 대기)`,
          description: `포지션: ${positionName}\n후보자: ${candidate.name}\n면접 단계: ${schedule.stage_id}\n재조율 사유: ${reschedulingReason}\n\n이 일정은 재조율로 인해 새로 생성되었습니다. 모든 면접관이 수락하면 후보자에게 전송됩니다.`,
          start: {
            dateTime: slot.scheduledAt.toISOString(),
            timeZone: 'Asia/Seoul',
          },
          end: {
            dateTime: endTime.toISOString(),
            timeZone: 'Asia/Seoul',
          },
          attendees: [
            ...interviewersWithCalendar.map(inv => ({ email: inv.email })),
            ...externalInterviewerEmails.map((email: string) => ({ email })),
          ],
          transparency: 'opaque',
        }
      );
      const eventId = createdEvent.id;

      // schedule_options에 저장
      const { data: option, error: optionError } = await supabase
        .from('schedule_options')
        .insert({
          schedule_id: scheduleId,
          scheduled_at: slot.scheduledAt.toISOString(),
          status: 'pending',
          google_event_id: eventId,
          interviewer_responses: {},
          is_manual: false,
        })
        .select()
        .single();

      if (optionError || !option) {
        // 이벤트는 생성되었지만 DB 저장 실패 시 이벤트 삭제 시도
        try {
          await deleteCalendarEvent(organizerToken, organizer.calendar_refresh_token, eventId);
        } catch (deleteError) {
          console.error('이벤트 삭제 실패:', deleteError);
        }
        throw new Error(`일정 옵션 저장 실패: ${optionError?.message || '알 수 없는 오류'}`);
      }

      scheduleOptions.push(option);
    }

    // 스케줄 상태 업데이트
    const updateData: ScheduleUpdate & {
      needs_rescheduling?: boolean;
      rescheduling_reason?: string;
      workflow_status?: 'pending_interviewers' | 'needs_rescheduling';
      scheduled_at?: string;
    } = {
      needs_rescheduling: false, // 재조율 완료
      rescheduling_reason: reschedulingReason,
      workflow_status: 'pending_interviewers',
      scheduled_at: selectedSlots[0].scheduledAt.toISOString(), // 첫 번째 옵션으로 업데이트
      interviewer_responses: excludedTimeRanges.length > 0
        ? {
            _metadata: {
              excludedTimeRanges,
            },
          }
        : {},
    };

    const { error: updateScheduleError } = await supabase
      .from('schedules')
      .update(updateData)
      .eq('id', scheduleId);

    if (updateScheduleError) {
      throw new Error(`스케줄 상태 업데이트 실패: ${updateScheduleError.message}`);
    }

    // 면접관들에게 재조율 안내 메일 발송
    const organizerForMail = interviewersWithCalendar[0];
    if (organizerForMail?.calendar_access_token && organizerForMail?.calendar_refresh_token && organizerForMail?.email) {
      const optionsListHtml = scheduleOptions.map((opt, index) => {
        // ✅ 메일 표기는 KST로 통일
        const dateKst = toZonedTime(new Date(opt.scheduled_at), KST_TIMEZONE);
        const endTimeKst = new Date(dateKst);
        endTimeKst.setMinutes(endTimeKst.getMinutes() + schedule.duration_minutes);
        
        return `
          <div style="margin: 15px 0; padding: 15px; background-color: #f5f5f5; border-radius: 5px;">
            <p style="margin: 0; font-weight: bold; color: #333;">
              옵션 ${index + 1}: ${format(dateKst, 'yyyy년 MM월 dd일 (EEE) HH:mm', { locale: ko })} - ${format(endTimeKst, 'HH:mm', { locale: ko })}
            </p>
          </div>
        `;
      }).join('');

      const notificationMessage = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: 'Malgun Gothic', Arial, sans-serif; line-height: 1.6; color: #333; }
          </style>
        </head>
        <body>
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #dc2626; border-bottom: 2px solid #dc2626; padding-bottom: 10px;">
              면접 일정 재조율 안내
            </h2>
            
            <p style="font-size: 16px; margin-top: 20px;">
              안녕하세요,
            </p>
            
            <p style="font-size: 14px; margin-top: 15px;">
              <strong>${candidate.name}</strong>님의 면접 일정이 재조율되었습니다. 
              재조율 사유: <strong>${reschedulingReason}</strong>
            </p>
            
            <div style="margin: 25px 0; padding: 20px; background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 5px;">
              <p style="margin: 0 0 10px 0; font-weight: bold; color: #92400e;">
                재조율 사유
              </p>
              <p style="margin: 0; font-size: 14px; color: #92400e;">
                ${reschedulingReason}
              </p>
            </div>
            
            <div style="margin: 25px 0; padding: 20px; background-color: #f0f9ff; border-left: 4px solid #2563eb; border-radius: 5px;">
              <p style="margin: 0 0 10px 0; font-weight: bold; color: #1e40af;">
                면접 정보
              </p>
              <p style="margin: 5px 0; font-size: 14px;">
                <strong>포지션:</strong> ${positionName}
              </p>
              <p style="margin: 5px 0; font-size: 14px;">
                <strong>후보자:</strong> ${candidate.name}
              </p>
              <p style="margin: 5px 0; font-size: 14px;">
                <strong>면접 단계:</strong> ${schedule.stage_id}
              </p>
            </div>
            
            <div style="margin: 25px 0;">
              <p style="font-weight: bold; color: #333; margin-bottom: 10px;">
                새로운 일정 옵션:
              </p>
              ${optionsListHtml}
            </div>
            
            <div style="margin: 30px 0; padding: 15px; background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 5px;">
              <p style="margin: 0; font-size: 14px; color: #92400e;">
                <strong>⚠️ 중요:</strong> 구글 캘린더에서 각 일정 초대에 대해 수락 또는 거절을 선택해주세요. 
                모든 면접관이 수락한 일정이 후보자에게 전송됩니다.
              </p>
            </div>
            
            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
            <p style="font-size: 12px; color: #999; text-align: center;">
              이 메일은 VNTG ATS 시스템에서 자동으로 발송되었습니다.
            </p>
          </div>
        </body>
        </html>
      `;

      // 모든 면접관에게 안내 메일 발송
      for (const interviewer of interviewersWithCalendar) {
        if (interviewer.email) {
          try {
            await sendEmailViaGmail(
              organizerForMail.calendar_access_token,
              organizerForMail.calendar_refresh_token,
              {
                to: interviewer.email,
                from: organizerForMail.email,
                subject: `[면접 일정 재조율] ${candidate.name}님의 면접 일정이 재조율되었습니다`,
                html: notificationMessage,
                replyTo: organizerForMail.email,
              }
            );
            console.log(`면접관 ${interviewer.email}에게 재조율 안내 메일 발송 완료`);
          } catch (error) {
            console.error(`면접관 ${interviewer.email}에게 안내 메일 발송 실패:`, error);
          }
        }
      }
    }

    // 타임라인 이벤트 생성
    const { data: timelineData, error: timelineError } = await supabase.from('timeline_events').insert({
      candidate_id: schedule.candidate_id,
      type: 'schedule_rescheduled',
      content: {
        message: `면접 일정이 재조율되었습니다. 재조율 사유: ${reschedulingReason}`,
        schedule_id: scheduleId,
        schedule_options: scheduleOptions.map(opt => ({
          id: opt.id,
          scheduled_at: opt.scheduled_at,
        })),
        rescheduling_reason: reschedulingReason,
        interviewers: schedule.interviewer_ids,
      },
      created_by: user.userId,
    }).select();

    if (timelineError) {
      console.error('[타임라인] 이벤트 생성 실패 (재조율):', timelineError);
    } else {
      console.log(`[타임라인] 이벤트 생성 성공:`, timelineData?.[0]?.id);
    }

    // 캐시 무효화
    revalidatePath('/dashboard/calendar');
    revalidatePath(`/dashboard/candidates/${schedule.candidate_id}`);
    revalidatePath('/dashboard/schedules');

    return {
      success: true,
      scheduleId,
      options: scheduleOptions,
      message: `${selectedSlots.length}개의 새로운 일정 옵션이 생성되었고, 면접관들에게 재조율 안내가 전송되었습니다.`,
    };
  });
}

/**
 * 관리자가 직접 일정 옵션 추가
 * 면접관 일정 확인 없이 강제로 옵션 생성 가능
 * @param scheduleId 면접 일정 ID
 * @param formData 일정 옵션 정보 (scheduled_at, duration_minutes 포함)
 * @returns 생성된 일정 옵션
 */
export async function addManualScheduleOption(scheduleId: string, formData: FormData) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const isAdmin = user.role === 'admin';
    const supabase = isAdmin ? createServiceClient() : await createClient();

    // 면접 일정 조회 및 권한 확인
    const { data: schedule, error: scheduleError } = await supabase
      .from('schedules')
      .select(`
        *,
        candidates!inner (
          id,
          name,
          email,
          job_posts (
            id,
            title
          )
        )
      `)
      .eq('id', scheduleId)
      .single();

    if (scheduleError || !schedule) {
      throw new Error('면접 일정을 찾을 수 없습니다.');
    }

    await verifyCandidateAccess(schedule.candidate_id);

    // 입력값 검증
    const scheduledAt = validateFutureDate(
      new Date(validateRequired(formData.get('scheduled_at'), '면접 일시')),
      '면접 일시'
    );
    const durationMinutes = formData.get('duration_minutes')
      ? validateNumberRange(
          parseInt(formData.get('duration_minutes') as string),
          15,
          480,
          '면접 시간'
        )
      : schedule.duration_minutes;

    const candidate = schedule.candidates as any;
    const jobPost = candidate.job_posts as { id: string; title: string } | null | undefined;
    const positionName = jobPost?.title || '포지션 미지정';

    // 면접관 정보 조회
    const { data: interviewers } = await supabase
      .from('users')
      .select('id, email, calendar_provider, calendar_access_token, calendar_refresh_token')
      .in('id', schedule.interviewer_ids);

    if (!interviewers || interviewers.length === 0) {
      throw new Error('면접관 정보를 찾을 수 없습니다.');
    }

    const interviewersWithCalendar = interviewers.filter(
      inv => inv.calendar_provider === 'google' && inv.calendar_access_token && inv.calendar_refresh_token
    );

    if (interviewersWithCalendar.length === 0) {
      throw new Error('구글 캘린더에 연동된 면접관이 없습니다.');
    }

    const endTime = new Date(scheduledAt);
    endTime.setMinutes(endTime.getMinutes() + durationMinutes);

    // 첫 번째 면접관의 토큰을 사용하여 이벤트 생성 (주최자)
    const organizer = interviewersWithCalendar[0];
    const organizerToken = await refreshAccessTokenIfNeeded(
      organizer.calendar_access_token!,
      organizer.calendar_refresh_token!,
      organizer.id
    );

    const externalInterviewerEmails = schedule.external_interviewer_emails || [];
    // 구글 캘린더에 block 일정 생성
    const createdEvent = await createCalendarEvent(
      organizerToken,
      organizer.calendar_refresh_token!,
      {
        summary: `[수동 추가] ${positionName} - ${candidate.name} 면접 일정 (확정 대기)`,
        description: `포지션: ${positionName}\n후보자: ${candidate.name}\n면접 단계: ${schedule.stage_id}\n\n이 일정은 관리자가 수동으로 추가한 옵션입니다. 모든 면접관이 수락하면 후보자에게 전송됩니다.`,
        start: {
          dateTime: scheduledAt.toISOString(),
          timeZone: 'Asia/Seoul',
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: 'Asia/Seoul',
        },
        attendees: [
          ...interviewersWithCalendar.map(inv => ({ email: inv.email })),
          ...externalInterviewerEmails.map((email: string) => ({ email })),
        ],
        transparency: 'opaque',
      }
    );
    const eventId = createdEvent.id;

    // schedule_options에 저장 (수동 추가 표시)
    const { data: option, error: optionError } = await supabase
      .from('schedule_options')
      .insert({
        schedule_id: scheduleId,
        scheduled_at: scheduledAt.toISOString(),
        status: 'pending',
        google_event_id: eventId,
        interviewer_responses: {},
        is_manual: true,
        added_by: user.userId,
      })
      .select()
      .single();

    if (optionError || !option) {
      // 이벤트는 생성되었지만 DB 저장 실패 시 이벤트 삭제 시도
      try {
        await deleteCalendarEvent(organizerToken, organizer.calendar_refresh_token!, eventId);
      } catch (deleteError) {
        console.error('이벤트 삭제 실패:', deleteError);
      }
      throw new Error(`일정 옵션 저장 실패: ${optionError?.message || '알 수 없는 오류'}`);
    }

    // 스케줄이 pending_interviewers 상태가 아니면 변경
    if (schedule.workflow_status !== 'pending_interviewers') {
      await supabase
        .from('schedules')
        .update({ workflow_status: 'pending_interviewers' })
        .eq('id', scheduleId);
    }

    // 타임라인 이벤트 생성
    const { data: timelineData, error: timelineError } = await supabase.from('timeline_events').insert({
      candidate_id: schedule.candidate_id,
      type: 'schedule_option_manually_added',
      content: {
        message: `관리자가 일정 옵션을 수동으로 추가했습니다: ${format(scheduledAt, 'yyyy-MM-dd HH:mm', { locale: ko })}`,
        schedule_id: scheduleId,
        option_id: option.id,
        option_scheduled_at: option.scheduled_at,
        added_by: user.userId,
      },
      created_by: user.userId,
    }).select();

    if (timelineError) {
      console.error('[타임라인] 이벤트 생성 실패 (수동 옵션 추가):', timelineError);
    } else {
      console.log(`[타임라인] 이벤트 생성 성공:`, timelineData?.[0]?.id);
    }

    // 캐시 무효화
    revalidatePath('/dashboard/calendar');
    revalidatePath(`/dashboard/candidates/${schedule.candidate_id}`);
    revalidatePath('/dashboard/schedules');

    return {
      success: true,
      option,
      message: '일정 옵션이 수동으로 추가되었습니다.',
    };
  });
}

/**
 * 강제 확정 기능
 * 면접관/후보자 응답과 관계없이 강제로 일정 확정
 * @param scheduleId 면접 일정 ID
 * @param optionId 선택할 일정 옵션 ID (선택 사항, 없으면 첫 번째 옵션 사용)
 * @returns 확정 결과
 */
export async function forceConfirmSchedule(scheduleId: string, optionId?: string) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const isAdmin = user.role === 'admin';
    const supabase = isAdmin ? createServiceClient() : await createClient();

    // 면접 일정 조회 및 권한 확인
    const { data: schedule, error: scheduleError } = await supabase
      .from('schedules')
      .select(`
        *,
        candidates!inner (
          id,
          name,
          email,
          token,
          job_posts (
            id,
            title
          )
        )
      `)
      .eq('id', scheduleId)
      .single();

    if (scheduleError || !schedule) {
      throw new Error('면접 일정을 찾을 수 없습니다.');
    }

    await verifyCandidateAccess(schedule.candidate_id);

    // 관리자 또는 리크루터만 강제 확정 가능
    if (user.role !== 'admin' && user.role !== 'recruiter') {
      throw new Error('강제 확정은 관리자 또는 리크루터만 가능합니다.');
    }

    const candidate = schedule.candidates as any;
    const jobPost = candidate.job_posts as { id: string; title: string } | null | undefined;
    const positionName = jobPost?.title || '포지션 미지정';

    // 일정 옵션 조회
    let selectedOption;
    if (optionId) {
      const { data: option, error: optionError } = await supabase
        .from('schedule_options')
        .select('*')
        .eq('id', optionId)
        .eq('schedule_id', scheduleId)
        .single();

      if (optionError || !option) {
        throw new Error('선택한 일정 옵션을 찾을 수 없습니다.');
      }
      selectedOption = option;
    } else {
      // optionId가 없으면 첫 번째 pending 옵션 사용
      const { data: options, error: optionsError } = await supabase
        .from('schedule_options')
        .select('*')
        .eq('schedule_id', scheduleId)
        .eq('status', 'pending')
        .order('scheduled_at', { ascending: true })
        .limit(1);

      if (optionsError || !options || options.length === 0) {
        throw new Error('확정할 수 있는 일정 옵션이 없습니다.');
      }
      selectedOption = options[0];
    }

    // 면접관 정보 조회
    const { data: interviewers } = await supabase
      .from('users')
      .select('id, email, calendar_access_token, calendar_refresh_token')
      .in('id', schedule.interviewer_ids);

    if (!interviewers || interviewers.length === 0) {
      throw new Error('면접관 정보를 찾을 수 없습니다.');
    }

    const organizer = interviewers.find(inv => inv.calendar_access_token);
    if (!organizer || !organizer.calendar_access_token || !organizer.calendar_refresh_token) {
      throw new Error('면접관의 캘린더 정보를 찾을 수 없습니다.');
    }

    // 선택된 일정을 구글 캘린더에서 확정으로 변경
    if (selectedOption.google_event_id) {
      const endTime = new Date(selectedOption.scheduled_at);
      endTime.setMinutes(endTime.getMinutes() + schedule.duration_minutes);

      await updateCalendarEvent(
        organizer.calendar_access_token,
        organizer.calendar_refresh_token,
        selectedOption.google_event_id,
        {
          summary: `[강제 확정] ${positionName} - ${candidate.name} 면접`,
          description: `포지션: ${positionName}\n후보자: ${candidate.name}\n면접 단계: ${schedule.stage_id}\n\n면접 일정이 관리자에 의해 강제 확정되었습니다.`,
          start: {
            dateTime: selectedOption.scheduled_at,
            timeZone: 'Asia/Seoul',
          },
          end: {
            dateTime: endTime.toISOString(),
            timeZone: 'Asia/Seoul',
          },
          transparency: 'opaque',
        }
      );
    }

    // 다른 block 일정 삭제
    const { data: allOptions } = await supabase
      .from('schedule_options')
      .select('*')
      .eq('schedule_id', scheduleId);

    if (allOptions) {
      for (const option of allOptions) {
        if (option.id !== selectedOption.id && option.google_event_id) {
          try {
            await deleteCalendarEvent(
              organizer.calendar_access_token,
              organizer.calendar_refresh_token,
              option.google_event_id
            );
          } catch (error) {
            console.error(`옵션 ${option.id}의 이벤트 삭제 실패:`, error);
          }
        }
      }
    }

    // 선택된 옵션을 selected로 변경
    await supabase
      .from('schedule_options')
      .update({ status: 'selected' })
      .eq('id', selectedOption.id);

    // 다른 옵션들을 rejected로 변경
    if (allOptions) {
      const otherOptionIds = allOptions
        .filter(opt => opt.id !== selectedOption.id)
        .map(opt => opt.id);
      
      if (otherOptionIds.length > 0) {
        await supabase
          .from('schedule_options')
          .update({ status: 'rejected' })
          .in('id', otherOptionIds);
      }
    }

    // 메인 스케줄 업데이트
    await supabase
      .from('schedules')
      .update({
        scheduled_at: selectedOption.scheduled_at,
        status: 'confirmed',
        workflow_status: 'confirmed',
        google_event_id: selectedOption.google_event_id,
        candidate_response: 'accepted',
        manual_override: true,
        manual_override_by: user.userId,
      })
      .eq('id', scheduleId);

    // 강제 확정 안내 메시지 전송 (면접관 및 후보자)
    const confirmedDate = new Date(selectedOption.scheduled_at);
    const confirmedEndTime = new Date(confirmedDate);
    confirmedEndTime.setMinutes(confirmedEndTime.getMinutes() + schedule.duration_minutes);

    const confirmationMessage = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #dc2626;">면접 일정이 강제 확정되었습니다</h2>
        <p>안녕하세요.</p>
        <p>면접 일정이 관리자에 의해 강제 확정되었습니다. 아래 일정을 확인해주세요.</p>
        
        <div style="margin: 20px 0; padding: 20px; background-color: #fee2e2; border-radius: 8px; border-left: 4px solid #dc2626;">
          <h3 style="margin: 0 0 10px 0; color: #333;">확정된 면접 일정</h3>
          <p style="margin: 5px 0; font-size: 16px;">
            <strong>후보자:</strong> ${candidate.name}
          </p>
          <p style="margin: 5px 0; font-size: 16px;">
            <strong>일시:</strong> ${format(confirmedDate, 'yyyy년 MM월 dd일 (EEE) HH:mm', { locale: ko })} - ${format(confirmedEndTime, 'HH:mm')}
          </p>
          <p style="margin: 5px 0; font-size: 16px;">
            <strong>소요 시간:</strong> ${schedule.duration_minutes}분
          </p>
        </div>
        
        <p style="margin-top: 30px; font-size: 14px; color: #666;">
          구글 캘린더에 일정이 추가되었습니다. 확인해주세요.
        </p>
        
        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
        <p style="font-size: 12px; color: #999; text-align: center;">
          이 메일은 VNTG ATS 시스템에서 자동으로 발송되었습니다.
        </p>
      </body>
      </html>
    `;

    // 면접관(organizer)의 Google Workspace 토큰을 사용하여 이메일 발송
    if (organizer.calendar_access_token && organizer.calendar_refresh_token && organizer.email) {
      // 후보자에게 확정 안내
      await sendEmailViaGmail(
        organizer.calendar_access_token,
        organizer.calendar_refresh_token,
        {
          to: candidate.email,
          from: organizer.email,
          subject: `[면접 일정 확정] ${candidate.name}님의 면접 일정이 확정되었습니다`,
          html: confirmationMessage,
          replyTo: organizer.email,
        }
      );

      // 면접관들에게 확정 안내
      for (const interviewer of interviewers) {
        if (interviewer.email && interviewer.id !== organizer.id) {
          await sendEmailViaGmail(
            organizer.calendar_access_token,
            organizer.calendar_refresh_token,
            {
              to: interviewer.email,
              from: organizer.email,
              subject: `[면접 일정 확정] ${candidate.name}님의 면접 일정이 확정되었습니다`,
              html: confirmationMessage,
              replyTo: organizer.email,
            }
          );
        }
      }
    }

    // 타임라인 이벤트 생성
    const { data: timelineData, error: timelineError } = await supabase.from('timeline_events').insert({
      candidate_id: candidate.id,
      type: 'schedule_force_confirmed',
      content: {
        message: '면접 일정이 관리자에 의해 강제 확정되었습니다.',
        schedule_id: scheduleId,
        scheduled_at: selectedOption.scheduled_at,
        option_id: selectedOption.id,
        interviewers: schedule.interviewer_ids,
        forced_by: user.userId,
      },
      created_by: user.userId,
    }).select();

    if (timelineError) {
      console.error('[타임라인] 이벤트 생성 실패 (강제 확정):', timelineError);
    } else {
      console.log(`[타임라인] 이벤트 생성 성공:`, timelineData?.[0]?.id);
    }

    // 캐시 무효화
    revalidatePath('/dashboard/calendar');
    revalidatePath(`/dashboard/candidates/${candidate.id}`);

    return {
      success: true,
      schedule: {
        ...schedule,
        scheduled_at: selectedOption.scheduled_at,
        status: 'confirmed',
      },
    };
  });
}

/**
 * 수동 조율로 일정 수정
 * 관리자가 확정된 일정을 직접 수정
 * @param scheduleId 면접 일정 ID
 * @param formData 수정할 정보
 * @returns 수정된 일정 데이터
 */
export async function updateScheduleWithManualOverride(scheduleId: string, formData: FormData) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const isAdmin = user.role === 'admin';
    const supabase = isAdmin ? createServiceClient() : await createClient();

    // 면접 일정 조회 및 권한 확인
    const { data: schedule, error: scheduleError } = await supabase
      .from('schedules')
      .select(`
        *,
        candidates!inner (
          id,
          name,
          email,
          job_posts (
            id,
            title
          )
        )
      `)
      .eq('id', scheduleId)
      .single();

    if (scheduleError || !schedule) {
      throw new Error('면접 일정을 찾을 수 없습니다.');
    }

    await verifyCandidateAccess(schedule.candidate_id);

    // 관리자 또는 리크루터만 수동 수정 가능
    if (user.role !== 'admin' && user.role !== 'recruiter') {
      throw new Error('수동 일정 수정은 관리자 또는 리크루터만 가능합니다.');
    }

    const candidate = schedule.candidates as any;
    const jobPost = candidate.job_posts as { id: string; title: string } | null | undefined;
    const positionName = jobPost?.title || '포지션 미지정';

    // 수정할 데이터 구성
    const updateData: ScheduleUpdate & {
      manual_override?: boolean;
      manual_override_by?: string;
    } = {
      manual_override: true,
      manual_override_by: user.userId,
    };

    if (formData.get('scheduled_at')) {
      updateData.scheduled_at = validateFutureDate(
        new Date(validateRequired(formData.get('scheduled_at'), '면접 일시')),
        '면접 일시'
      ).toISOString();
    }

    if (formData.get('duration_minutes')) {
      updateData.duration_minutes = validateNumberRange(
        parseInt(validateRequired(formData.get('duration_minutes'), '면접 시간')),
        15,
        480,
        '면접 시간'
      );
    }

    if (formData.get('interviewer_ids')) {
    // JSON.parse 결과는 타입 추론이 `unknown[]`이 되기 쉬우므로, 면접관 ID는 반드시 `string[]`임을 명시합니다.
    const interviewerIds = validateNonEmptyArray<string>(
      JSON.parse(validateRequired(formData.get('interviewer_ids'), '면접관 목록')) as string[],
      '면접관 목록'
    );

      // 면접관 권한 확인
      const { data: interviewers } = await supabase
        .from('users')
        .select('id, organization_id')
        .in('id', interviewerIds);

      if (!interviewers || interviewers.length !== interviewerIds.length) {
        throw new Error('일부 면접관을 찾을 수 없습니다.');
      }

      const invalidInterviewers = interviewers.filter(
        inv => inv.organization_id !== user.organizationId
      );
      if (invalidInterviewers.length > 0) {
        throw new Error('다른 조직의 면접관은 추가할 수 없습니다.');
      }

      updateData.interviewer_ids = interviewerIds;
    }

    // 구글 캘린더 이벤트 업데이트
    if (schedule.google_event_id && (updateData.scheduled_at || updateData.duration_minutes)) {
      const { data: interviewers } = await supabase
        .from('users')
        .select('id, email, calendar_access_token, calendar_refresh_token')
        .in('id', schedule.interviewer_ids);

      const organizer = interviewers?.find(inv => inv.calendar_access_token);
      if (organizer && organizer.calendar_access_token && organizer.calendar_refresh_token) {
        const newScheduledAt = updateData.scheduled_at ? new Date(updateData.scheduled_at) : new Date(schedule.scheduled_at);
        const newDurationMinutes = updateData.duration_minutes || schedule.duration_minutes;
        const newEndTime = new Date(newScheduledAt);
        newEndTime.setMinutes(newEndTime.getMinutes() + newDurationMinutes);

        try {
          await updateCalendarEvent(
            organizer.calendar_access_token,
            organizer.calendar_refresh_token,
            schedule.google_event_id,
            {
              summary: `[수동 수정] ${positionName} - ${candidate.name} 면접`,
              description: `포지션: ${positionName}\n후보자: ${candidate.name}\n면접 단계: ${schedule.stage_id}\n\n이 일정은 관리자에 의해 수동으로 수정되었습니다.`,
              start: {
                dateTime: newScheduledAt.toISOString(),
                timeZone: 'Asia/Seoul',
              },
              end: {
                dateTime: newEndTime.toISOString(),
                timeZone: 'Asia/Seoul',
              },
              transparency: 'opaque',
            }
          );
        } catch (error) {
          console.error('구글 캘린더 이벤트 업데이트 실패:', error);
          // 캘린더 업데이트 실패해도 DB 업데이트는 계속 진행
        }
      }
    }

    const { data, error } = await supabase
      .from('schedules')
      .update(updateData)
      .eq('id', scheduleId)
      .select()
      .single();

    if (error) {
      throw new Error(`면접 일정 수정 실패: ${error.message}`);
    }

    // 타임라인 이벤트 생성
    const { data: timelineData, error: timelineError } = await supabase.from('timeline_events').insert({
      candidate_id: schedule.candidate_id,
      type: 'schedule_manually_edited',
      content: {
        message: '면접 일정이 관리자에 의해 수동으로 수정되었습니다.',
        schedule_id: scheduleId,
        changes: {
          scheduled_at: updateData.scheduled_at,
          duration_minutes: updateData.duration_minutes,
          interviewer_ids: updateData.interviewer_ids,
        },
        edited_by: user.userId,
      },
      created_by: user.userId,
    }).select();

    if (timelineError) {
      console.error('[타임라인] 이벤트 생성 실패 (수동 수정):', timelineError);
    } else {
      console.log(`[타임라인] 이벤트 생성 성공:`, timelineData?.[0]?.id);
    }

    // 캐시 무효화
    revalidatePath('/dashboard/calendar');
    revalidatePath(`/dashboard/candidates/${schedule.candidate_id}`);
    revalidatePath('/dashboard/schedules');

    return data;
  });
}