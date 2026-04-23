'use server';

import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentUser, verifyCandidateAccess } from '@/api/utils/auth';
import { validateUUID } from '@/api/utils/validation';
import { withErrorHandling } from '@/api/utils/errors';

export type TimelineReactionSummary = {
  emoji: string;
  count: number;
  reactedByMe: boolean;
};

/**
 * 후보자 타임라인 이벤트들의 리액션 집계를 조회합니다.
 * - 이벤트별로 emoji 카운트와 '내가 눌렀는지'를 함께 제공합니다.
 */
export async function getTimelineReactionSummariesForCandidate(
  candidateId: string,
  timelineEventIds: string[],
) {
  return withErrorHandling(async () => {
    await verifyCandidateAccess(candidateId);
    const user = await getCurrentUser();
    const validatedCandidateId = validateUUID(candidateId, '후보자 ID');

    const ids = (Array.isArray(timelineEventIds) ? timelineEventIds : [])
      .map((id) => String(id))
      .filter(Boolean)
      // 합성 이메일 이벤트(`email-...`)는 timeline_events 테이블에 없으므로 제외
      .filter((id) => !id.startsWith('email-'));

    if (ids.length === 0) {
      return { byTimelineEventId: {} as Record<string, TimelineReactionSummary[]> };
    }

    const supabase = createServiceClient();

    // ✅ 방어: ids가 해당 후보자의 timeline_events인지 확인
    // - 잘못된 ID로 다른 후보자 이벤트를 조회하지 않도록 제한합니다.
    const { data: validEvents, error: teError } = await supabase
      .from('timeline_events')
      .select('id')
      .eq('candidate_id', validatedCandidateId)
      .in('id', ids);

    if (teError) throw new Error(`타임라인 이벤트 검증 실패: ${teError.message}`);
    const validIdSet = new Set((validEvents || []).map((r: any) => String(r.id)));
    const filteredIds = ids.filter((id) => validIdSet.has(id));

    if (filteredIds.length === 0) {
      return { byTimelineEventId: {} as Record<string, TimelineReactionSummary[]> };
    }

    const { data: rows, error } = await supabase
      .from('timeline_event_reactions')
      .select('timeline_event_id, emoji, user_id')
      .in('timeline_event_id', filteredIds);

    if (error) throw new Error(`리액션 조회 실패: ${error.message}`);

    const byTimelineEventId: Record<string, TimelineReactionSummary[]> = {};
    const agg: Record<string, Record<string, { count: number; reactedByMe: boolean }>> = {};

    for (const r of rows || []) {
      const tid = String((r as any).timeline_event_id);
      const emoji = String((r as any).emoji ?? '');
      const uid = String((r as any).user_id ?? '');
      if (!tid || !emoji) continue;

      agg[tid] = agg[tid] || {};
      const cur = agg[tid][emoji] || { count: 0, reactedByMe: false };
      cur.count += 1;
      if (uid === user.userId) cur.reactedByMe = true;
      agg[tid][emoji] = cur;
    }

    for (const tid of filteredIds) {
      const m = agg[tid] || {};
      const list = Object.entries(m)
        .map(([emoji, v]) => ({ emoji, count: v.count, reactedByMe: v.reactedByMe }))
        .sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji));
      byTimelineEventId[tid] = list;
    }

    return { byTimelineEventId };
  });
}

