'use server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, verifyJobPostAccess } from '@/api/utils/auth';
import { validateUUID } from '@/api/utils/validation';
import { withErrorHandling } from '@/api/utils/errors';

/**
 * 현재 조직의 모든 채용 공고 조회
 * @returns 채용 공고 목록
 */
export async function getJobs() {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('job_posts')
      .select(`
        *,
        processes (
          id,
          name,
          stages
        )
      `)
      .eq('organization_id', user.organizationId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`채용 공고 조회 실패: ${error.message}`);
    }

    return data || [];
  });
}

/**
 * 특정 채용 공고 상세 정보 조회
 * @param id 채용 공고 ID
 * @returns 채용 공고 상세 정보
 */
export async function getJobById(id: string) {
  return withErrorHandling(async () => {
    // 접근 권한 확인
    await verifyJobPostAccess(id);
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('job_posts')
      .select(`
        *,
        processes (
          id,
          name,
          stages
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      throw new Error(`채용 공고 조회 실패: ${error.message}`);
    }

    return data;
  });
}

/**
 * 채용 공고 통계 조회
 * @returns 채용 공고 통계
 */
export async function getJobStats() {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const supabase = await createClient();

    // 전체 채용 공고 수
    const { count: totalJobs } = await supabase
      .from('job_posts')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', user.organizationId);

    // 각 채용 공고별 후보자 수
    const { data: jobPosts } = await supabase
      .from('job_posts')
      .select('id, title')
      .eq('organization_id', user.organizationId);

    if (!jobPosts || jobPosts.length === 0) {
      return {
        total: 0,
        jobs: [],
      };
    }

    const jobPostIds = jobPosts.map(jp => jp.id);
    const { data: candidates } = await supabase
      .from('candidates')
      .select('job_post_id')
      .in('job_post_id', jobPostIds);

    // job_post별 후보자 수 계산
    const candidateCounts = new Map<string, number>();
    candidates?.forEach(c => {
      candidateCounts.set(c.job_post_id, (candidateCounts.get(c.job_post_id) || 0) + 1);
    });

    const jobs = jobPosts.map(jp => ({
      id: jp.id,
      title: jp.title,
      candidateCount: candidateCounts.get(jp.id) || 0,
    }));

    return {
      total: totalJobs || 0,
      jobs,
    };
  });
}
