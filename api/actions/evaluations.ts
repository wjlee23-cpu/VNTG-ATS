'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { getCurrentUser, verifyCandidateAccess } from '@/api/utils/auth';
import { validateUUID, validateRequired } from '@/api/utils/validation';
import { withErrorHandling } from '@/api/utils/errors';
import { STAGE_ID_TO_NAME_MAP } from '@/constants/stages';
import { getJobProcessInfo, getNextStageId, getAvailableStages } from '@/utils/stage-utils';
import { CustomStage } from '@/types/job';

/**
 * 사용 가능한 단계 목록 조회 (Server Action)
 * @param jobPostId Job Post ID
 * @param currentStageId 현재 단계 ID
 */
export async function getAvailableStagesAction(jobPostId: string, currentStageId: string) {
  return withErrorHandling(async () => {
    // 입력값 검증
    if (!jobPostId || jobPostId.trim() === '') {
      throw new Error('채용 공고 ID가 필요합니다.');
    }
    
    if (!currentStageId || currentStageId.trim() === '') {
      throw new Error('현재 전형 단계 ID가 필요합니다.');
    }

    const user = await getCurrentUser();
    const isAdmin = user.role === 'admin';
    
    try {
      const stages = await getAvailableStages(jobPostId, currentStageId, isAdmin);
      return stages;
    } catch (error) {
      console.error('getAvailableStages error:', error);
      throw error;
    }
  });
}

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
    
    // RLS 무한 재귀 문제 해결: Service Role Client 사용
    // verifyCandidateAccess에서 이미 권한 확인을 완료했으므로 안전합니다.
    const supabase = createServiceClient();

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

    // 관리자/리크루터/하이어링 매니저가 합격 평가를 남긴 경우 자동으로 다음 전형으로 이동
    if (result === 'pass' && (user.role === 'admin' || user.role === 'recruiter' || user.role === 'hiring_manager')) {
      try {
        // Job의 커스텀 단계 정보 조회
        // 중요: 여기서 createClient(anon key)를 쓰면 프로덕션에서 RLS로 막혀 자동 이동이 조용히 실패할 수 있습니다.
        // 이미 verifyCandidateAccess로 권한 확인을 끝냈으니 Service Role로 안전하게 조회합니다.
        const { customStages } = await getJobProcessInfo(candidate.job_post_id, true);

        // 다음 전형 찾기
        const nextStageId = getNextStageId(stageId, customStages);

        if (nextStageId) {
          // 다음 단계 이름 찾기
          let nextStageName: string;
          if (STAGE_ID_TO_NAME_MAP[nextStageId]) {
            nextStageName = STAGE_ID_TO_NAME_MAP[nextStageId];
          } else if (customStages) {
            const nextStage = customStages.find(s => s.id === nextStageId);
            nextStageName = nextStage?.name || nextStageId;
          } else {
            nextStageName = nextStageId;
          }

          // 현재 단계 이름 찾기
          let currentStageName: string;
          if (STAGE_ID_TO_NAME_MAP[stageId]) {
            currentStageName = STAGE_ID_TO_NAME_MAP[stageId];
          } else if (customStages) {
            const currentStage = customStages.find(s => s.id === stageId);
            currentStageName = currentStage?.name || stageId;
          } else {
            currentStageName = stageId;
          }

          // 후보자 전형 업데이트
          const { error: updateError } = await supabase
            .from('candidates')
            .update({
              current_stage_id: nextStageId,
              status: 'in_progress',
            })
            .eq('id', candidateId);

          if (!updateError) {
            // 타임라인 이벤트 생성 (전형 이동)
            await supabase.from('timeline_events').insert({
              candidate_id: candidateId,
              type: 'stage_changed',
              content: {
                message: `${user.role === 'admin' ? '관리자' : user.role === 'recruiter' ? '리크루터' : '하이어링 매니저'}의 합격 평가로 인해 ${currentStageName}에서 ${nextStageName}로 자동 이동했습니다.`,
                from_stage: currentStageName,
                to_stage: nextStageName,
                stage_id: nextStageId,
                auto_advanced: true,
              },
              created_by: user.userId,
            });
          }
        }
      } catch (error) {
        // 자동 이동 실패해도 평가 생성은 성공한 것으로 처리
        console.error('자동 전형 이동 실패:', error);
      }
    }

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
    
    // RLS 무한 재귀 문제 해결: Service Role Client 사용
    const supabase = createServiceClient();

    // 평가 조회 및 권한 확인
    const { data: evaluation, error: fetchError } = await supabase
      .from('stage_evaluations')
      .select('*, candidates!inner(id)')
      .eq('id', evaluationId)
      .single();

    if (fetchError || !evaluation) {
      throw new Error('평가를 찾을 수 없습니다.');
    }

    // verifyCandidateAccess에서 권한 확인 (Service Role Client 사용)
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

    // 관리자/리크루터/하이어링 매니저가 합격 평가로 "수정"한 경우에도 자동으로 다음 전형으로 이동
    if (result === 'pass' && (user.role === 'admin' || user.role === 'recruiter' || user.role === 'hiring_manager')) {
      try {
        // 후보자 현재 단계/채용공고 ID 조회
        const { data: candidateRow, error: candidateError } = await supabase
          .from('candidates')
          .select('id, job_post_id, current_stage_id')
          .eq('id', evaluation.candidate_id)
          .single();

        if (!candidateError && candidateRow) {
          // 이미 다른 단계로 이동된 경우에는 중복 자동 이동을 하지 않습니다.
          if (candidateRow.current_stage_id === evaluation.stage_id) {
            // 커스텀 단계 정보 조회는 Service Role로 안전하게 수행
            const { customStages } = await getJobProcessInfo(candidateRow.job_post_id, true);
            const nextStageId = getNextStageId(evaluation.stage_id, customStages);

            if (nextStageId) {
              // 다음 단계 이름 찾기
              let nextStageName: string;
              if (STAGE_ID_TO_NAME_MAP[nextStageId]) {
                nextStageName = STAGE_ID_TO_NAME_MAP[nextStageId];
              } else if (customStages) {
                const nextStage = customStages.find(s => s.id === nextStageId);
                nextStageName = nextStage?.name || nextStageId;
              } else {
                nextStageName = nextStageId;
              }

              // 현재 단계 이름 찾기
              let currentStageName: string;
              if (STAGE_ID_TO_NAME_MAP[evaluation.stage_id]) {
                currentStageName = STAGE_ID_TO_NAME_MAP[evaluation.stage_id];
              } else if (customStages) {
                const currentStage = customStages.find(s => s.id === evaluation.stage_id);
                currentStageName = currentStage?.name || evaluation.stage_id;
              } else {
                currentStageName = evaluation.stage_id;
              }

              // 후보자 전형 업데이트
              const { error: updateError } = await supabase
                .from('candidates')
                .update({
                  current_stage_id: nextStageId,
                  status: 'in_progress',
                })
                .eq('id', evaluation.candidate_id);

              if (!updateError) {
                await supabase.from('timeline_events').insert({
                  candidate_id: evaluation.candidate_id,
                  type: 'stage_changed',
                  content: {
                    message: `${user.role === 'admin' ? '관리자' : user.role === 'recruiter' ? '리크루터' : '하이어링 매니저'}의 합격 평가로 인해 ${currentStageName}에서 ${nextStageName}로 자동 이동했습니다.`,
                    from_stage: currentStageName,
                    to_stage: nextStageName,
                    stage_id: nextStageId,
                    auto_advanced: true,
                  },
                  created_by: user.userId,
                });
              }
            }
          }
        }
      } catch (error) {
        console.error('자동 전형 이동 실패(평가 수정):', error);
      }
    }

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

    // Job의 커스텀 단계 정보 조회 (관리자 여부 전달)
    const isAdmin = user.role === 'admin';
    const { customStages } = await getJobProcessInfo(candidate.job_post_id, isAdmin);

    // 다음 전형 찾기 (job의 custom_stages order 순서대로)
    const nextStageId = getNextStageId(currentStageId, customStages);

    if (!nextStageId) {
      throw new Error('다음 전형이 없습니다.');
    }

    // 다음 단계 이름 찾기 (영문 이름 우선)
    let nextStageName: string;
    // STAGE_ID_TO_NAME_MAP을 우선 사용하여 영문 이름으로 통일
    if (STAGE_ID_TO_NAME_MAP[nextStageId]) {
      nextStageName = STAGE_ID_TO_NAME_MAP[nextStageId];
    } else if (customStages) {
      const nextStage = customStages.find(s => s.id === nextStageId);
      nextStageName = nextStage?.name || nextStageId;
    } else {
      nextStageName = nextStageId;
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

    // 타임라인 이벤트 생성 (영문 이름 우선)
    let currentStageName: string;
    // STAGE_ID_TO_NAME_MAP을 우선 사용하여 영문 이름으로 통일
    if (STAGE_ID_TO_NAME_MAP[currentStageId]) {
      currentStageName = STAGE_ID_TO_NAME_MAP[currentStageId];
    } else if (customStages) {
      const currentStage = customStages.find(s => s.id === currentStageId);
      currentStageName = currentStage?.name || currentStageId;
    } else {
      currentStageName = currentStageId;
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
        // 불합격 처리 시 자동 아카이브로 전환합니다.
        // - Active 탭에서는 archived=false만 노출되므로, rejected는 Archived로 이동시키는 정책을 따릅니다.
        archived: true,
        // 이미 사유가 있으면 덮어쓰지 않습니다(데이터 손실 방지).
        archive_reason: (candidate as any)?.archive_reason ?? 'rejected',
      } as any)
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
    const isAdmin = user.role === 'admin';
    
    // 관리자 또는 리크루터 권한 확인
    if (!isAdmin && user.role !== 'recruiter') {
      throw new Error('관리자 또는 리크루터만 전형을 이동할 수 있습니다.');
    }

    const candidate = await verifyCandidateAccess(candidateId);
    
    // job_post_id 확인
    if (!candidate.job_post_id) {
      throw new Error('후보자와 연결된 채용 공고를 찾을 수 없습니다.');
    }

    // 관리자일 경우 Service Role Client를 일관되게 사용하여 RLS 정책 우회
    // 리크루터는 일반 클라이언트 사용
    const supabase = isAdmin ? createServiceClient() : await createClient();

    // Job의 커스텀 단계 정보 조회
    // Service Role Client를 직접 사용하여 RLS 정책 우회
    let customStages: CustomStage[] | null = null;
    try {
      const { data: job, error: jobError } = await supabase
        .from('job_posts')
        .select('custom_stages')
        .eq('id', candidate.job_post_id)
        .single();

      if (jobError) {
        // custom_stages 컬럼이 없는 경우 무시하고 null 사용
        if (jobError.message?.includes('does not exist') || jobError.message?.includes('column') || jobError.message?.includes('custom_stages')) {
          customStages = null;
        } else {
          throw new Error(`채용 공고 조회 중 오류: ${jobError.message}`);
        }
      } else if (job) {
        customStages = job.custom_stages === null 
          ? null 
          : (Array.isArray(job.custom_stages) ? job.custom_stages as CustomStage[] : null);
      }
    } catch (error) {
      // 에러가 발생해도 기본 단계 매핑을 사용하도록 null로 설정
      customStages = null;
    }

    // 다음 전형 찾기 (job의 custom_stages order 순서대로)
    const nextStageId = getNextStageId(currentStageId, customStages);

    if (!nextStageId) {
      throw new Error('다음 전형이 없습니다.');
    }

    // 다음 단계 이름 찾기 (영문 이름 우선)
    let nextStageName: string;
    // STAGE_ID_TO_NAME_MAP을 우선 사용하여 영문 이름으로 통일
    if (STAGE_ID_TO_NAME_MAP[nextStageId]) {
      nextStageName = STAGE_ID_TO_NAME_MAP[nextStageId];
    } else if (customStages) {
      const nextStage = customStages.find(s => s.id === nextStageId);
      nextStageName = nextStage?.name || nextStageId;
    } else {
      nextStageName = nextStageId;
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

    // 타임라인 이벤트 생성 (영문 이름 우선)
    let currentStageName: string;
    // STAGE_ID_TO_NAME_MAP을 우선 사용하여 영문 이름으로 통일
    if (STAGE_ID_TO_NAME_MAP[currentStageId]) {
      currentStageName = STAGE_ID_TO_NAME_MAP[currentStageId];
    } else if (customStages) {
      const currentStage = customStages.find(s => s.id === currentStageId);
      currentStageName = currentStage?.name || currentStageId;
    } else {
      currentStageName = currentStageId;
    }
    await supabase.from('timeline_events').insert({
      candidate_id: candidateId,
      type: 'stage_changed',
      content: {
        message: `${user.role === 'admin' ? '관리자' : '리크루터'}에 의해 ${currentStageName}에서 ${nextStageName}로 이동했습니다.`,
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

/**
 * 특정 단계로 이동
 * @param candidateId 후보자 ID
 * @param targetStageId 이동할 목표 단계 ID
 */
export async function moveToStage(candidateId: string, targetStageId: string) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const isAdmin = user.role === 'admin';
    
    // 관리자 또는 리크루터 권한 확인
    if (!isAdmin && user.role !== 'recruiter') {
      throw new Error('관리자 또는 리크루터만 전형을 이동할 수 있습니다.');
    }

    const candidate = await verifyCandidateAccess(candidateId);
    
    // job_post_id 확인
    if (!candidate.job_post_id) {
      throw new Error('후보자와 연결된 채용 공고를 찾을 수 없습니다.');
    }

    // 현재 단계 확인 (null이면 기본값 설정)
    const currentStageId = candidate.current_stage_id && candidate.current_stage_id.trim() !== ''
      ? candidate.current_stage_id
      : 'stage-1';

    // 목표 단계가 현재 단계와 같으면 에러
    if (currentStageId === targetStageId) {
      throw new Error('이미 해당 단계에 있습니다.');
    }

    // 관리자일 경우 Service Role Client를 일관되게 사용하여 RLS 정책 우회
    // 리크루터는 일반 클라이언트 사용
    const supabase = isAdmin ? createServiceClient() : await createClient();

    // 사용 가능한 단계 목록 조회
    const availableStages = await getAvailableStages(
      candidate.job_post_id,
      currentStageId,
      isAdmin
    );

    // 목표 단계가 사용 가능한 단계 목록에 있는지 확인
    const targetStage = availableStages.find(stage => stage.id === targetStageId);
    if (!targetStage) {
      throw new Error('이동할 수 없는 단계입니다.');
    }

    // Job의 커스텀 단계 정보 조회 (단계 이름을 찾기 위해)
    const { customStages } = await getJobProcessInfo(candidate.job_post_id, isAdmin);

    // 현재 단계 이름 찾기 (영문 이름 우선)
    let currentStageName: string;
    // STAGE_ID_TO_NAME_MAP을 우선 사용하여 영문 이름으로 통일
    if (STAGE_ID_TO_NAME_MAP[currentStageId]) {
      currentStageName = STAGE_ID_TO_NAME_MAP[currentStageId];
    } else if (customStages) {
      const currentStage = customStages.find(s => s.id === currentStageId);
      currentStageName = currentStage?.name || currentStageId;
    } else {
      currentStageName = currentStageId;
    }

    // 목표 단계 이름 찾기 (영문 이름 우선)
    // STAGE_ID_TO_NAME_MAP을 우선 사용하여 영문 이름으로 통일
    const targetStageName = STAGE_ID_TO_NAME_MAP[targetStageId] || targetStage.name || targetStageId;

    // 후보자 전형 업데이트
    const { data, error } = await supabase
      .from('candidates')
      .update({
        current_stage_id: targetStageId,
        status: 'in_progress',
      })
      .eq('id', candidateId)
      .select()
      .single();

    if (error) {
      throw new Error(`전형 이동 실패: ${error.message}`);
    }

    // 타임라인 이벤트 생성
    await supabase.from('timeline_events').insert({
      candidate_id: candidateId,
      type: 'stage_changed',
      content: {
        message: `${user.role === 'admin' ? '관리자' : '리크루터'}에 의해 ${currentStageName}에서 ${targetStageName}로 이동했습니다.`,
        from_stage: currentStageName,
        to_stage: targetStageName,
        stage_id: targetStageId,
        manually_moved: true,
      },
      created_by: user.userId,
    });

    // 캐시 무효화
    revalidatePath('/dashboard/candidates');
    revalidatePath(`/dashboard/candidates/${candidateId}`);

    return data;
  });
}
