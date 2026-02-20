'use server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, verifyCandidateAccess } from '@/api/utils/auth';
import { validateUUID } from '@/api/utils/validation';
import { withErrorHandling } from '@/api/utils/errors';

/**
 * 특정 후보자의 타임라인 이벤트 조회
 * @param candidateId 후보자 ID
 * @param limit 조회할 이벤트 수 (기본값: 50)
 * @returns 타임라인 이벤트 목록
 */
export async function getTimelineEvents(candidateId: string, limit: number = 50) {
  return withErrorHandling(async () => {
    // 접근 권한 확인
    await verifyCandidateAccess(candidateId);
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('timeline_events')
      .select(`
        *,
        created_by_user:users!created_by (
          id,
          email,
          name
        )
      `)
      .eq('candidate_id', candidateId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`타임라인 이벤트 조회 실패: ${error.message}`);
    }

    return data || [];
  });
}

/**
 * 최근 활동 조회 (대시보드용)
 * @param limit 조회할 이벤트 수 (기본값: 10)
 * @returns 최근 타임라인 이벤트 목록
 */
export async function getRecentActivity(limit: number = 10) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const supabase = await createClient();

    // organization_id에 속한 job_posts 조회
    const { data: jobPosts } = await supabase
      .from('job_posts')
      .select('id')
      .eq('organization_id', user.organizationId);

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

    // 최근 타임라인 이벤트 조회
    const { data, error } = await supabase
      .from('timeline_events')
      .select(`
        *,
        candidates (
          id,
          name,
          job_posts (
            id,
            title
          )
        ),
        created_by_user:users!created_by (
          id,
          email
        )
      `)
      .in('candidate_id', candidateIds)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`최근 활동 조회 실패: ${error.message}`);
    }

    return data || [];
  });
}
