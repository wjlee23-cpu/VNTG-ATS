'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getCurrentUser, verifyCandidateAccess, verifyJobPostAccess } from '@/api/utils/auth';
import { validateUUID } from '@/api/utils/validation';
import { withErrorHandling } from '@/api/utils/errors';
import { getStageNameByStageId } from '@/constants/stages';

/**
 * 현재 조직의 모든 후보자 조회
 * 관리자일 경우 모든 조직의 후보자를 조회하고, 일반 사용자는 자신의 조직 후보자만 조회합니다.
 * @param jobPostId 특정 채용 공고의 후보자만 조회 (선택)
 * @returns 후보자 목록
 */
export async function getCandidates(jobPostId?: string) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const isAdmin = user.role === 'admin';
    
    // 관리자일 경우 Service Role Client를 사용하여 RLS 정책 우회하여 모든 데이터 조회
    const supabase = isAdmin ? createServiceClient() : await createClient();

    // 관리자일 경우 모든 job_posts 조회, 일반 사용자는 자신의 organization_id로 필터링
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

    const jobPostIds = jobPostId
      ? [validateUUID(jobPostId, '채용 공고 ID')]
      : jobPosts.map(jp => jp.id);

    // job_post_id 필터링 및 후보자 조회 (process 정보 포함)
    const { data, error } = await supabase
      .from('candidates')
      .select(`
        *,
        job_posts (
          id,
          title,
          organization_id,
          process_id,
          processes (
            id,
            name,
            stages
          )
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
    const user = await getCurrentUser();
    const isAdmin = user.role === 'admin';
    
    // 관리자일 경우 Service Role Client를 사용하여 RLS 정책 우회하여 모든 데이터 조회
    const supabase = isAdmin ? createServiceClient() : await createClient();

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
    const user = await getCurrentUser();
    const isAdmin = user.role === 'admin';
    
    // 관리자일 경우 Service Role Client를 사용하여 RLS 정책 우회하여 모든 데이터 조회
    const supabase = isAdmin ? createServiceClient() : await createClient();

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
 * 단계별 후보자 수 조회
 * @returns 단계별 후보자 수
 */
export async function getCandidatesByStage() {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const isAdmin = user.role === 'admin';
    
    // 관리자일 경우 Service Role Client를 사용하여 RLS 정책 우회하여 모든 데이터 조회
    const supabase = isAdmin ? createServiceClient() : await createClient();

    // 관리자일 경우 모든 job_posts 조회, 일반 사용자는 자신의 organization_id로 필터링
    let jobPostsQuery = supabase
      .from('job_posts')
      .select('id');
    
    if (!isAdmin) {
      jobPostsQuery = jobPostsQuery.eq('organization_id', user.organizationId);
    }

    const { data: jobPosts } = await jobPostsQuery;

    if (!jobPosts || jobPosts.length === 0) {
      return {};
    }

    const jobPostIds = jobPosts.map(jp => jp.id);

    // 모든 후보자 조회 (current_stage_id 포함)
    const { data: candidates } = await supabase
      .from('candidates')
      .select('current_stage_id')
      .in('job_post_id', jobPostIds);

    // 단계별 카운트 (current_stage_id를 단계 이름으로 매핑)
    const byStage: Record<string, number> = {};
    
    // 단계 이름 목록 (사용자가 정의한 단계)
    const stageNames = [
      'New Application',
      'HR Screening',
      'Application Review',
      'Competency Assessment',
      'Technical Test',
      '1st Interview',
      'Reference Check',
      '2nd Interview',
    ];

    // 각 단계별로 초기값 설정
    stageNames.forEach(stageName => {
      byStage[stageName] = 0;
    });

    candidates?.forEach(candidate => {
      // current_stage_id는 process의 stage ID("stage-1", "stage-2" 등)이므로
      // 매핑 상수를 사용하여 단계 이름으로 변환
      const stageName = getStageNameByStageId(candidate.current_stage_id) || 'New Application';
      
      // stageName이 정의된 단계 목록에 포함되어 있으면 카운트 증가
      if (stageNames.includes(stageName)) {
        byStage[stageName] = (byStage[stageName] || 0) + 1;
      } else {
        // 정의되지 않은 단계는 'New Application'으로 카운트
        byStage['New Application'] = (byStage['New Application'] || 0) + 1;
      }
    });

    return byStage;
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
    const isAdmin = user.role === 'admin';
    
    // 관리자일 경우 Service Role Client를 사용하여 RLS 정책 우회하여 모든 데이터 조회
    const supabase = isAdmin ? createServiceClient() : await createClient();

    // 관리자일 경우 모든 job_posts 조회, 일반 사용자는 자신의 organization_id로 필터링
    let jobPostsQuery = supabase
      .from('job_posts')
      .select('id');
    
    if (!isAdmin) {
      jobPostsQuery = jobPostsQuery.eq('organization_id', user.organizationId);
    }

    const { data: jobPosts } = await jobPostsQuery;

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
    const byStatus: Record<string, number> = {};
    let total = 0;

    for (const status of statuses) {
      const { count } = await supabase
        .from('candidates')
        .select('*', { count: 'exact', head: true })
        .in('job_post_id', jobPostIds)
        .eq('status', status);

      byStatus[status] = count || 0;
      total += count || 0;
    }

    // 단계별 카운트 (current_stage_id 기준)
    const { data: candidates } = await supabase
      .from('candidates')
      .select('current_stage_id')
      .in('job_post_id', jobPostIds);

    const byStage: Record<string, number> = {};
    candidates?.forEach(candidate => {
      const stageId = candidate.current_stage_id || 'unknown';
      byStage[stageId] = (byStage[stageId] || 0) + 1;
    });

    return {
      total,
      byStatus,
      byStage,
    };
  });
}
