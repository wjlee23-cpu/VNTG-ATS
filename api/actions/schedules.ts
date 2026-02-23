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
    await supabase.from('timeline_events').insert({
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
      await supabase.from('timeline_events').insert({
        candidate_id: schedule.candidate_id,
        type: 'schedule_confirmed',
        content: {
          message: '면접 일정이 확정되었습니다.',
          schedule_id: id,
        },
        created_by: user.userId,
      });
    }

    // 캐시 무효화
    revalidatePath('/dashboard/calendar');
    revalidatePath(`/dashboard/candidates/${schedule.candidate_id}`);

    return data;
  });
}

/**
 * 면접 일정 삭제
 * @param id 면접 일정 ID
 */
export async function deleteSchedule(id: string) {
  return withErrorHandling(async () => {
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

    const { error } = await supabase
      .from('schedules')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`면접 일정 삭제 실패: ${error.message}`);
    }

    // 캐시 무효화
    revalidatePath('/dashboard/calendar');
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
    const supabase = await createClient();

    // 면접 일정과 후보자 조회
    const { data: schedule, error: scheduleError } = await supabase
      .from('schedules')
      .select(`
        id,
        candidate_id,
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

    const candidate = schedule.candidates as { token: string } | null | undefined;
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

    // 타임라인 이벤트 생성
    await supabase.from('timeline_events').insert({
      candidate_id: candidate.id,
      type: 'schedule_confirmed',
      content: {
        message: `후보자가 면접 일정을 ${response === 'accepted' ? '수락' : '거절'}했습니다.`,
        schedule_id: scheduleId,
        response,
      },
      created_by: null, // 후보자가 직접 생성
    });

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

    // 후보자 정보 조회 (권한 확인 포함, 관리자일 경우 Service Role Client 사용)
    const candidateResult = await getCandidateById(candidateId);
    
    if (candidateResult.error || !candidateResult.data) {
      console.error('후보자 조회 실패:', candidateResult.error);
      throw new Error(candidateResult.error || '후보자를 찾을 수 없습니다.');
    }
    
    const candidate = candidateResult.data;

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
          startDate,
          endDate
        );

        allBusyTimes.push(...busyTimes.map(bt => ({
          start: bt.start,
          end: bt.end,
        })));
      } catch (error) {
        console.error(`면접관 ${interviewer.email}의 캘린더 조회 실패:`, error);
        throw new Error(`면접관 ${interviewer.email}의 캘린더를 조회할 수 없습니다.`);
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
      startDate,
      endDate,
      durationMinutes,
    });

    // 상위 2개 일정 선택
    const selectedSlots = availableSlots.slice(0, 2);
    
    if (selectedSlots.length === 0) {
      throw new Error('면접관들의 공통 가능 일정을 찾을 수 없습니다.');
    }

    // 메인 스케줄 생성 (워크플로우 상태: pending_interviewers)
    const scheduleData: ScheduleInsert = {
      candidate_id: candidateId,
      stage_id: stageId,
      scheduled_at: selectedSlots[0].scheduledAt.toISOString(), // 임시로 첫 번째 일정 사용
      duration_minutes: durationMinutes,
      status: 'pending',
      interviewer_ids: interviewerIds,
      candidate_response: 'pending',
      workflow_status: 'pending_interviewers',
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
          summary: `[Block] ${candidate.name} 면접 일정 (확정 대기)`,
          description: `후보자: ${candidate.name}\n면접 단계: ${stageId}\n\n이 일정은 아직 확정되지 않았습니다. 모든 면접관이 수락하면 후보자에게 전송됩니다.`,
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

    // 타임라인 이벤트 생성
    await supabase.from('timeline_events').insert({
      candidate_id: candidateId,
      type: 'schedule_created',
      content: {
        message: '면접 일정 자동화가 시작되었습니다. 면접관들의 수락을 기다리는 중입니다.',
        schedule_id: schedule.id,
        schedule_options: scheduleOptions.map(opt => ({
          id: opt.id,
          scheduled_at: opt.scheduled_at,
        })),
        interviewers: interviewerIds,
      },
      created_by: user.userId,
    });

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
 * 면접관 응답 상태 확인
 * 구글 캘린더 API로 각 block 일정의 참석자 응답 확인
 * 모두 수락한 일정이 있으면 후보자에게 전송
 */
export async function checkInterviewerResponses(scheduleId: string) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const isAdmin = user.role === 'admin';
    
    // 관리자일 경우 Service Role Client를 사용하여 RLS 정책 우회
    const supabase = isAdmin ? createServiceClient() : await createClient();

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

    for (const option of options) {
      if (!option.google_event_id) continue;

      // 첫 번째 면접관의 토큰 사용
      const organizer = interviewers.find(inv => inv.calendar_access_token);
      if (!organizer || !organizer.calendar_access_token || !organizer.calendar_refresh_token) {
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

        for (const interviewer of interviewers) {
          const response = responses[interviewer.email] || 'needsAction';
          interviewerResponses[interviewer.id] = response;
          
          if (response !== 'accepted') {
            allAccepted = false;
          }
        }

        // DB에 응답 상태 저장
        const { error: updateError } = await supabase
          .from('schedule_options')
          .update({ interviewer_responses: interviewerResponses })
          .eq('id', option.id);

        if (updateError) {
          console.error(`옵션 ${option.id}의 응답 상태 업데이트 실패:`, updateError);
        } else {
          console.log(`옵션 ${option.id}의 응답 상태 업데이트 완료:`, interviewerResponses);
        }

        // 모든 면접관이 수락한 경우
        if (allAccepted && !allAcceptedOption) {
          console.log(`모든 면접관이 수락한 일정 옵션 발견: ${option.id} (${option.scheduled_at})`);
          allAcceptedOption = option;
        }
      } catch (error) {
        console.error(`옵션 ${option.id}의 응답 확인 실패:`, error);
        // 에러가 발생해도 다른 옵션은 계속 확인
      }
    }

    // 모든 면접관이 수락한 일정이 있으면 후보자에게 전송
    if (allAcceptedOption) {
      console.log(`모든 면접관이 수락한 일정이 있어 후보자에게 전송 시작: scheduleId=${scheduleId}, optionId=${allAcceptedOption.id}`);
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
    } else {
      console.log(`모든 면접관이 수락한 일정이 없음: scheduleId=${scheduleId}`);
    }

    // 캐시 무효화하여 최신 상태 반영
    revalidatePath(`/dashboard/candidates/${schedule.candidate_id}`);
    revalidatePath('/dashboard/schedules');

    return {
      message: '아직 모든 면접관이 수락하지 않았습니다. 계속 대기 중입니다.',
      allAccepted: false,
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
    await supabase.from('timeline_events').insert({
      candidate_id: candidate.id,
      type: 'email',
      content: {
        message: '면접 일정 옵션이 후보자에게 전송되었습니다.',
        subject: `[면접 일정] ${candidate.name}님, 면접 일정을 선택해주세요`,
        schedule_id: scheduleId,
        options_count: acceptedOptions.length,
      },
      created_by: user.userId,
    });

    // 캐시 무효화
    revalidatePath(`/dashboard/candidates/${candidate.id}`);
    revalidatePath('/dashboard/schedules');

    // 이메일 발송 실패 시 경고만 표시 (에러는 던지지 않음 - 이미 workflow_status는 업데이트되었으므로)
    if (!emailResult.success) {
      console.error('이메일 발송 실패:', emailResult.error);
      // 이메일 발송 실패해도 workflow_status는 업데이트되었으므로 경고만 반환
      return {
        success: false,
        emailSent: false,
        optionsCount: acceptedOptions.length,
        error: `이메일 발송 실패: ${emailResult.error || '알 수 없는 오류'}. 워크플로우 상태는 업데이트되었습니다.`,
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
    const supabase = await createClient();

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
    if (!candidate || candidate.token !== token) {
      throw new Error('인증 토큰이 올바르지 않습니다.');
    }

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
          summary: `${candidate.name} 면접`,
          description: `후보자: ${candidate.name}\n면접 단계: ${schedule.stage_id}\n\n면접 일정이 확정되었습니다.`,
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

    // 현재 사용자의 Google Workspace 토큰 조회 (Gmail API 사용을 위해)
    const { data: currentUserData, error: userTokenError } = await supabase
      .from('users')
      .select('calendar_access_token, calendar_refresh_token, email')
      .eq('id', user.userId)
      .single();

    if (!userTokenError && currentUserData?.calendar_access_token && currentUserData?.calendar_refresh_token) {
      // 후보자에게 확정 안내
      await sendEmailViaGmail(
        currentUserData.calendar_access_token,
        currentUserData.calendar_refresh_token,
        {
          to: candidate.email,
          from: currentUserData.email || user.email,
          subject: `[면접 일정 확정] ${candidate.name}님의 면접 일정이 확정되었습니다`,
          html: confirmationMessage,
          replyTo: currentUserData.email || user.email,
        }
      );

      // 면접관들에게 확정 안내
      for (const interviewer of interviewers) {
        if (interviewer.email) {
          await sendEmailViaGmail(
            currentUserData.calendar_access_token,
            currentUserData.calendar_refresh_token,
            {
              to: interviewer.email,
              from: currentUserData.email || user.email,
              subject: `[면접 일정 확정] ${candidate.name}님의 면접 일정이 확정되었습니다`,
              html: confirmationMessage,
              replyTo: currentUserData.email || user.email,
            }
          );
        }
      }
    } else {
      console.warn('Google Workspace 계정이 연동되지 않아 이메일을 발송할 수 없습니다.');
    }

    // 타임라인 이벤트 생성
    await supabase.from('timeline_events').insert({
      candidate_id: candidate.id,
      type: 'schedule_confirmed',
      content: {
        message: '면접 일정이 확정되었습니다.',
        schedule_id: scheduleId,
        scheduled_at: selectedOption.scheduled_at,
        interviewers: schedule.interviewer_ids,
      },
      created_by: null, // 후보자가 직접 생성
    });

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
