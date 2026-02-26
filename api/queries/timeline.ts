'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
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
    const user = await getCurrentUser();
    const isAdmin = user.role === 'admin';
    
    // 관리자일 경우 Service Role Client를 사용하여 RLS 정책 우회
    const supabase = isAdmin ? createServiceClient() : await createClient();

    // 먼저 단순 조회로 테스트
    const { data: simpleData, error: simpleError } = await supabase
      .from('timeline_events')
      .select('*')
      .eq('candidate_id', candidateId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (simpleError) {
      console.error('[타임라인 조회] 단순 조회 실패:', simpleError);
      throw new Error(`타임라인 이벤트 조회 실패: ${simpleError.message}`);
    }

    // 조인 쿼리 시도 (LEFT JOIN 사용: created_by가 null인 경우에도 조회 가능)
    // `!` 대신 외래 키 관계를 사용하되, LEFT JOIN이 되도록 처리
    const { data, error } = await supabase
      .from('timeline_events')
      .select(`
        *,
        created_by_user:users?created_by (
          id,
          email,
          name
        )
      `)
      .eq('candidate_id', candidateId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[타임라인 조회] 조인 쿼리 실패:', error);
      // 조인 실패 시 단순 조회 결과 반환
      console.log('[타임라인 조회] 조인 없이 단순 조회 결과 반환');
      return simpleData || [];
    }

    // created_by가 null인 경우에도 이벤트가 포함되도록 보장
    // 조인 결과가 simpleData보다 적으면 simpleData 사용
    if (data && simpleData && data.length < simpleData.length) {
      console.warn(`[타임라인 조회] 조인 결과가 단순 조회보다 적음 (조인: ${data.length}, 단순: ${simpleData.length}). 단순 조회 결과 사용`);
      // 단순 조회 결과에 created_by_user 정보를 수동으로 추가
      const enrichedData = simpleData.map((event: any) => {
        if (event.created_by) {
          const joinedEvent = data.find((e: any) => e.id === event.id);
          if (joinedEvent && joinedEvent.created_by_user) {
            return { ...event, created_by_user: joinedEvent.created_by_user };
          }
        }
        return event;
      });
      console.log(`[타임라인 조회] 성공 (enriched): ${enrichedData.length}개 이벤트`);
      return enrichedData;
    }

    console.log(`[타임라인 조회] 성공: ${data?.length || 0}개 이벤트`);
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
