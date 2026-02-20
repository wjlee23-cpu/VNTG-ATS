'use server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/api/utils/auth';
import { withErrorHandling } from '@/api/utils/errors';

/**
 * 대시보드 통계 조회
 * @returns 대시보드 통계 데이터
 */
export async function getDashboardStats() {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const supabase = await createClient();

    // organization_id에 속한 job_posts 조회
    const { data: jobPosts } = await supabase
      .from('job_posts')
      .select('id')
      .eq('organization_id', user.organizationId);

    const jobPostIds = jobPosts?.map(jp => jp.id) || [];

    // Total Candidates (jobPostIds가 비어있으면 0 반환)
    let totalCandidates = 0;
    if (jobPostIds.length > 0) {
      const { count } = await supabase
        .from('candidates')
        .select('*', { count: 'exact', head: true })
        .in('job_post_id', jobPostIds);
      totalCandidates = count || 0;
    }

    // Active Jobs
    const { count: activeJobs } = await supabase
      .from('job_posts')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', user.organizationId);

    // Interviews Scheduled
    let interviewsScheduled = 0;
    let offersMade = 0;
    
    if (jobPostIds.length > 0) {
      const { data: candidates } = await supabase
        .from('candidates')
        .select('id')
        .in('job_post_id', jobPostIds);

      const candidateIds = candidates?.map(c => c.id) || [];

      if (candidateIds.length > 0) {
        const { count } = await supabase
          .from('schedules')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'confirmed')
          .in('candidate_id', candidateIds);
        interviewsScheduled = count || 0;
      }

      // Offers Made (status가 confirmed인 후보자)
      const { count } = await supabase
        .from('candidates')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'confirmed')
        .in('job_post_id', jobPostIds);
      offersMade = count || 0;
    }

    return {
      totalCandidates: totalCandidates || 0,
      activeJobs: activeJobs || 0,
      interviewsScheduled: interviewsScheduled || 0,
      offersMade: offersMade || 0,
    };
  });
}

/**
 * 최근 활동 조회 (대시보드용 - 레거시 호환)
 * @deprecated getRecentActivity는 api/queries/timeline.ts의 getRecentActivity를 사용하세요.
 */
export async function getRecentActivity() {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const supabase = await createClient();

    // organization_id에 속한 job_posts 조회
    const { data: jobPosts } = await supabase
      .from('job_posts')
      .select('id, title')
      .eq('organization_id', user.organizationId);

    const jobPostIds = jobPosts?.map(jp => jp.id) || [];
    if (jobPostIds.length === 0) return [];

    // 해당 job_posts에 속한 candidates 가져오기
    const { data: candidates } = await supabase
      .from('candidates')
      .select('id, name, job_post_id')
      .in('job_post_id', jobPostIds);

    const candidateIds = candidates?.map(c => c.id) || [];
    if (candidateIds.length === 0) return [];

    // 타임라인 이벤트에서 최근 활동 가져오기
    const { data: timelineEvents } = await supabase
      .from('timeline_events')
      .select('*')
      .in('candidate_id', candidateIds)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!timelineEvents) return [];

    // candidates와 job_posts 정보 매핑
    const candidateMap = new Map(candidates?.map(c => [c.id, c]) || []);
    const jobPostMap = new Map(jobPosts?.map(jp => [jp.id, jp]) || []);

    return timelineEvents.map((event: any) => {
      const candidate = candidateMap.get(event.candidate_id);
      const jobPost = candidate ? jobPostMap.get(candidate.job_post_id) : null;
      
      return {
        id: event.id,
        type: event.type,
        candidate: candidate?.name || 'Unknown',
        action: getActionText(event.type),
        job: jobPost?.title || 'Unknown',
        time: formatTimeAgo(event.created_at),
      };
    });
  });
}

/**
 * 상위 후보자 조회 (매치 스코어 기준)
 * @param limit 조회할 후보자 수 (기본값: 3)
 * @returns 상위 후보자 목록
 */
export async function getTopCandidates(limit: number = 3) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const supabase = await createClient();

    // organization_id에 속한 job_posts 조회
    const { data: jobPosts } = await supabase
      .from('job_posts')
      .select('id, title')
      .eq('organization_id', user.organizationId);

    const jobPostIds = jobPosts?.map(jp => jp.id) || [];
    if (jobPostIds.length === 0) return [];

    const jobPostMap = new Map(jobPosts?.map(jp => [jp.id, jp]) || []);

    // 최근 후보자 가져오기 (parsed_data의 match_score 기준으로 정렬)
    const { data: candidates } = await supabase
      .from('candidates')
      .select('*')
      .in('job_post_id', jobPostIds)
      .order('created_at', { ascending: false })
      .limit(limit * 2); // 매치 스코어가 있는 것만 필터링하기 위해 더 많이 가져옴

    if (!candidates) return [];

    // 매치 스코어 기준으로 정렬
    const candidatesWithScore = candidates
      .map((candidate: any) => ({
        ...candidate,
        matchScore: candidate.parsed_data?.match_score || 0,
      }))
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit);

    return candidatesWithScore.map((candidate: any) => {
      const jobPost = jobPostMap.get(candidate.job_post_id);
      return {
        id: candidate.id,
        name: candidate.name,
        position: jobPost?.title || 'Unknown',
        match: candidate.matchScore || 0,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${candidate.name}`,
      };
    });
  });
}

function getActionText(type: string): string {
  const actionMap: Record<string, string> = {
    'application': 'applied for',
    'schedule_created': 'scheduled interview for',
    'schedule_confirmed': 'confirmed interview for',
    'offer': 'received offer for',
    'stage_changed': 'moved to',
  };
  return actionMap[type] || 'updated';
}

function formatTimeAgo(date: string): string {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}
