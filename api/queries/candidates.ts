'use server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, verifyCandidateAccess, verifyJobPostAccess } from '@/api/utils/auth';
import { validateUUID } from '@/api/utils/validation';
import { withErrorHandling } from '@/api/utils/errors';

/**
 * 현재 조직의 모든 후보자 조회
 * @param jobPostId 특정 채용 공고의 후보자만 조회 (선택)
 * @returns 후보자 목록
 */
export async function getCandidates(jobPostId?: string) {
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

    const jobPostIds = jobPostId
      ? [validateUUID(jobPostId, '채용 공고 ID')]
      : jobPosts.map(jp => jp.id);

    // job_post_id 필터링 및 후보자 조회
    const { data, error } = await supabase
      .from('candidates')
      .select(`
        *,
        job_posts (
          id,
          title,
          organization_id
        )
      `)
      .in('job_post_id', jobPostIds)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`후보자 조회 실패: ${error.message}`);
    }

    return data || [];
  });
}

/**
 * 특정 후보자 상세 정보 조회
 * @param id 후보자 ID
 * @returns 후보자 상세 정보
 */
export async function getCandidateById(id: string) {
  return withErrorHandling(async () => {
    // 접근 권한 확인
    await verifyCandidateAccess(id);
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('candidates')
      .select(`
        *,
        job_posts (
          id,
          title,
          description,
          process_id,
          processes (
            id,
            name,
            stages
          )
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      throw new Error(`후보자 조회 실패: ${error.message}`);
    }

    return data;
  });
}

/**
 * 특정 채용 공고의 후보자 목록 조회 (상태별 필터링 가능)
 * @param jobPostId 채용 공고 ID
 * @param status 상태 필터 (선택)
 * @returns 후보자 목록
 */
export async function getCandidatesByJobPost(
  jobPostId: string,
  status?: 'pending' | 'in_progress' | 'confirmed' | 'rejected' | 'issue'
) {
  return withErrorHandling(async () => {
    // job_post 접근 권한 확인
    await verifyJobPostAccess(jobPostId);
    const supabase = await createClient();

    let query = supabase
      .from('candidates')
      .select('*')
      .eq('job_post_id', jobPostId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`후보자 조회 실패: ${error.message}`);
    }

    return data || [];
  });
}

/**
 * 후보자 통계 조회
 * @param jobPostId 채용 공고 ID (선택, 없으면 전체)
 * @returns 후보자 통계
 */
export async function getCandidateStats(jobPostId?: string) {
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
        in_progress: 0,
        confirmed: 0,
        rejected: 0,
        issue: 0,
      };
    }

    const jobPostIds = jobPostId
      ? [validateUUID(jobPostId, '채용 공고 ID')]
      : jobPosts.map(jp => jp.id);

    // 상태별 카운트
    const statuses = ['pending', 'in_progress', 'confirmed', 'rejected', 'issue'];
    const stats: Record<string, number> = { total: 0 };

    for (const status of statuses) {
      const { count } = await supabase
        .from('candidates')
        .select('*', { count: 'exact', head: true })
        .in('job_post_id', jobPostIds)
        .eq('status', status);

      stats[status] = count || 0;
      stats.total += count || 0;
    }

    return stats;
  });
}
