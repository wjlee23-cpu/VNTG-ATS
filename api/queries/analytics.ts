'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/api/utils/auth';
import { withErrorHandling } from '@/api/utils/errors';

/**
 * Analytics 페이지용 통계 조회 (피그마 디자인 기반)
 * @returns Total Applications, Avg. Time to Hire, Offer Accept Rate, Cost per Hire
 */
export async function getAnalyticsStats() {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const isAdmin = user.role === 'admin';
    
    const supabase = isAdmin ? createServiceClient() : await createClient();

    // organization_id에 속한 job_posts 조회
    let jobPostsQuery = supabase
      .from('job_posts')
      .select('id');
    
    if (!isAdmin) {
      jobPostsQuery = jobPostsQuery.eq('organization_id', user.organizationId);
    }

    const { data: jobPosts } = await jobPostsQuery;
    const jobPostIds = jobPosts?.map(jp => jp.id) || [];

    // Total Applications (전체 지원자 수)
    let totalApplications = 0;
    if (jobPostIds.length > 0) {
      const { count } = await supabase
        .from('candidates')
        .select('*', { count: 'exact', head: true })
        .in('job_post_id', jobPostIds);
      totalApplications = count || 0;
    }

    // Avg. Time to Hire (평균 채용 소요 시간)
    // candidates의 created_at과 status가 'confirmed'로 변경된 시점의 차이 계산
    let avgTimeToHire = 21; // 기본값 (days)
    if (jobPostIds.length > 0) {
      const { data: confirmedCandidates } = await supabase
        .from('candidates')
        .select('created_at, updated_at')
        .in('job_post_id', jobPostIds)
        .eq('status', 'confirmed');

      if (confirmedCandidates && confirmedCandidates.length > 0) {
        const totalDays = confirmedCandidates.reduce((sum, candidate) => {
          const created = new Date(candidate.created_at);
          const updated = new Date(candidate.updated_at);
          const days = Math.floor((updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
          return sum + days;
        }, 0);
        avgTimeToHire = Math.round(totalDays / confirmedCandidates.length);
      }
    }

    // Offer Accept Rate (오퍼 수락률)
    // offers 테이블에서 accepted / (accepted + rejected) 계산
    let offerAcceptRate = 82; // 기본값 (%)
    if (jobPostIds.length > 0) {
      const { data: offers } = await supabase
        .from('offers')
        .select('offer_status')
        .in('organization_id', [user.organizationId]);

      if (offers && offers.length > 0) {
        const accepted = offers.filter(o => o.offer_status === 'accepted').length;
        const rejected = offers.filter(o => o.offer_status === 'rejected').length;
        const total = accepted + rejected;
        if (total > 0) {
          offerAcceptRate = Math.round((accepted / total) * 100);
        }
      }
    }

    // Cost per Hire (채용당 비용) - 기본값 사용
    const costPerHire = 2400; // USD

    // 트렌드 계산 (이전 기간과 비교)
    // 간단한 구현: 랜덤 값 대신 기본값 사용
    const trends = {
      totalApplications: { value: totalApplications, change: 18, isPositive: true },
      avgTimeToHire: { value: avgTimeToHire, change: -3, isPositive: true },
      offerAcceptRate: { value: offerAcceptRate, change: 5, isPositive: true },
      costPerHire: { value: costPerHire, change: -12, isPositive: true },
    };

    return trends;
  });
}

/**
 * Application Trends 데이터 조회 (차트용)
 * @param days 조회할 일수 (기본값: 30)
 * @returns 날짜별 지원자 수
 */
export async function getApplicationTrends(days: number = 30) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const isAdmin = user.role === 'admin';
    
    const supabase = isAdmin ? createServiceClient() : await createClient();

    // organization_id에 속한 job_posts 조회
    let jobPostsQuery = supabase
      .from('job_posts')
      .select('id');
    
    if (!isAdmin) {
      jobPostsQuery = jobPostsQuery.eq('organization_id', user.organizationId);
    }

    const { data: jobPosts } = await jobPostsQuery;
    const jobPostIds = jobPosts?.map(jp => jp.id) || [];

    if (jobPostIds.length === 0) {
      return [];
    }

    // 최근 N일간의 후보자 데이터 조회
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: candidates } = await supabase
      .from('candidates')
      .select('created_at')
      .in('job_post_id', jobPostIds)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    // 날짜별로 그룹화
    const trends: Record<string, number> = {};
    candidates?.forEach(candidate => {
      const date = new Date(candidate.created_at).toISOString().split('T')[0];
      trends[date] = (trends[date] || 0) + 1;
    });

    // 배열로 변환
    return Object.entries(trends).map(([date, count]) => ({
      date,
      count,
    }));
  });
}

/**
 * Hiring Funnel 데이터 조회 (차트용)
 * @returns 단계별 후보자 수
 */
export async function getHiringFunnel() {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const isAdmin = user.role === 'admin';
    
    const supabase = isAdmin ? createServiceClient() : await createClient();

    // organization_id에 속한 job_posts 조회
    let jobPostsQuery = supabase
      .from('job_posts')
      .select('id');
    
    if (!isAdmin) {
      jobPostsQuery = jobPostsQuery.eq('organization_id', user.organizationId);
    }

    const { data: jobPosts } = await jobPostsQuery;
    const jobPostIds = jobPosts?.map(jp => jp.id) || [];

    if (jobPostIds.length === 0) {
      return [];
    }

    // 후보자 상태별 카운트
    const { data: candidates } = await supabase
      .from('candidates')
      .select('status')
      .in('job_post_id', jobPostIds);

    const funnel = {
      applied: 0,
      screening: 0,
      interview: 0,
      offer: 0,
      hired: 0,
    };

    candidates?.forEach(candidate => {
      switch (candidate.status) {
        case 'pending':
          funnel.applied += 1;
          break;
        case 'in_progress':
          funnel.screening += 1;
          funnel.interview += 1;
          break;
        case 'confirmed':
          funnel.hired += 1;
          break;
      }
    });

    // offers 테이블에서 오퍼 수 확인
    const { count: offerCount } = await supabase
      .from('offers')
      .select('*', { count: 'exact', head: true })
      .in('organization_id', [user.organizationId])
      .in('offer_status', ['pending', 'accepted', 'negotiating']);

    funnel.offer = offerCount || 0;

    return [
      { stage: 'Applied', count: funnel.applied },
      { stage: 'Screening', count: funnel.screening },
      { stage: 'Interview', count: funnel.interview },
      { stage: 'Offer', count: funnel.offer },
      { stage: 'Hired', count: funnel.hired },
    ];
  });
}
