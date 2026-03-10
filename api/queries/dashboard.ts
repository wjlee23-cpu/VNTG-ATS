'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/api/utils/auth';
import { withErrorHandling } from '@/api/utils/errors';

/**
 * 대시보드 통계 조회
 * 관리자일 경우 모든 조직의 데이터를 조회하고, 일반 사용자는 자신의 조직 데이터만 조회합니다.
 * @returns 대시보드 통계 데이터 (신규 지원, 면접 진행, 오퍼 발송, 채용 완료)
 */
export async function getDashboardStats() {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const isAdmin = user.role === 'admin';
    
    // 관리자일 경우 Service Role Client를 사용하여 RLS 정책 우회하여 모든 데이터 조회
    // 일반 사용자는 일반 클라이언트 사용
    const supabase = isAdmin ? createServiceClient() : await createClient();

    // 관리자일 경우 모든 job_posts 조회, 일반 사용자는 자신의 organization_id로 필터링
    let jobPostsQuery = supabase
      .from('job_posts')
      .select('id');
    
    if (!isAdmin) {
      jobPostsQuery = jobPostsQuery.eq('organization_id', user.organizationId);
    }

    const { data: jobPosts } = await jobPostsQuery;
    const jobPostIds = jobPosts?.map(jp => jp.id) || [];

    // 신규 지원: 최근 7일간 신규 지원자 수
    let newApplications = 0;
    if (jobPostIds.length > 0) {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const { count } = await supabase
        .from('candidates')
        .select('*', { count: 'exact', head: true })
        .in('job_post_id', jobPostIds)
        .gte('created_at', sevenDaysAgo.toISOString());
      newApplications = count || 0;
    }

    // 면접 진행: 현재 진행 중인 면접 수 (status = 'confirmed' 또는 'pending')
    let interviewsInProgress = 0;
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
          .in('status', ['confirmed', 'pending'])
          .in('candidate_id', candidateIds);
        interviewsInProgress = count || 0;
      }
    }

    // 오퍼 발송: 발송된 오퍼 수 (offers 테이블)
    let offersSent = 0;
    let offersQuery = supabase
      .from('offers')
      .select('*', { count: 'exact', head: true })
      .not('offer_sent_at', 'is', null);
    
    if (!isAdmin) {
      offersQuery = offersQuery.eq('organization_id', user.organizationId);
    }

    const { count: offersCount } = await offersQuery;
    offersSent = offersCount || 0;

    // 채용 완료: status = 'confirmed'인 후보자 수
    let hiringCompleted = 0;
    if (jobPostIds.length > 0) {
      const { count } = await supabase
        .from('candidates')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'confirmed')
        .in('job_post_id', jobPostIds);
      hiringCompleted = count || 0;
    }

    return {
      newApplications: newApplications || 0,
      interviewsInProgress: interviewsInProgress || 0,
      offersSent: offersSent || 0,
      hiringCompleted: hiringCompleted || 0,
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
    const isAdmin = user.role === 'admin';
    
    // 관리자일 경우 Service Role Client를 사용하여 RLS 정책 우회하여 모든 데이터 조회
    const supabase = isAdmin ? createServiceClient() : await createClient();

    // 관리자일 경우 모든 job_posts 조회, 일반 사용자는 자신의 organization_id로 필터링
    let jobPostsQuery = supabase
      .from('job_posts')
      .select('id, title');
    
    if (!isAdmin) {
      jobPostsQuery = jobPostsQuery.eq('organization_id', user.organizationId);
    }

    const { data: jobPosts } = await jobPostsQuery;
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

    return timelineEvents.map((event) => {
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
    const isAdmin = user.role === 'admin';
    
    // 관리자일 경우 Service Role Client를 사용하여 RLS 정책 우회하여 모든 데이터 조회
    const supabase = isAdmin ? createServiceClient() : await createClient();

    // 관리자일 경우 모든 job_posts 조회, 일반 사용자는 자신의 organization_id로 필터링
    let jobPostsQuery = supabase
      .from('job_posts')
      .select('id, title');
    
    if (!isAdmin) {
      jobPostsQuery = jobPostsQuery.eq('organization_id', user.organizationId);
    }

    const { data: jobPosts } = await jobPostsQuery;
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
    type CandidateWithScore = typeof candidates[0] & { matchScore: number };
    const candidatesWithScore: CandidateWithScore[] = candidates
      .map((candidate) => ({
        ...candidate,
        matchScore: (candidate.parsed_data as { match_score?: number } | null)?.match_score || 0,
      }))
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit);

    return candidatesWithScore.map((candidate) => {
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

/**
 * 액션 필요 항목 조회
 * @returns 액션 필요 항목 목록 (면접 피드백, 이력서 검토, JD 승인, 오퍼 발송)
 */
export async function getPendingActions() {
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

    const actions: Array<{
      type: 'interview_feedback' | 'resume_review' | 'jd_approval' | 'offer_send';
      title: string;
      description: string;
      count: number;
      items: Array<{
        id: string;
        name: string;
        position?: string;
        daysOverdue?: number;
        link: string;
      }>;
    }> = [];

    // 1. 면접 피드백 작성 필요
    if (jobPostIds.length > 0) {
      const { data: candidates } = await supabase
        .from('candidates')
        .select('id')
        .in('job_post_id', jobPostIds);

      const candidateIds = candidates?.map(c => c.id) || [];

      if (candidateIds.length > 0) {
        // 완료된 면접 일정 조회
        const { data: completedSchedules } = await supabase
          .from('schedules')
          .select(`
            id,
            candidate_id,
            scheduled_at,
            candidates!inner (
              id,
              name,
              job_posts (
                id,
                title
              )
            )
          `)
          .eq('status', 'completed')
          .in('candidate_id', candidateIds);

        if (completedSchedules && completedSchedules.length > 0) {
          // 각 일정에 대해 scorecard 존재 여부 확인
          const scheduleIds = completedSchedules.map(s => s.id);
          const { data: scorecards } = await supabase
            .from('scorecards')
            .select('schedule_id')
            .in('schedule_id', scheduleIds);

          const scorecardScheduleIds = new Set(scorecards?.map(s => s.schedule_id) || []);
          
          // 피드백이 없는 일정 필터링
          const pendingFeedback = completedSchedules
            .filter(s => !scorecardScheduleIds.has(s.id))
            .map(s => {
              const candidate = s.candidates as { name: string; job_posts?: { title: string } };
              const jobPost = candidate?.job_posts;
              const scheduledAt = new Date(s.scheduled_at);
              const now = new Date();
              const daysDiff = Math.floor((now.getTime() - scheduledAt.getTime()) / (1000 * 60 * 60 * 24));
              
              return {
                id: s.id,
                name: candidate?.name || 'Unknown',
                position: jobPost?.title,
                daysOverdue: daysDiff,
                link: `/candidates/${s.candidate_id}`,
              };
            })
            .slice(0, 5); // 최대 5개

          if (pendingFeedback.length > 0) {
            actions.push({
              type: 'interview_feedback',
              title: '면접 피드백 작성',
              description: `${pendingFeedback[0].name} 외 ${pendingFeedback.length - 1}명`,
              count: pendingFeedback.length,
              items: pendingFeedback,
            });
          }
        }
      }
    }

    // 2. 이력서 검토 대기 (최근 3일 이내 지원, status = 'pending')
    if (jobPostIds.length > 0) {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const { data: pendingCandidates } = await supabase
        .from('candidates')
        .select(`
          id,
          name,
          created_at,
          job_posts (
            id,
            title
          )
        `)
        .in('job_post_id', jobPostIds)
        .eq('status', 'pending')
        .gte('created_at', threeDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(5);

      if (pendingCandidates && pendingCandidates.length > 0) {
        const items = pendingCandidates.map(c => ({
          id: c.id,
          name: c.name,
          position: (c.job_posts as { title: string } | null)?.title,
          link: `/candidates/${c.id}`,
        }));

        actions.push({
          type: 'resume_review',
          title: '이력서 검토 대기',
          description: `${items[0].name} 외 ${items.length - 1}명`,
          count: items.length,
          items,
        });
      }
    }

    // 3. JD 승인 요청
    let jdQuery = supabase
      .from('jd_requests')
      .select(`
        id,
        title,
        submitted_at,
        requested_by_user:users!requested_by (
          id,
          email
        )
      `)
      .eq('status', 'pending')
      .order('submitted_at', { ascending: false })
      .limit(5);

    if (!isAdmin) {
      jdQuery = jdQuery.eq('organization_id', user.organizationId);
    }

    const { data: pendingJDRequests } = await jdQuery;

    if (pendingJDRequests && pendingJDRequests.length > 0) {
      const items = pendingJDRequests.map(jd => ({
        id: jd.id,
        name: jd.title,
        position: (jd.requested_by_user as { email: string } | null)?.email || 'Unknown',
        link: `/jd-requests/${jd.id}`,
      }));

      actions.push({
        type: 'jd_approval',
        title: 'JD 승인 요청',
        description: items[0].name,
        count: items.length,
        items,
      });
    }

    // 4. 오퍼 레터 발송 대기
    let offersQuery = supabase
      .from('offers')
      .select(`
        id,
        offer_status,
        offer_sent_at,
        candidates!inner (
          id,
          name,
          job_posts (
            id,
            title
          )
        )
      `)
      .eq('offer_status', 'pending')
      .is('offer_sent_at', null)
      .order('created_at', { ascending: false })
      .limit(5);

    if (!isAdmin) {
      offersQuery = offersQuery.eq('organization_id', user.organizationId);
    }

    const { data: pendingOffers } = await offersQuery;

    if (pendingOffers && pendingOffers.length > 0) {
      const items = pendingOffers.map(offer => {
        const candidate = offer.candidates as { name: string; job_posts?: { title: string } };
        return {
          id: offer.id,
          name: candidate?.name || 'Unknown',
          position: candidate?.job_posts?.title,
          link: `/offers/${offer.id}`,
        };
      });

      actions.push({
        type: 'offer_send',
        title: '오퍼 레터 발송 대기',
        description: `${items[0].name} 외 ${items.length - 1}명`,
        count: items.length,
        items,
      });
    }

    return actions;
  });
}

/**
 * 오늘 일정 조회
 * @returns 오늘 날짜의 면접 일정 목록
 */
export async function getTodaySchedules() {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const isAdmin = user.role === 'admin';
    
    const supabase = isAdmin ? createServiceClient() : await createClient();

    // 오늘 날짜 범위 설정
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

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

    // 해당 job_posts의 후보자들 조회
    const { data: candidates } = await supabase
      .from('candidates')
      .select('id')
      .in('job_post_id', jobPostIds);

    if (!candidates || candidates.length === 0) {
      return [];
    }

    const candidateIds = candidates.map(c => c.id);

    // 오늘 일정 조회
    // 주의: interview_type, meeting_platform, meeting_link 컬럼은 마이그레이션이 실행되어야 사용 가능
    const { data: schedules, error } = await supabase
      .from('schedules')
      .select(`
        id,
        candidate_id,
        scheduled_at,
        duration_minutes,
        status,
        interviewer_ids,
        candidates!inner (
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
      .gte('scheduled_at', today.toISOString())
      .lt('scheduled_at', tomorrow.toISOString())
      .order('scheduled_at', { ascending: true });

    if (error) {
      throw new Error(`오늘 일정 조회 실패: ${error.message}`);
    }

    if (!schedules || schedules.length === 0) {
      return [];
    }

    // 면접관 정보 조회
    const allInterviewerIds = new Set<string>();
    schedules.forEach(schedule => {
      if (schedule.interviewer_ids && Array.isArray(schedule.interviewer_ids)) {
        schedule.interviewer_ids.forEach((id: string) => allInterviewerIds.add(id));
      }
    });

    let interviewers: Array<{ id: string; email: string }> = [];
    if (allInterviewerIds.size > 0) {
      const { data: interviewerData } = await supabase
        .from('users')
        .select('id, email')
        .in('id', Array.from(allInterviewerIds));
      
      interviewers = interviewerData || [];
    }

    const interviewerMap = new Map(
      interviewers.map(i => [i.id, i])
    );

    // 각 일정에 면접관 정보 추가
    return schedules.map(schedule => {
      const candidate = schedule.candidates as { name: string; email: string; job_posts?: { title: string } };
      return {
        id: schedule.id,
        candidateId: schedule.candidate_id,
        candidateName: candidate?.name || 'Unknown',
        position: candidate?.job_posts?.title || 'Unknown',
        scheduledAt: schedule.scheduled_at,
        durationMinutes: schedule.duration_minutes,
        status: schedule.status,
        // 주의: 아래 필드들은 마이그레이션 실행 후 사용 가능 (현재는 null로 처리)
        interviewType: (schedule as any).interview_type || null,
        meetingPlatform: (schedule as any).meeting_platform || null,
        meetingLink: (schedule as any).meeting_link || null,
        interviewers: schedule.interviewer_ids
          ?.map((id: string) => interviewerMap.get(id))
          .filter((i): i is { id: string; email: string } => i !== undefined) || [],
      };
    });
  });
}

/**
 * 포지션별 현황 조회
 * @returns 각 job_post별 단계별 후보자 통계
 */
export async function getPositionStatus() {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const isAdmin = user.role === 'admin';
    
    const supabase = isAdmin ? createServiceClient() : await createClient();

    // organization_id에 속한 job_posts 조회
    let jobPostsQuery = supabase
      .from('job_posts')
      .select('id, title, created_at');
    
    if (!isAdmin) {
      jobPostsQuery = jobPostsQuery.eq('organization_id', user.organizationId);
    }

    const { data: jobPosts } = await jobPostsQuery;

    if (!jobPosts || jobPosts.length === 0) {
      return [];
    }

    const jobPostIds = jobPosts.map(jp => jp.id);

    // 각 job_post의 후보자들 조회
    const { data: candidates } = await supabase
      .from('candidates')
      .select('id, job_post_id, status, current_stage_id, created_at')
      .in('job_post_id', jobPostIds);

    // 각 job_post의 면접 일정 조회
    const candidateIds = candidates?.map(c => c.id) || [];
    let schedules: Array<{ candidate_id: string; status: string }> = [];
    if (candidateIds.length > 0) {
      const { data: scheduleData } = await supabase
        .from('schedules')
        .select('candidate_id, status')
        .in('candidate_id', candidateIds);
      schedules = scheduleData || [];
    }

    // 각 job_post의 오퍼 조회
    let offers: Array<{ candidate_id: string }> = [];
    if (candidateIds.length > 0) {
      const { data: offerData } = await supabase
        .from('offers')
        .select('candidate_id')
        .in('candidate_id', candidateIds);
      offers = offerData || [];
    }

    // 통계 계산
    const positionStats = jobPosts.map(jobPost => {
      const jobCandidates = candidates?.filter(c => c.job_post_id === jobPost.id) || [];
      const jobCandidateIds = jobCandidates.map(c => c.id);
      const jobSchedules = schedules.filter(s => jobCandidateIds.includes(s.candidate_id));
      const jobOffers = offers.filter(o => jobCandidateIds.includes(o.candidate_id));

      // 신규 (status = 'pending')
      const newCount = jobCandidates.filter(c => c.status === 'pending').length;

      // 서류 (status = 'in_progress'이고 면접 일정이 없는 경우)
      const documentCount = jobCandidates.filter(
        c => c.status === 'in_progress' && !jobSchedules.some(s => s.candidate_id === c.id)
      ).length;

      // 면접 (면접 일정이 있는 경우)
      const interviewCount = new Set(jobSchedules.map(s => s.candidate_id)).size;

      // 최종 (status = 'in_progress'이고 면접이 완료된 경우 또는 특정 stage)
      const finalCount = jobCandidates.filter(
        c => c.status === 'in_progress' && jobSchedules.some(s => s.candidate_id === c.id && s.status === 'completed')
      ).length;

      // 오퍼 (오퍼가 있는 경우)
      const offerCount = new Set(jobOffers.map(o => o.candidate_id)).size;

      // 총 진행률 계산 (오퍼까지 도달한 비율)
      const total = jobCandidates.length;
      const progress = total > 0 ? Math.round((offerCount / total) * 100) : 0;

      // D+ 계산 (채용 공고 생성일로부터 경과 일수)
      const daysSincePost = Math.floor(
        (new Date().getTime() - new Date(jobPost.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        jobPostId: jobPost.id,
        position: jobPost.title,
        team: 'Development Team', // TODO: 실제 팀 정보가 있다면 사용
        daysSincePost,
        new: newCount,
        document: documentCount,
        interview: interviewCount,
        final: finalCount,
        offer: offerCount,
        progress,
      };
    });

    return positionStats;
  });
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
