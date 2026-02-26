'use server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, verifyCandidateAccess } from '@/api/utils/auth';
import { validateUUID } from '@/api/utils/validation';
import { withErrorHandling } from '@/api/utils/errors';

/**
 * 후보자별 평가표 조회
 * @param candidateId 후보자 ID
 * @returns 평가표 목록 (면접관 정보 포함)
 */
export async function getScorecardsByCandidate(candidateId: string) {
  return withErrorHandling(async () => {
    // 접근 권한 확인
    await verifyCandidateAccess(candidateId);
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('scorecards')
      .select(`
        *,
        interviewer:users!interviewer_id (
          id,
          email,
          name
        ),
        schedules (
          id,
          stage_id,
          scheduled_at
        )
      `)
      .eq('candidate_id', candidateId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`평가표 조회 실패: ${error.message}`);
    }

    return data || [];
  });
}

/**
 * 일정별 평가표 조회
 * @param scheduleId 면접 일정 ID
 * @returns 평가표 목록 (면접관 정보 포함)
 */
export async function getScorecardsBySchedule(scheduleId: string) {
  return withErrorHandling(async () => {
    const supabase = await createClient();

    // 면접 일정 조회 (후보자 정보 포함)
    const { data: schedule, error: scheduleError } = await supabase
      .from('schedules')
      .select(`
        *,
        candidates!inner (
          id
        )
      `)
      .eq('id', scheduleId)
      .single();

    if (scheduleError || !schedule) {
      throw new Error('면접 일정을 찾을 수 없습니다.');
    }

    const candidateId = (schedule.candidates as any).id;

    // 후보자 접근 권한 확인
    await verifyCandidateAccess(candidateId);

    const { data, error } = await supabase
      .from('scorecards')
      .select(`
        *,
        interviewer:users!interviewer_id (
          id,
          email,
          name
        )
      `)
      .eq('schedule_id', scheduleId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`평가표 조회 실패: ${error.message}`);
    }

    return data || [];
  });
}

/**
 * 특정 평가표 조회
 * @param scorecardId 평가표 ID
 * @returns 평가표 데이터 (면접관 정보 포함)
 */
export async function getScorecardById(scorecardId: string) {
  return withErrorHandling(async () => {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('scorecards')
      .select(`
        *,
        interviewer:users!interviewer_id (
          id,
          email,
          name
        ),
        candidates!inner (
          id
        ),
        schedules (
          id,
          stage_id,
          scheduled_at
        )
      `)
      .eq('id', scorecardId)
      .single();

    if (error) {
      throw new Error(`평가표 조회 실패: ${error.message}`);
    }

    if (!data) {
      throw new Error('평가표를 찾을 수 없습니다.');
    }

    // 후보자 접근 권한 확인
    await verifyCandidateAccess(data.candidates.id);

    return data;
  });
}
