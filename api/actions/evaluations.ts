'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { getCurrentUser, verifyCandidateAccess } from '@/api/utils/auth';
import { validateUUID, validateRequired } from '@/api/utils/validation';
import { withErrorHandling } from '@/api/utils/errors';
import { STAGE_ID_TO_NAME_MAP } from '@/constants/stages';
import { getJobProcessInfo, getNextStageId } from '@/utils/stage-utils';

/**
 * 전형별 평가 생성
 * @param candidateId 후보자 ID
 * @param stageId 전형 ID
 * @param result 평가 결과 (pass/fail/pending)
 * @param notes 평가 노트
 */
export async function createStageEvaluation(
  candidateId: string,
  stageId: string,
  result: 'pass' | 'fail' | 'pending',
  notes?: string
) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const candidate = await verifyCandidateAccess(candidateId);
    const supabase = await createClient();

    // 기존 평가가 있는지 확인
    const { data: existingEvaluation } = await supabase
      .from('stage_evaluations')
      .select('id')
      .eq('candidate_id', candidateId)
      .eq('stage_id', stageId)
      .eq('evaluator_id', user.userId)
      .maybeSingle();

    if (existingEvaluation) {
      throw new Error('이미 평가가 존재합니다. 수정 기능을 사용해주세요.');
    }

    // 평가 생성
    const { data, error } = await supabase
      .from('stage_evaluations')
      .insert({
        candidate_id: candidateId,
        stage_id: stageId,
        evaluator_id: user.userId,
        result,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`평가 생성 실패: ${error.message}`);
    }

    // 타임라인 이벤트 생성
    const stageName = STAGE_ID_TO_NAME_MAP[stageId] || stageId;
    await supabase.from('timeline_events').insert({
      candidate_id: candidateId,
      type: 'stage_evaluation',
      content: {
        message: `${stageName} 전형 평가가 완료되었습니다.`,
        stage_id: stageId,
        stage_name: stageName,
        result,
        notes,
      },
      created_by: user.userId,
    });

    // 캐시 무효화
    revalidatePath('/dashboard/candidates');
    revalidatePath(`/dashboard/candidates/${candidateId}`);

    return data;
  });
}

/**
 * 전형별 평가 수정
 * @param evaluationId 평가 ID
 * @param result 평가 결과 (pass/fail/pending)
 * @param notes 평가 노트
 */
export async function updateStageEvaluation(
  evaluationId: string,
  result: 'pass' | 'fail' | 'pending',
  notes?: string
) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const supabase = await createClient();

    // 평가 조회 및 권한 확인
    const { data: evaluation, error: fetchError } = await supabase
      .from('stage_evaluations')
      .select('*, candidates!inner(id)')
      .eq('id', evaluationId)
      .single();

    if (fetchError || !evaluation) {
      throw new Error('평가를 찾을 수 없습니다.');
    }

    await verifyCandidateAccess(evaluation.candidate_id);

    // 평가 수정
    const { data, error } = await supabase
      .from('stage_evaluations')
      .update({
        result,
        notes: notes || null,
      })
      .eq('id', evaluationId)
      .select()
      .single();

    if (error) {
      throw new Error(`평가 수정 실패: ${error.message}`);
    }

    // 타임라인 이벤트 생성
    const stageName = STAGE_ID_TO_NAME_MAP[evaluation.stage_id] || evaluation.stage_id;
    await supabase.from('timeline_events').insert({
      candidate_id: evaluation.candidate_id,
      type: 'stage_evaluation',
      content: {
        message: `${stageName} 전형 평가가 수정되었습니다.`,
        stage_id: evaluation.stage_id,
        stage_name: stageName,
        result,
        notes,
      },
      created_by: user.userId,
    });

    // 캐시 무효화
    revalidatePath('/dashboard/candidates');
    revalidatePath(`/dashboard/candidates/${evaluation.candidate_id}`);

    return data;
  });
}

/**
 * 평가 승인 및 다음 전형 이동
 * @param candidateId 후보자 ID
 * @param currentStageId 현재 전형 ID
 */
export async function approveStageEvaluation(candidateId: string, currentStageId: string) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const candidate = await verifyCandidateAccess(candidateId);
    const supabase = await createClient();

    // 현재 전형의 평가 확인
    const { data: evaluations } = await supabase
      .from('stage_evaluations')
      .select('*')
      .eq('candidate_id', candidateId)
      .eq('stage_id', currentStageId);

    // 모든 평가가 pass인지 확인
    const allPassed = evaluations && evaluations.length > 0 && evaluations.every(e => e.result === 'pass');
    
    if (!allPassed) {
      throw new Error('모든 평가가 합격 상태가 아닙니다.');
    }

    // Job의 커스텀 단계 정보 조회
    const { customStages } = await getJobProcessInfo(candidate.job_post_id);

    // 다음 전형 찾기 (job의 custom_stages order 순서대로)
    const nextStageId = getNextStageId(currentStageId, customStages);

    if (!nextStageId) {
      throw new Error('다음 전형이 없습니다.');
    }

    // 다음 단계 이름 찾기
    let nextStageName: string;
    if (customStages) {
      const nextStage = customStages.find(s => s.id === nextStageId);
      nextStageName = nextStage?.name || STAGE_ID_TO_NAME_MAP[nextStageId] || nextStageId;
    } else {
      // custom_stages가 null이면 기본 매핑 사용
      nextStageName = STAGE_ID_TO_NAME_MAP[nextStageId] || nextStageId;
    }

    // 후보자 전형 업데이트
    const { data, error } = await supabase
      .from('candidates')
      .update({
        current_stage_id: nextStageId,
        status: 'in_progress',
      })
      .eq('id', candidateId)
      .select()
      .single();

    if (error) {
      throw new Error(`전형 이동 실패: ${error.message}`);
    }

    // 타임라인 이벤트 생성
    let currentStageName: string;
    if (customStages) {
      const currentStage = customStages.find(s => s.id === currentStageId);
      currentStageName = currentStage?.name || STAGE_ID_TO_NAME_MAP[currentStageId] || currentStageId;
    } else {
      currentStageName = STAGE_ID_TO_NAME_MAP[currentStageId] || currentStageId;
    }
    await supabase.from('timeline_events').insert({
      candidate_id: candidateId,
      type: 'stage_changed',
      content: {
        message: `${currentStageName}에서 ${nextStageName}로 이동했습니다.`,
        from_stage: currentStageName,
        to_stage: nextStageName,
        stage_id: nextStageId,
      },
      created_by: user.userId,
    });

    // 캐시 무효화
    revalidatePath('/dashboard/candidates');
    revalidatePath(`/dashboard/candidates/${candidateId}`);

    return data;
  });
}

/**
 * 불합격 처리
 * @param candidateId 후보자 ID
 * @param stageId 전형 ID
 * @param reason 불합격 사유
 */
export async function rejectCandidate(candidateId: string, stageId: string, reason?: string) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const candidate = await verifyCandidateAccess(candidateId);
    const supabase = await createClient();

    // 후보자 상태를 rejected로 변경
    const { data, error } = await supabase
      .from('candidates')
      .update({
        status: 'rejected',
      })
      .eq('id', candidateId)
      .select()
      .single();

    if (error) {
      throw new Error(`불합격 처리 실패: ${error.message}`);
    }

    // 타임라인 이벤트 생성
    const stageName = STAGE_ID_TO_NAME_MAP[stageId] || stageId;
    await supabase.from('timeline_events').insert({
      candidate_id: candidateId,
      type: 'stage_evaluation',
      content: {
        message: `${stageName} 전형에서 불합격 처리되었습니다.${reason ? ` 사유: ${reason}` : ''}`,
        stage_id: stageId,
        stage_name: stageName,
        result: 'fail',
        reason,
      },
      created_by: user.userId,
    });

    // 캐시 무효화
    revalidatePath('/dashboard/candidates');
    revalidatePath(`/dashboard/candidates/${candidateId}`);

    return data;
  });
}

/**
 * 관리자 전형 스킵 (평가 없이 다음 전형으로 이동)
 * @param candidateId 후보자 ID
 * @param currentStageId 현재 전형 ID
 */
export async function skipStage(candidateId: string, currentStageId: string) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    
    // 관리자 권한 확인
    if (user.role !== 'admin') {
      throw new Error('관리자만 전형을 스킵할 수 있습니다.');
    }

    const candidate = await verifyCandidateAccess(candidateId);
    const supabase = await createClient();

    // Job의 커스텀 단계 정보 조회
    const { customStages } = await getJobProcessInfo(candidate.job_post_id);

    // 다음 전형 찾기 (job의 custom_stages order 순서대로)
    const nextStageId = getNextStageId(currentStageId, customStages);

    if (!nextStageId) {
      throw new Error('다음 전형이 없습니다.');
    }

    // 다음 단계 이름 찾기
    let nextStageName: string;
    if (customStages) {
      const nextStage = customStages.find(s => s.id === nextStageId);
      nextStageName = nextStage?.name || STAGE_ID_TO_NAME_MAP[nextStageId] || nextStageId;
    } else {
      // custom_stages가 null이면 기본 매핑 사용
      nextStageName = STAGE_ID_TO_NAME_MAP[nextStageId] || nextStageId;
    }

    // 후보자 전형 업데이트
    const { data, error } = await supabase
      .from('candidates')
      .update({
        current_stage_id: nextStageId,
        status: 'in_progress',
      })
      .eq('id', candidateId)
      .select()
      .single();

    if (error) {
      throw new Error(`전형 스킵 실패: ${error.message}`);
    }

    // 타임라인 이벤트 생성
    let currentStageName: string;
    if (customStages) {
      const currentStage = customStages.find(s => s.id === currentStageId);
      currentStageName = currentStage?.name || STAGE_ID_TO_NAME_MAP[currentStageId] || currentStageId;
    } else {
      currentStageName = STAGE_ID_TO_NAME_MAP[currentStageId] || currentStageId;
    }
    await supabase.from('timeline_events').insert({
      candidate_id: candidateId,
      type: 'stage_changed',
      content: {
        message: `관리자에 의해 ${currentStageName}에서 ${nextStageName}로 스킵되었습니다.`,
        from_stage: currentStageName,
        to_stage: nextStageName,
        stage_id: nextStageId,
        skipped: true,
      },
      created_by: user.userId,
    });

    // 캐시 무효화
    revalidatePath('/dashboard/candidates');
    revalidatePath(`/dashboard/candidates/${candidateId}`);

    return data;
  });
}

/**
 * 관리자 강제 합격 처리
 * @param candidateId 후보자 ID
 * @param currentStageId 현재 전형 ID
 */
export async function forceApproveStage(candidateId: string, currentStageId: string) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    
    // 관리자 권한 확인
    if (user.role !== 'admin') {
      throw new Error('관리자만 강제 합격 처리를 할 수 있습니다.');
    }

    const candidate = await verifyCandidateAccess(candidateId);
    const supabase = await createClient();

    // 강제 합격 평가 생성 (또는 업데이트)
    const { data: existingEvaluation } = await supabase
      .from('stage_evaluations')
      .select('id')
      .eq('candidate_id', candidateId)
      .eq('stage_id', currentStageId)
      .eq('evaluator_id', user.userId)
      .maybeSingle();

    if (existingEvaluation) {
      // 기존 평가 업데이트
      await supabase
        .from('stage_evaluations')
        .update({
          result: 'pass',
          notes: '관리자에 의해 강제 합격 처리되었습니다.',
        })
        .eq('id', existingEvaluation.id);
    } else {
      // 새 평가 생성
      await supabase
        .from('stage_evaluations')
        .insert({
          candidate_id: candidateId,
          stage_id: currentStageId,
          evaluator_id: user.userId,
          result: 'pass',
          notes: '관리자에 의해 강제 합격 처리되었습니다.',
        });
    }

    // 다음 전형으로 이동
    return approveStageEvaluation(candidateId, currentStageId);
  });
}
