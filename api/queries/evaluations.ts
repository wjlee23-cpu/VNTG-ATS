'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getCurrentUser, verifyCandidateAccess } from '@/api/utils/auth';
import { validateUUID } from '@/api/utils/validation';
import { withErrorHandling } from '@/api/utils/errors';

/**
 * 후보자의 전형별 평가 조회
 * @param candidateId 후보자 ID
 * @returns 전형별 평가 목록
 */
export async function getStageEvaluations(candidateId: string) {
  return withErrorHandling(async () => {
    await verifyCandidateAccess(candidateId);
    const user = await getCurrentUser();
    const isAdmin = user.role === 'admin';
    
    const supabase = isAdmin ? createServiceClient() : await createClient();

    const { data, error } = await supabase
      .from('stage_evaluations')
      .select(`
        *,
        evaluator:users!stage_evaluations_evaluator_id_fkey (
          id,
          email
        )
      `)
      .eq('candidate_id', candidateId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[평가 조회] Supabase 에러:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        candidateId,
      });
      throw new Error(`평가 조회 실패: ${error.message}`);
    }

    return data || [];
  });
}

/**
 * 특정 전형의 모든 평가 조회
 * @param candidateId 후보자 ID
 * @param stageId 전형 ID
 * @returns 해당 전형의 평가 목록
 */
export async function getEvaluationsByStage(candidateId: string, stageId: string) {
  return withErrorHandling(async () => {
    await verifyCandidateAccess(candidateId);
    const user = await getCurrentUser();
    const isAdmin = user.role === 'admin';
    
    const supabase = isAdmin ? createServiceClient() : await createClient();

    const { data, error } = await supabase
      .from('stage_evaluations')
      .select(`
        *,
        evaluator:users!stage_evaluations_evaluator_id_fkey (
          id,
          email
        )
      `)
      .eq('candidate_id', candidateId)
      .eq('stage_id', stageId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`평가 조회 실패: ${error.message}`);
    }

    return data || [];
  });
}

/**
 * 평가 대기 중인 후보자 조회
 * @param stageId 전형 ID (선택)
 * @returns 평가 대기 중인 후보자 목록
 */
export async function getPendingEvaluations(stageId?: string) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const isAdmin = user.role === 'admin';
    
    const supabase = isAdmin ? createServiceClient() : await createClient();

    // 사용자의 organization_id에 속한 job_posts 조회
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
    let candidatesQuery = supabase
      .from('candidates')
      .select('id, current_stage_id, name, email, job_posts!inner(id, title)')
      .in('job_post_id', jobPostIds)
      .eq('archived', false);

    if (stageId) {
      candidatesQuery = candidatesQuery.eq('current_stage_id', stageId);
    }

    const { data: candidates } = await candidatesQuery;

    if (!candidates || candidates.length === 0) {
      return [];
    }

    // 각 후보자에 대해 평가 상태 확인
    const candidateIds = candidates.map(c => c.id);
    const { data: evaluations } = await supabase
      .from('stage_evaluations')
      .select('candidate_id, stage_id, result')
      .in('candidate_id', candidateIds);

    // 평가가 없거나 pending인 후보자 필터링
    const pendingCandidates = candidates.filter(candidate => {
      const candidateEvaluations = evaluations?.filter(e => 
        e.candidate_id === candidate.id && e.stage_id === candidate.current_stage_id
      ) || [];
      
      // 평가가 없거나 모든 평가가 pending인 경우
      return candidateEvaluations.length === 0 || 
             candidateEvaluations.every(e => e.result === 'pending');
    });

    return pendingCandidates;
  });
}
