'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { getCurrentUser, verifyCandidateAccess, requireRecruiterOrAdmin } from '@/api/utils/auth';
import { withErrorHandling } from '@/api/utils/errors';

/**
 * 후보자 아카이브 처리
 * 관리자와 리크루터만 사용 가능
 * @param id 후보자 ID
 * @param reason 아카이브 사유
 */
export async function archiveCandidate(id: string, reason: string) {
  return withErrorHandling(async () => {
    // 관리자 또는 리크루터 권한 확인
    await requireRecruiterOrAdmin();
    
    const user = await getCurrentUser();
    await verifyCandidateAccess(id);
    // 권한 검증이 끝난 뒤에는 Service Role로 업데이트/타임라인을 처리해 RLS로 인한 0행 반환을 방지합니다.
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('candidates')
      .update({
        archived: true,
        archive_reason: reason,
        status: 'rejected', // 아카이브 시 상태를 rejected로 변경
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`아카이브 처리 실패: ${error.message}`);
    }

    if (!data) {
      throw new Error('아카이브 처리된 후보자 데이터를 찾을 수 없습니다.');
    }

    // 타임라인 이벤트 생성
    const { error: timelineError } = await supabase.from('timeline_events').insert({
      candidate_id: id,
      type: 'archive',
      content: {
        message: `후보자가 아카이브되었습니다. 사유: ${reason}`,
        archive_reason: reason,
      },
      created_by: user.userId,
    });

    if (timelineError) {
      console.error('[타임라인] 이벤트 생성 실패 (아카이브):', timelineError);
      // 타임라인 이벤트 생성 실패는 치명적이지 않으므로 계속 진행
    }

    // 캐시 무효화
    revalidatePath('/dashboard/candidates');
    revalidatePath(`/dashboard/candidates/${id}`);

    return data;
  });
}

/**
 * 여러 후보자 일괄 아카이브 처리
 * 관리자와 리크루터만 사용 가능
 * @param ids 후보자 ID 배열
 * @param reason 아카이브 사유
 */
export async function bulkArchiveCandidates(ids: string[], reason: string) {
  return withErrorHandling(async () => {
    // 관리자 또는 리크루터 권한 확인
    await requireRecruiterOrAdmin();
    
    const user = await getCurrentUser();
    const supabase = await createClient();

    // 후보자 일괄 아카이브 처리
    const { data, error } = await supabase
      .from('candidates')
      .update({
        archived: true,
        archive_reason: reason,
        status: 'rejected', // 아카이브 시 상태를 rejected로 변경
      })
      .in('id', ids)
      .select();

    if (error) {
      throw new Error(`일괄 아카이브 처리 실패: ${error.message}`);
    }

    // 각 후보자에 대해 타임라인 이벤트 생성
    const timelineEvents = ids.map((id) => ({
      candidate_id: id,
      type: 'archive',
      content: {
        message: `후보자가 일괄 아카이브되었습니다. 사유: ${reason}`,
        archive_reason: reason,
        bulk_action: true,
      },
      created_by: user.userId,
    }));

    const { error: timelineError } = await supabase
      .from('timeline_events')
      .insert(timelineEvents);

    if (timelineError) {
      console.error('[타임라인] 일괄 아카이브 이벤트 생성 실패:', timelineError);
    }

    // 캐시 무효화
    revalidatePath('/dashboard/candidates');
    revalidatePath('/candidates');

    return { count: data?.length || 0 };
  });
}

/**
 * 여러 후보자 일괄 전형 이동
 * 관리자와 리크루터만 사용 가능
 * @param ids 후보자 ID 배열
 * @param targetStageId 이동할 목표 단계 ID
 */
export async function bulkMoveToStage(ids: string[], targetStageId: string) {
  return withErrorHandling(async () => {
    // 관리자 또는 리크루터 권한 확인
    await requireRecruiterOrAdmin();
    
    const user = await getCurrentUser();
    const supabase = await createClient();

    // 이동 전 후보자들의 현재 단계 정보 조회
    const { data: candidates, error: fetchError } = await supabase
      .from('candidates')
      .select('id, current_stage_id')
      .in('id', ids);

    if (fetchError) {
      throw new Error(`후보자 조회 실패: ${fetchError.message}`);
    }

    // 후보자 일괄 전형 이동 처리
    const { data, error } = await supabase
      .from('candidates')
      .update({
        current_stage_id: targetStageId,
        status: 'in_progress',
      })
      .in('id', ids)
      .select();

    if (error) {
      throw new Error(`일괄 전형 이동 실패: ${error.message}`);
    }

    // STAGE_ID_TO_NAME_MAP import 없이 직접 매핑
    const stageNames: Record<string, string> = {
      'stage-1': 'New Application',
      'stage-2': 'Application Review',
      'stage-3': 'Competency Assessment',
      'stage-4': 'Technical Test',
      'stage-5': '1st Interview',
      'stage-6': 'Reference Check',
      'stage-7': '2nd Interview',
      'stage-8': 'Offer',
    };

    const targetStageName = stageNames[targetStageId] || targetStageId;

    // 각 후보자에 대해 타임라인 이벤트 생성
    const timelineEvents = (candidates || []).map((candidate) => {
      const fromStageName = stageNames[candidate.current_stage_id || 'stage-1'] || candidate.current_stage_id || 'Unknown';
      return {
        candidate_id: candidate.id,
        type: 'stage_changed',
        content: {
          message: `일괄 처리로 ${fromStageName}에서 ${targetStageName}로 이동했습니다.`,
          from_stage: fromStageName,
          to_stage: targetStageName,
          stage_id: targetStageId,
          bulk_action: true,
        },
        created_by: user.userId,
      };
    });

    if (timelineEvents.length > 0) {
      const { error: timelineError } = await supabase
        .from('timeline_events')
        .insert(timelineEvents);

      if (timelineError) {
        console.error('[타임라인] 일괄 전형 이동 이벤트 생성 실패:', timelineError);
      }
    }

    // 캐시 무효화
    revalidatePath('/dashboard/candidates');
    revalidatePath('/candidates');

    return { count: data?.length || 0, targetStageName };
  });
}

/**
 * 후보자 아카이브 해제
 * 관리자와 리크루터만 사용 가능
 * @param id 후보자 ID
 */
export async function unarchiveCandidate(id: string) {
  return withErrorHandling(async () => {
    // 관리자 또는 리크루터 권한 확인
    await requireRecruiterOrAdmin();
    
    const user = await getCurrentUser();
    await verifyCandidateAccess(id);
    // 권한 검증이 끝난 뒤에는 Service Role로 업데이트/타임라인을 처리해 RLS로 인한 0행 반환을 방지합니다.
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('candidates')
      .update({
        archived: false,
        archive_reason: null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`아카이브 해제 실패: ${error.message}`);
    }

    // 타임라인 이벤트 생성
    await supabase.from('timeline_events').insert({
      candidate_id: id,
      type: 'archive',
      content: {
        message: '후보자가 아카이브에서 복구되었습니다.',
      },
      created_by: user.userId,
    });

    // 캐시 무효화
    revalidatePath('/dashboard/candidates');
    revalidatePath(`/dashboard/candidates/${id}`);

    return data;
  });
}
