'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { getCurrentUser, verifyCandidateAccess } from '@/api/utils/auth';
import { getCandidateById } from '@/api/queries/candidates';
import { validateRequired, validateUUID, validateFutureDate, validateNumberRange, validateNonEmptyArray } from '@/api/utils/validation';
import { withErrorHandling } from '@/api/utils/errors';
import { Database } from '@/lib/supabase/types';
import { getBusyTimes, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, getEventAttendeesStatus, refreshAccessTokenIfNeeded } from '@/lib/calendar/google';
import { findAvailableTimeSlots } from '@/lib/ai/schedule';
import { sendEmailViaGmail, generateScheduleSelectionUrl } from '@/lib/email/gmail';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale/ko';
import { extendDateRangeByWeek, shouldExtendDateRange, getDateRangeForRetry } from '@/api/utils/schedule-date-range';

type ScheduleInsert = Database['public']['Tables']['schedules']['Insert'];
type ScheduleUpdate = Database['public']['Tables']['schedules']['Update'];

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
    const interviewerIds = validateNonEmptyArray(
      JSON.parse(validateRequired(formData.get('interviewer_ids'), '면접관 목록')),
      '면접관 목록'
    );

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
      const interviewerIds = validateNonEmptyArray(
        JSON.parse(validateRequired(formData.get('interviewer_ids'), '면접관 목록')),
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
              // 이벤트 삭제 실패해도 DB 삭제는 계속 진행
            }
          }
        }
      } else {
        console.warn('구글 캘린더에 연동된 면접관을 찾을 수 없습니다. 이벤트 삭제를 건너뜁니다.');
      }
    }

    // 타임라인 이벤트 생성
    const { error: timelineError } = await supabase.from('timeline_events').insert({
      candidate_id: schedule.candidate_id,
      type: 'schedule_created',
      content: {
        message: '면접 일정이 삭제되었습니다.',
        schedule_id: id,
      },
      created_by: user.userId,
    });

    if (timelineError) {
      console.error('[타임라인] 이벤트 생성 실패 (일정 삭제):', timelineError);
      if (timelineError.code === '23514') {
        console.error('[타임라인] DB 스키마 제약 조건 위반 - schedule_created 타입이 허용되지 않음.');
      }
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

    // 타임라인 이벤트 생성
    const { error: timelineError } = await supabase.from('timeline_events').insert({
      candidate_id: schedule.candidate_id,
      type: 'schedule_created',
      content: {
        message: '면접 일정이 취소되었습니다.',
        schedule_id: id,
      },
      created_by: user.userId,
    });

    if (timelineError) {
      console.error('[타임라인] 이벤트 생성 실패 (일정 취소):', timelineError);
      if (timelineError.code === '23514') {
        console.error('[타임라인] DB 스키마 제약 조건 위반 - schedule_created 타입이 허용되지 않음.');
      }
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

    const candidate = schedule.candidates as { id: string; token: string } | null | undefined;
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
    if (response === 'rejected' && schedule.workflow_status === 'pending_candidate') {
      console.log(`후보자가 거절함. 새로운 일정 옵션 자동 생성 시작: scheduleId=${scheduleId}`);
      try {
        const regenerateResult = await regenerateScheduleOptions(scheduleId);
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
    const interviewerIds = validateNonEmptyArray(
      JSON.parse(validateRequired(formData.get('interviewer_ids'), '면접관 목록')),
      '면접관 목록'
    );
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

    // 면접관 정보 조회 (구글 캘린더 연동 정보 포함)
    const { data: interviewers, error: interviewersError } = await supabase
      .from('users')
      .select('id, email, organization_id, calendar_provider, calendar_access_token, calendar_refresh_token')
      .in('id', interviewerIds);

    if (interviewersError || !interviewers || interviewers.length !== interviewerIds.length) {
      throw new Error('일부 면접관을 찾을 수 없습니다.');
    }

    // 구글 캘린더 연동 확인
    const interviewersWithCalendar = interviewers.filter(
      inv => inv.calendar_provider === 'google' && inv.calendar_access_token && inv.calendar_refresh_token
    );

    if (interviewersWithCalendar.length !== interviewerIds.length) {
      // 연동되지 않은 면접관 목록 생성
      const interviewersWithoutCalendar = interviewers.filter(
        inv => !(inv.calendar_provider === 'google' && inv.calendar_access_token && inv.calendar_refresh_token)
      );
      
      const missingEmails = interviewersWithoutCalendar.map(inv => inv.email).join(', ');
      throw new Error(
        `모든 면접관이 구글 캘린더에 연동되어 있어야 합니다. 연동되지 않은 면접관: ${missingEmails}`
      );
    }

    // 원본 날짜 범위 저장 (재시도 시 기준점)
    const originalStartDate = new Date(startDate);
    const originalEndDate = new Date(endDate);
    
    // 일정 검색 및 날짜 범위 확장 재시도 로직
    let retryCount = 0;
    let currentStartDate = new Date(startDate);
    let currentEndDate = new Date(endDate);
    let selectedSlots: Array<{ scheduledAt: Date; duration: number; availableInterviewers: string[] }> = [];
    let lastError: Error | null = null;

    while (retryCount <= 5) {
      // 면접관들의 바쁜 시간 조회
      const allBusyTimes: Array<{ start: { dateTime: string; timeZone: string }; end: { dateTime: string; timeZone: string } }> = [];
      
      for (const interviewer of interviewersWithCalendar) {
        try {
          const token = await refreshAccessTokenIfNeeded(
            interviewer.calendar_access_token!,
            interviewer.calendar_refresh_token!
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

      // 공통 가능 일정 찾기 (AI 사용)
      const availableSlots = await findAvailableTimeSlots({
        candidateName: candidate.name,
        stageName: stageId,
        interviewerIds: interviewerIds,
        busyTimes: allBusyTimes.map(bt => ({
          id: '',
          summary: '',
          start: bt.start,
          end: bt.end,
        })),
        startDate: currentStartDate,
        endDate: currentEndDate,
        durationMinutes,
      });

      // 상위 N개 일정 선택 (numOptions만큼)
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
      candidate_response: 'pending' as const,
      workflow_status: 'pending_interviewers' as const,
      // 마이그레이션이 적용된 경우에만 이 필드들을 포함 (타입 단언 사용)
      original_start_date: originalStartDate.toISOString(),
      original_end_date: originalEndDate.toISOString(),
      retry_count: retryCount,
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
    
    for (const slot of selectedSlots) {
      const endTime = new Date(slot.scheduledAt);
      endTime.setMinutes(endTime.getMinutes() + durationMinutes);

      // 첫 번째 면접관의 토큰을 사용하여 이벤트 생성 (주최자)
      const organizer = interviewersWithCalendar[0];
      const organizerToken = await refreshAccessTokenIfNeeded(
        organizer.calendar_access_token!,
        organizer.calendar_refresh_token!
      );

      // 구글 캘린더에 block 일정 생성
      const eventId = await createCalendarEvent(
        organizerToken,
        organizer.calendar_refresh_token!,
        {
          summary: `[Block] ${positionName} - ${candidate.name} 면접 일정 (확정 대기)`,
          description: `포지션: ${positionName}\n후보자: ${candidate.name}\n면접 단계: ${stageId}\n\n이 일정은 아직 확정되지 않았습니다. 모든 면접관이 수락하면 후보자에게 전송됩니다.`,
          start: {
            dateTime: slot.scheduledAt.toISOString(),
            timeZone: 'Asia/Seoul',
          },
          end: {
            dateTime: endTime.toISOString(),
            timeZone: 'Asia/Seoul',
          },
          attendees: interviewersWithCalendar.map(inv => ({ email: inv.email })),
          transparency: 'opaque', // block 일정이므로 불투명
        }
      );

      // schedule_options에 저장
      const { data: option, error: optionError } = await supabase
        .from('schedule_options')
        .insert({
          schedule_id: schedule.id,
          scheduled_at: slot.scheduledAt.toISOString(),
          status: 'pending',
          google_event_id: eventId,
          interviewer_responses: {}, // 초기값: 빈 객체
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

      scheduleOptions.push(option);
    }

    // 면접관들에게 일정 확인 안내 메일 발송
    const organizer = interviewersWithCalendar[0];
    if (organizer.calendar_access_token && organizer.calendar_refresh_token && organizer.email) {
      // 일정 옵션 목록을 HTML로 포맷팅
      const optionsListHtml = scheduleOptions.map((opt, index) => {
        const date = new Date(opt.scheduled_at);
        const endTime = new Date(date);
        endTime.setMinutes(endTime.getMinutes() + durationMinutes);
        
        return `
          <div style="margin: 15px 0; padding: 15px; background-color: #f5f5f5; border-radius: 5px;">
            <p style="margin: 0; font-weight: bold; color: #333;">
              옵션 ${index + 1}: ${format(date, 'yyyy년 MM월 dd일 (EEE) HH:mm', { locale: ko })} - ${format(endTime, 'HH:mm', { locale: ko })}
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
                <strong>면접 단계:</strong> ${stageId}
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
    
    console.log(`[타임라인] 일정 자동화 시작 이벤트 생성: candidateId=${candidateId}, scheduleId=${schedule.id}`);
    
    const { data: timelineData, error: timelineError } = await supabase.from('timeline_events').insert({
      candidate_id: candidateId,
      type: 'schedule_created',
      content: {
        message: timelineMessage,
        schedule_id: schedule.id,
        schedule_options: scheduleOptions.map(opt => ({
          id: opt.id,
          scheduled_at: opt.scheduled_at,
        })),
        interviewers: interviewerIds,
        retry_count: retryCount,
        original_date_range: {
          start: originalStartDate.toISOString(),
          end: originalEndDate.toISOString(),
        },
      },
      created_by: user.userId,
    }).select();

    if (timelineError) {
      console.error('[타임라인] 이벤트 생성 실패 (일정 자동화 시작):', {
        error: timelineError,
        code: timelineError.code,
        message: timelineError.message,
        details: timelineError.details,
        hint: timelineError.hint,
        candidateId,
        type: 'schedule_created',
        scheduleId: schedule.id,
      });
      console.error('[타임라인] 에러 상세:', JSON.stringify(timelineError, null, 2));
      // DB 제약 조건 위반인지 확인
      if (timelineError.code === '23514') {
        console.error('[타임라인] DB 스키마 제약 조건 위반 - schedule_created 타입이 허용되지 않음. 마이그레이션을 확인하세요.');
        console.error('[타임라인] 마이그레이션 파일: 20260225000000_extend_timeline_event_types.sql');
      }
      // RLS 정책 위반인지 확인
      if (timelineError.code === '42501' || timelineError.message?.includes('row-level security')) {
        console.error('[타임라인] RLS 정책 위반 - 권한 문제. Service Role Client 사용 필요할 수 있음.');
      }
      // 타임라인 이벤트 생성 실패해도 일정 생성은 성공한 것으로 처리
    } else {
      console.log(`[타임라인] 이벤트 생성 성공:`, timelineData?.[0]?.id);
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
async function regenerateScheduleOptions(scheduleId: string) {
  const user = await getCurrentUser();
  const isAdmin = user.role === 'admin';
  const supabase = isAdmin ? createServiceClient() : await createClient();

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

  await verifyCandidateAccess(schedule.candidate_id);

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

  // 기존에 생성된 일정 옵션의 개수를 확인하여 동일한 개수로 재생성
  // (처음 생성 시 설정한 개수와 동일하게 유지)
  const { count: existingOptionsCount } = await supabase
    .from('schedule_options')
    .select('id', { count: 'exact', head: true })
    .eq('schedule_id', scheduleId);
  
  // 기존 일정 옵션 개수가 있으면 그 개수를 사용하고, 없으면 기본값 2 사용
  const numOptions = existingOptionsCount && existingOptionsCount > 0 ? existingOptionsCount : 2;

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
        const token = await refreshAccessTokenIfNeeded(
          interviewer.calendar_access_token!,
          interviewer.calendar_refresh_token!
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

    // 공통 가능 일정 찾기 (AI 사용)
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
  
  for (const slot of selectedSlots) {
    const endTime = new Date(slot.scheduledAt);
    endTime.setMinutes(endTime.getMinutes() + schedule.duration_minutes);

    // 첫 번째 면접관의 토큰을 사용하여 이벤트 생성 (주최자)
    const organizer = interviewersWithCalendar[0];
    const organizerToken = await refreshAccessTokenIfNeeded(
      organizer.calendar_access_token!,
      organizer.calendar_refresh_token!
    );

    // 구글 캘린더에 block 일정 생성
    const eventId = await createCalendarEvent(
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
        attendees: interviewersWithCalendar.map(inv => ({ email: inv.email })),
        transparency: 'opaque',
      }
    );

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
    const optionsListHtml = scheduleOptions.map((opt, index) => {
      const date = new Date(opt.scheduled_at);
      const endTime = new Date(date);
      endTime.setMinutes(endTime.getMinutes() + schedule.duration_minutes);
      
      return `
        <div style="margin: 15px 0; padding: 15px; background-color: #f5f5f5; border-radius: 5px;">
          <p style="margin: 0; font-weight: bold; color: #333;">
            옵션 ${index + 1}: ${format(date, 'yyyy년 MM월 dd일 (EEE) HH:mm', { locale: ko })} - ${format(endTime, 'HH:mm', { locale: ko })}
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
              <strong>면접 단계:</strong> ${schedule.stage_id}
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
  
  console.log(`[타임라인] 일정 재생성 이벤트 생성: candidateId=${schedule.candidate_id}, scheduleId=${scheduleId}`);
  
  const { data: timelineData, error: timelineError } = await supabase.from('timeline_events').insert({
    candidate_id: schedule.candidate_id,
    type: 'schedule_regenerated',
    content: {
      message: timelineMessage,
      schedule_id: scheduleId,
      schedule_options: scheduleOptions.map(opt => ({
        id: opt.id,
        scheduled_at: opt.scheduled_at,
      })),
      interviewers: schedule.interviewer_ids,
      retry_count: retryCount,
      previous_retry_count: currentRetryCount,
    },
    created_by: user.userId,
  }).select();

  if (timelineError) {
    console.error('[타임라인] 이벤트 생성 실패 (일정 재생성):', {
      error: timelineError,
      code: timelineError.code,
      message: timelineError.message,
      details: timelineError.details,
      hint: timelineError.hint,
      candidateId: schedule.candidate_id,
      type: 'schedule_regenerated',
      scheduleId,
    });
    console.error('[타임라인] 에러 상세:', JSON.stringify(timelineError, null, 2));
    // DB 제약 조건 위반인지 확인
    if (timelineError.code === '23514') {
      console.error('[타임라인] DB 스키마 제약 조건 위반 - schedule_regenerated 타입이 허용되지 않음. 마이그레이션을 확인하세요.');
      console.error('[타임라인] 마이그레이션 파일: 20260225000000_extend_timeline_event_types.sql');
    }
    // RLS 정책 위반인지 확인
    if (timelineError.code === '42501' || timelineError.message?.includes('row-level security')) {
      console.error('[타임라인] RLS 정책 위반 - 권한 문제. Service Role Client 사용 필요할 수 있음.');
    }
    // 타임라인 이벤트 생성 실패해도 일정 재생성은 성공한 것으로 처리
  } else {
    console.log(`[타임라인] 이벤트 생성 성공:`, timelineData?.[0]?.id);
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
export async function checkInterviewerResponses(scheduleId: string) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    
    // Service Role Client를 사용하여 RLS 정책 우회 (타임라인 이벤트 생성 안정성을 위해)
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

    await verifyCandidateAccess(schedule.candidate_id);

    // workflow_status가 pending_interviewers가 아니면 확인 불필요
    if (schedule.workflow_status !== 'pending_interviewers') {
      return { message: '이미 처리된 일정입니다.', alreadyProcessed: true };
    }

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
    const updatedOptions: Array<{ id: string; allDeclined: boolean; hasResponse: boolean }> = [];

    for (const option of options) {
      if (!option.google_event_id) {
        updatedOptions.push({ id: option.id, allDeclined: false, hasResponse: false });
        continue;
      }

      // 첫 번째 면접관의 토큰 사용
      const organizer = interviewers.find(inv => inv.calendar_access_token);
      if (!organizer || !organizer.calendar_access_token || !organizer.calendar_refresh_token) {
        updatedOptions.push({ id: option.id, allDeclined: false, hasResponse: false });
        continue;
      }

      try {
        const responses = await getEventAttendeesStatus(
          organizer.calendar_access_token,
          organizer.calendar_refresh_token,
          option.google_event_id
        );

        // 면접관별 응답 상태 업데이트
        const interviewerResponses: Record<string, string> = {};
        let allAccepted = true;
        let allDeclined = true;
        let hasResponse = false;

        for (const interviewer of interviewers) {
          const response = responses[interviewer.email] || 'needsAction';
          interviewerResponses[interviewer.id] = response;
          
          if (response !== 'accepted') {
            allAccepted = false;
          }
          
          // needsAction이 아니면 응답이 있는 것으로 간주
          if (response !== 'needsAction') {
            hasResponse = true;
          }
          
          // declined가 아니면 모두 거절된 것은 아님
          if (response !== 'declined') {
            allDeclined = false;
          }
        }

        // 이전 응답 상태 조회 (변경 감지용)
        const previousResponses = (option.interviewer_responses as Record<string, string>) || {};
        
        // DB에 응답 상태 저장
        const { error: updateError } = await supabase
          .from('schedule_options')
          .update({ interviewer_responses: interviewerResponses })
          .eq('id', option.id);

        if (updateError) {
          console.error(`옵션 ${option.id}의 응답 상태 업데이트 실패:`, updateError);
        } else {
          console.log(`옵션 ${option.id}의 응답 상태 업데이트 완료:`, interviewerResponses);
          
          // 면접관 응답이 변경된 경우 타임라인 이벤트 생성
          const changedResponses: Array<{ interviewerId: string; interviewerEmail: string; previousResponse: string; newResponse: string }> = [];
          
          for (const interviewer of interviewers) {
            const previousResponse = previousResponses[interviewer.id] || 'needsAction';
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
          
          // 변경된 응답이 있으면 타임라인 이벤트 생성
          if (changedResponses.length > 0) {
            console.log(`[타임라인] 변경된 응답 ${changedResponses.length}개 발견, 타임라인 이벤트 생성 시작`);
            for (const changed of changedResponses) {
              const responseText = changed.newResponse === 'accepted' ? '수락' : changed.newResponse === 'declined' ? '거절' : '보류';
              const optionDate = new Date(option.scheduled_at);
              
              console.log(`[타임라인] 면접관 응답 이벤트 생성: ${changed.interviewerEmail} - ${responseText}`);
              
              const { data: timelineData, error: timelineError } = await supabase.from('timeline_events').insert({
                candidate_id: schedule.candidate_id,
                type: 'interviewer_response',
                content: {
                  message: `${changed.interviewerEmail}님이 일정 옵션(${format(optionDate, 'yyyy-MM-dd HH:mm', { locale: ko })})을 ${responseText}했습니다.`,
                  schedule_id: scheduleId,
                  option_id: option.id,
                  option_scheduled_at: option.scheduled_at,
                  interviewer_id: changed.interviewerId,
                  interviewer_email: changed.interviewerEmail,
                  response: changed.newResponse,
                  previous_response: changed.previousResponse,
                },
                created_by: changed.interviewerId, // 면접관 ID 사용
              }).select();

              if (timelineError) {
                console.error('[타임라인] 이벤트 생성 실패 (면접관 응답):', {
                  error: timelineError,
                  code: timelineError.code,
                  message: timelineError.message,
                  details: timelineError.details,
                  hint: timelineError.hint,
                  candidateId: schedule.candidate_id,
                  type: 'interviewer_response',
                  scheduleId,
                  optionId: option.id,
                  interviewerEmail: changed.interviewerEmail,
                });
                console.error('[타임라인] 에러 상세:', JSON.stringify(timelineError, null, 2));
                // DB 제약 조건 위반인지 확인
                if (timelineError.code === '23514') {
                  console.error('[타임라인] DB 스키마 제약 조건 위반 - interviewer_response 타입이 허용되지 않음. 마이그레이션을 확인하세요.');
                  console.error('[타임라인] 마이그레이션 파일: 20260225000000_extend_timeline_event_types.sql');
                }
                // RLS 정책 위반인지 확인
                if (timelineError.code === '42501' || timelineError.message?.includes('row-level security')) {
                  console.error('[타임라인] RLS 정책 위반 - 권한 문제. Service Role Client 사용 필요할 수 있음.');
                }
              } else {
                console.log(`[타임라인] 이벤트 생성 성공:`, timelineData?.[0]?.id);
              }
            }
          } else {
            console.log(`[타임라인] 변경된 응답 없음 (previous: ${JSON.stringify(previousResponses)}, current: ${JSON.stringify(interviewerResponses)})`);
          }
        }

        // 모든 면접관이 수락한 경우
        if (allAccepted && !allAcceptedOption) {
          console.log(`모든 면접관이 수락한 일정 옵션 발견: ${option.id} (${option.scheduled_at})`);
          allAcceptedOption = option;
        }

        // 옵션 상태 업데이트 정보 저장
        updatedOptions.push({ id: option.id, allDeclined, hasResponse });
      } catch (error) {
        console.error(`옵션 ${option.id}의 응답 확인 실패:`, error);
        // 에러가 발생해도 다른 옵션은 계속 확인
        updatedOptions.push({ id: option.id, allDeclined: false, hasResponse: false });
      }
    }

    // 모든 면접관이 수락한 일정이 있으면 후보자에게 전송
    if (allAcceptedOption) {
      console.log(`모든 면접관이 수락한 일정이 있어 후보자에게 전송 시작: scheduleId=${scheduleId}, optionId=${allAcceptedOption.id}`);
      
      // 모든 면접관이 수락한 경우 타임라인 이벤트 생성
      const optionDate = new Date(allAcceptedOption.scheduled_at);
      console.log(`[타임라인] 모든 면접관 수락 이벤트 생성: candidateId=${schedule.candidate_id}, optionId=${allAcceptedOption.id}`);
      
      // organizer는 이미 위에서 조회됨
      const organizer = interviewers.find(inv => inv.calendar_access_token);
      const organizerId = organizer?.id || (interviewers.length > 0 ? interviewers[0].id : null);
      
      const { data: timelineData, error: timelineError } = await supabase.from('timeline_events').insert({
        candidate_id: schedule.candidate_id,
        type: 'interviewer_response',
        content: {
          message: `모든 면접관이 일정 옵션(${format(optionDate, 'yyyy-MM-dd HH:mm', { locale: ko })})을 수락했습니다. 후보자에게 전송됩니다.`,
          schedule_id: scheduleId,
          option_id: allAcceptedOption.id,
          option_scheduled_at: allAcceptedOption.scheduled_at,
          all_accepted: true,
          interviewers: schedule.interviewer_ids,
        },
        created_by: organizerId, // organizer ID 사용 (없으면 첫 번째 면접관 ID)
      }).select();

      if (timelineError) {
        console.error('[타임라인] 이벤트 생성 실패 (모든 면접관 수락):', {
          error: timelineError,
          code: timelineError.code,
          message: timelineError.message,
          details: timelineError.details,
          hint: timelineError.hint,
          candidateId: schedule.candidate_id,
          type: 'interviewer_response',
          scheduleId,
          optionId: allAcceptedOption.id,
        });
        console.error('[타임라인] 에러 상세:', JSON.stringify(timelineError, null, 2));
        // DB 제약 조건 위반인지 확인
        if (timelineError.code === '23514') {
          console.error('[타임라인] DB 스키마 제약 조건 위반 - interviewer_response 타입이 허용되지 않음. 마이그레이션을 확인하세요.');
          console.error('[타임라인] 마이그레이션 파일: 20260225000000_extend_timeline_event_types.sql');
        }
        // RLS 정책 위반인지 확인
        if (timelineError.code === '42501' || timelineError.message?.includes('row-level security')) {
          console.error('[타임라인] RLS 정책 위반 - 권한 문제. Service Role Client 사용 필요할 수 있음.');
        }
      } else {
        console.log(`[타임라인] 이벤트 생성 성공:`, timelineData?.[0]?.id);
      }
      
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

    // 모든 일정 옵션이 거절되었는지 확인
    // 응답이 있고 모두 거절된 옵션만 확인 (아직 응답이 없는 옵션은 제외)
    const respondedOptions = updatedOptions.filter(opt => opt.hasResponse);
    const allDeclinedOptions = respondedOptions.filter(opt => opt.allDeclined);
    
    // 모든 응답이 있는 옵션이 거절되었고, 응답이 있는 옵션이 하나 이상 있는 경우
    if (respondedOptions.length > 0 && respondedOptions.length === allDeclinedOptions.length) {
      console.log(`모든 일정 옵션이 거절됨: scheduleId=${scheduleId}, 거절된 옵션 수=${allDeclinedOptions.length}`);
      
      // 모든 거절된 옵션의 status를 'rejected'로 업데이트
      const declinedOptionIds = allDeclinedOptions.map(opt => opt.id);
      const { error: updateStatusError } = await supabase
        .from('schedule_options')
        .update({ status: 'rejected' })
        .in('id', declinedOptionIds);
      
      if (updateStatusError) {
        console.error('거절된 옵션 status 업데이트 실패:', updateStatusError);
      } else {
        console.log(`거절된 옵션 ${declinedOptionIds.length}개의 status를 'rejected'로 업데이트 완료`);
      }
      
      // 새로운 일정 옵션 자동 생성 시도
      try {
        console.log(`새로운 일정 옵션 자동 생성 시작: scheduleId=${scheduleId}`);
        const regenerateResult = await regenerateScheduleOptions(scheduleId);
        
        // 캐시 무효화하여 최신 상태 반영
        revalidatePath(`/dashboard/candidates/${schedule.candidate_id}`);
        revalidatePath('/dashboard/schedules');
        
        return {
          message: regenerateResult.message || '모든 일정 옵션이 거절되어 새로운 일정 옵션이 자동으로 생성되었습니다.',
          allAccepted: false,
          allDeclined: true,
          regenerated: true,
        };
      } catch (regenerateError) {
        console.error('새로운 일정 옵션 생성 실패:', regenerateError);
        
        // 새로운 일정 생성 실패 시 스케줄을 취소 상태로 변경
        const { error: updateScheduleError } = await supabase
          .from('schedules')
          .update({ workflow_status: 'cancelled' })
          .eq('id', scheduleId);
        
        if (updateScheduleError) {
          console.error('스케줄 workflow_status 업데이트 실패:', updateScheduleError);
        }
        
        // 캐시 무효화하여 최신 상태 반영
        revalidatePath(`/dashboard/candidates/${schedule.candidate_id}`);
        revalidatePath('/dashboard/schedules');
        
        return {
          message: `모든 일정 옵션이 거절되었지만, 새로운 일정을 찾을 수 없습니다: ${regenerateError instanceof Error ? regenerateError.message : '알 수 없는 오류'}. 면접 일정이 취소되었습니다.`,
          allAccepted: false,
          allDeclined: true,
          regenerated: false,
          error: regenerateError instanceof Error ? regenerateError.message : '알 수 없는 오류',
        };
      }
    }

    // 아직 일부 옵션은 대기 중이거나 일부는 거절된 상태
    console.log(`모든 면접관이 수락한 일정이 없음: scheduleId=${scheduleId}`);
    
    // 캐시 무효화하여 최신 상태 반영
    revalidatePath(`/dashboard/candidates/${schedule.candidate_id}`);
    revalidatePath('/dashboard/schedules');

    return {
      message: '아직 모든 면접관이 수락하지 않았습니다. 계속 대기 중입니다.',
      allAccepted: false,
      allDeclined: false,
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
    const user = await getCurrentUser();
    const isAdmin = user.role === 'admin';
    
    // 관리자일 경우 Service Role Client를 사용하여 RLS 정책 우회
    const supabase = isAdmin ? createServiceClient() : await createClient();

    // 현재 사용자의 Google Workspace 토큰 조회 (Gmail API 사용을 위해)
    const { data: currentUserData, error: userTokenError } = await supabase
      .from('users')
      .select('calendar_access_token, calendar_refresh_token, email')
      .eq('id', user.userId)
      .single();

    if (userTokenError || !currentUserData) {
      throw new Error('사용자 정보를 찾을 수 없습니다.');
    }

    if (!currentUserData.calendar_access_token || !currentUserData.calendar_refresh_token) {
      throw new Error('Google Workspace 계정이 연동되지 않았습니다. 구글 캘린더를 먼저 연동해주세요.');
    }

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

    await verifyCandidateAccess(schedule.candidate_id);

    const candidate = schedule.candidates as { id: string; name: string; email: string; token: string } | null | undefined;
    if (!candidate) {
      throw new Error('후보자 정보를 찾을 수 없습니다.');
    }

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

    // 모든 면접관이 수락한 옵션만 필터링
    const acceptedOptions = [];
    for (const option of options) {
      if (!option.interviewer_responses || typeof option.interviewer_responses !== 'object') {
        continue;
      }

      const responses = option.interviewer_responses as Record<string, string>;
      const allAccepted = schedule.interviewer_ids.every((interviewerId: string) => {
        return responses[interviewerId] === 'accepted';
      });

      if (allAccepted) {
        acceptedOptions.push(option);
      }
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
      currentUserData.calendar_access_token,
      currentUserData.calendar_refresh_token,
      {
        to: candidate.email,
        from: currentUserData.email || user.email,
        subject: `[면접 일정] ${candidate.name}님, 면접 일정을 선택해주세요`,
        html: emailHtml,
        replyTo: currentUserData.email || user.email,
      }
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
      from_email: user.email,
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
      created_by: user.userId,
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
        userId: user.userId,
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
          // 일정 옵션 목록을 HTML로 포맷팅
          const optionsListHtml = options.map((opt, index) => {
            const date = new Date(opt.scheduled_at);
            const endTime = new Date(date);
            endTime.setMinutes(endTime.getMinutes() + schedule.duration_minutes);
            
            return `
              <div style="margin: 15px 0; padding: 15px; background-color: #f5f5f5; border-radius: 5px;">
                <p style="margin: 0; font-weight: bold; color: #333;">
                  옵션 ${index + 1}: ${format(date, 'yyyy년 MM월 dd일 (EEE) HH:mm', { locale: ko })} - ${format(endTime, 'HH:mm', { locale: ko })}
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
                    <strong>면접 단계:</strong> ${schedule.stage_id}
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
