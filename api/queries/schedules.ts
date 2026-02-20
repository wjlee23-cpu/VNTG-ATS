'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getCurrentUser, verifyCandidateAccess } from '@/api/utils/auth';
import { validateUUID } from '@/api/utils/validation';
import { withErrorHandling } from '@/api/utils/errors';

/**
 * 특정 후보자의 면접 일정 조회
 * @param candidateId 후보자 ID
 * @returns 면접 일정 목록
 */
export async function getSchedulesByCandidate(candidateId: string) {
  return withErrorHandling(async () => {
    // 접근 권한 확인
    await verifyCandidateAccess(candidateId);
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('schedules')
      .select(`
        *,
        candidates (
          id,
          name,
          email
        )
      `)
      .eq('candidate_id', candidateId)
      .order('scheduled_at', { ascending: true });

    if (error) {
      throw new Error(`면접 일정 조회 실패: ${error.message}`);
    }

    return data || [];
  });
}

/**
 * 특정 기간의 면접 일정 조회 (캘린더용)
 * @param startDate 시작 날짜
 * @param endDate 종료 날짜
 * @returns 면접 일정 목록
 */
export async function getSchedulesByDateRange(startDate: Date, endDate: Date) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const isAdmin = user.role === 'admin';
    
    // 관리자일 경우 Service Role Client를 사용하여 RLS 정책 우회하여 모든 데이터 조회
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
      return [];
    }

    const jobPostIds = jobPosts.map(jp => jp.id);

    // 해당 job_posts의 후보자들 조회
    const { data: candidates } = await supabase
      .from('candidates')
      .select('id')
      .in('job_post_id', jobPostIds);

    if (!candidates || candidates.length === 0) {
      return [];
    }

    const candidateIds = candidates.map(c => c.id);

    // 기간 내 면접 일정 조회 (면접관 정보 포함)
    const { data, error } = await supabase
      .from('schedules')
      .select(`
        *,
        candidates (
          id,
          name,
          email,
          job_posts (
            id,
            title
          )
        )
      `)
      .in('candidate_id', candidateIds)
      .gte('scheduled_at', startDate.toISOString())
      .lte('scheduled_at', endDate.toISOString())
      .order('scheduled_at', { ascending: true });

    // 면접관 정보 조회
    if (data && data.length > 0) {
      const allInterviewerIds = new Set<string>();
      data.forEach(schedule => {
        if (schedule.interviewer_ids && Array.isArray(schedule.interviewer_ids)) {
          schedule.interviewer_ids.forEach((id: string) => allInterviewerIds.add(id));
        }
      });

      if (allInterviewerIds.size > 0) {
        const { data: interviewers } = await supabase
          .from('users')
          .select('id, email')
          .in('id', Array.from(allInterviewerIds));

        const interviewerMap = new Map(
          interviewers?.map(i => [i.id, i]) || []
        );

        // 각 일정에 면접관 정보 추가
        data.forEach(schedule => {
          (schedule as any).interviewers = schedule.interviewer_ids
            ?.map((id: string) => interviewerMap.get(id))
            .filter(Boolean) || [];
        });
      }
    }

    if (error) {
      throw new Error(`면접 일정 조회 실패: ${error.message}`);
    }

    return data || [];
  });
}

/**
 * 특정 면접 일정 상세 정보 조회
 * @param id 면접 일정 ID
 * @returns 면접 일정 상세 정보
 */
export async function getScheduleById(id: string) {
  return withErrorHandling(async () => {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('schedules')
      .select(`
        *,
        candidates (
          id,
          name,
          email,
          phone,
          job_posts (
            id,
            title,
            organization_id
          )
        )
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new Error('면접 일정을 찾을 수 없습니다.');
    }

    // 접근 권한 확인
    const candidate = (data as any).candidates;
    const jobPost = candidate?.job_posts;
    if (jobPost?.organization_id) {
      const user = await getCurrentUser();
      if (jobPost.organization_id !== user.organizationId) {
        throw new Error('이 면접 일정에 접근할 권한이 없습니다.');
      }
    }

    return data;
  });
}

/**
 * 면접 일정 통계 조회
 * @returns 면접 일정 통계
 */
export async function getScheduleStats() {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const supabase = await createClient();

    // organization_id에 속한 job_posts 조회
    const { data: jobPosts } = await supabase
      .from('job_posts')
      .select('id')
      .eq('organization_id', user.organizationId);

    if (!jobPosts || jobPosts.length === 0) {
      return {
        total: 0,
        pending: 0,
        confirmed: 0,
        completed: 0,
        rejected: 0,
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
        total: 0,
        pending: 0,
        confirmed: 0,
        completed: 0,
        rejected: 0,
      };
    }

    const candidateIds = candidates.map(c => c.id);

    // 상태별 카운트
    const statuses = ['pending', 'confirmed', 'completed', 'rejected'];
    const stats: Record<string, number> = { total: 0 };

    for (const status of statuses) {
      const { count } = await supabase
        .from('schedules')
        .select('*', { count: 'exact', head: true })
        .in('candidate_id', candidateIds)
        .eq('status', status);

      stats[status] = count || 0;
      stats.total += count || 0;
    }

    return stats;
  });
}
