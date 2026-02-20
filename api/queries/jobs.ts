'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getCurrentUser, verifyJobPostAccess } from '@/api/utils/auth';
import { validateUUID } from '@/api/utils/validation';
import { withErrorHandling } from '@/api/utils/errors';

/**
 * 현재 조직의 모든 채용 공고 조회
 * 관리자일 경우 모든 조직의 채용 공고를 조회하고, 일반 사용자는 자신의 조직 채용 공고만 조회합니다.
 * @returns 채용 공고 목록
 */
export async function getJobs() {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const isAdmin = user.role === 'admin';
    
    // 관리자일 경우 Service Role Client를 사용하여 RLS 정책 우회하여 모든 데이터 조회
    const supabase = isAdmin ? createServiceClient() : await createClient();

    let query = supabase
      .from('job_posts')
      .select(`
        *,
        processes (
          id,
          name,
          stages
        ),
        candidates (count)
      `)
      .order('created_at', { ascending: false });

    // 관리자가 아닐 경우 자신의 organization_id로 필터링
    if (!isAdmin) {
      query = query.eq('organization_id', user.organizationId);
    }

    const { data, error } = await query;

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
    const user = await getCurrentUser();
    const isAdmin = user.role === 'admin';
    
    // 관리자일 경우 Service Role Client를 사용하여 RLS 정책 우회하여 모든 데이터 조회
    const supabase = isAdmin ? createServiceClient() : await createClient();

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
    const isAdmin = user.role === 'admin';
    
    // 관리자일 경우 Service Role Client를 사용하여 RLS 정책 우회하여 모든 데이터 조회
    const supabase = isAdmin ? createServiceClient() : await createClient();

    // 전체 채용 공고 수
    let totalJobsQuery = supabase
      .from('job_posts')
      .select('*', { count: 'exact', head: true });
    
    if (!isAdmin) {
      totalJobsQuery = totalJobsQuery.eq('organization_id', user.organizationId);
    }

    const { count: totalJobs } = await totalJobsQuery;

    // 각 채용 공고별 후보자 수
    let jobPostsQuery = supabase
      .from('job_posts')
      .select('id, title');
    
    if (!isAdmin) {
      jobPostsQuery = jobPostsQuery.eq('organization_id', user.organizationId);
    }

    const { data: jobPosts } = await jobPostsQuery;

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

/**
 * Jobs 페이지용 통계 조회 (피그마 디자인 기반)
 * @returns Active Jobs, Total Applicants, Avg. Match Rate, Total Views
 */
export async function getJobsPageStats() {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const isAdmin = user.role === 'admin';
    
    const supabase = isAdmin ? createServiceClient() : await createClient();

    // Active Jobs (status가 'active'인 공고 수)
    let activeJobsQuery = supabase
      .from('job_posts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');
    
    if (!isAdmin) {
      activeJobsQuery = activeJobsQuery.eq('organization_id', user.organizationId);
    }

    const { count: activeJobs } = await activeJobsQuery;

    // Total Applicants (모든 후보자 수)
    let jobPostsQuery = supabase
      .from('job_posts')
      .select('id');
    
    if (!isAdmin) {
      jobPostsQuery = jobPostsQuery.eq('organization_id', user.organizationId);
    }

    const { data: jobPosts } = await jobPostsQuery;
    const jobPostIds = jobPosts?.map(jp => jp.id) || [];

    let totalApplicants = 0;
    let totalViews = 0;
    let totalMatchRate = 0;
    let jobsWithMatchRate = 0;

    if (jobPostIds.length > 0) {
      const { count } = await supabase
        .from('candidates')
        .select('*', { count: 'exact', head: true })
        .in('job_post_id', jobPostIds);
      totalApplicants = count || 0;

      // Total Views 및 Avg. Match Rate 계산
      const { data: jobs } = await supabase
        .from('job_posts')
        .select('views, match_rate')
        .in('id', jobPostIds);

      jobs?.forEach(job => {
        if (job.views) {
          totalViews += job.views;
        }
        if (job.match_rate !== null && job.match_rate !== undefined) {
          totalMatchRate += Number(job.match_rate);
          jobsWithMatchRate += 1;
        }
      });
    }

    const avgMatchRate = jobsWithMatchRate > 0 
      ? Math.round((totalMatchRate / jobsWithMatchRate) * 100) / 100 
      : 0;

    return {
      activeJobs: activeJobs || 0,
      totalApplicants: totalApplicants,
      avgMatchRate: avgMatchRate,
      totalViews: totalViews,
    };
  });
}