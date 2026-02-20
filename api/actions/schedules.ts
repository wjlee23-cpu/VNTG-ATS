'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { getCurrentUser, verifyCandidateAccess } from '@/api/utils/auth';
import { validateRequired, validateUUID, validateFutureDate, validateNumberRange, validateNonEmptyArray } from '@/api/utils/validation';
import { withErrorHandling } from '@/api/utils/errors';
import { Database } from '@/lib/supabase/types';

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
