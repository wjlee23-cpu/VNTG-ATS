'use server';

import { revalidatePath } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentUser, verifyCandidateAccess } from '@/api/utils/auth';
import { validateRequired, validateUUID } from '@/api/utils/validation';
import { withErrorHandling } from '@/api/utils/errors';

/**
 * 타임라인 이벤트 리액션(이모지)을 토글합니다.
 * - 같은 계정은 같은 이모지에 대해 1개만 가능(재클릭 시 취소)
 */
export async function toggleTimelineEventReaction(timelineEventId: string, emoji: string) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const validatedEventId = validateUUID(timelineEventId, '타임라인 이벤트 ID');
    const validatedEmoji = validateRequired(emoji, '이모지');

    const supabase = createServiceClient();

    // ✅ 어떤 후보자의 타임라인인지 확인한 뒤, 후보자 접근 권한을 검증합니다.
    const { data: te, error: teError } = await supabase
      .from('timeline_events')
      .select('id, candidate_id')
      .eq('id', validatedEventId)
      .single();

    if (teError || !te?.candidate_id) {
      throw new Error('타임라인 이벤트를 찾을 수 없습니다.');
    }

    const candidateId = String(te.candidate_id);
    await verifyCandidateAccess(candidateId);

    // 기존 리액션 존재 여부 확인
    const { data: existing, error: exError } = await supabase
      .from('timeline_event_reactions')
      .select('id')
      .eq('timeline_event_id', validatedEventId)
      .eq('user_id', user.userId)
      .eq('emoji', validatedEmoji)
      .maybeSingle();

    if (exError) {
      throw new Error(`리액션 조회 실패: ${exError.message}`);
    }

    // 있으면 삭제(취소), 없으면 추가
    if (existing?.id) {
      const { error: delError } = await supabase
        .from('timeline_event_reactions')
        .delete()
        .eq('id', existing.id);

      if (delError) throw new Error(`리액션 취소 실패: ${delError.message}`);
    } else {
      const { error: insError } = await supabase.from('timeline_event_reactions').insert({
        timeline_event_id: validatedEventId,
        user_id: user.userId,
        emoji: validatedEmoji,
      });

      if (insError) throw new Error(`리액션 추가 실패: ${insError.message}`);
    }

    revalidatePath(`/dashboard/candidates/${candidateId}`);
    return { success: true as const };
  });
}

