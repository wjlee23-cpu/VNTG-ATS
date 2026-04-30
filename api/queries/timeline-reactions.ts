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

export type TimelineReactionUser = {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
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

/**
 * 특정 타임라인 이벤트의 리액션 "사용자 목록"을 조회합니다.
 * - 구글챗처럼 이모지별로 누가 눌렀는지 UI에서 보여주기 위한 용도입니다.
 * - (성능) 타임라인 전체를 한 번에 가져오지 않고, hover/click 시 이벤트 단위로 요청합니다.
 */
export async function getTimelineReactionUsersForTimelineEvent(
  candidateId: string,
  timelineEventId: string,
) {
  return withErrorHandling(async () => {
    await verifyCandidateAccess(candidateId);
    await getCurrentUser(); // RLS + 조직 검증은 정책에서, 여기서는 로그인 여부만 보장

    const validatedCandidateId = validateUUID(candidateId, '후보자 ID');
    const validatedEventId = validateUUID(timelineEventId, '타임라인 이벤트 ID');

    // ✅ 방어: eventId가 해당 후보자의 timeline_events인지 확인
    const supabase = createServiceClient();
    const { data: te, error: teError } = await supabase
      .from('timeline_events')
      .select('id')
      .eq('candidate_id', validatedCandidateId)
      .eq('id', validatedEventId)
      .maybeSingle();

    if (teError) throw new Error(`타임라인 이벤트 검증 실패: ${teError.message}`);
    if (!te?.id) {
      return { byEmoji: {} as Record<string, TimelineReactionUser[]> };
    }

    const { data: rows, error } = await supabase
      .from('timeline_event_reactions')
      .select(
        `
        emoji,
        created_at,
        user:users!timeline_event_reactions_user_id_fkey (
          id,
          email,
          name,
          avatar_url
        )
      `,
      )
      .eq('timeline_event_id', validatedEventId)
      .order('created_at', { ascending: true });

    if (error) throw new Error(`리액션 사용자 조회 실패: ${error.message}`);

    const byEmoji: Record<string, TimelineReactionUser[]> = {};
    for (const r of rows || []) {
      const emoji = String((r as any).emoji ?? '');
      const u = (r as any).user as TimelineReactionUser | null | undefined;
      if (!emoji || !u?.id) continue;
      byEmoji[emoji] = byEmoji[emoji] || [];
      byEmoji[emoji].push({
        id: String(u.id),
        email: String(u.email ?? ''),
        name: (u.name ?? null) as string | null,
        avatar_url: (u.avatar_url ?? null) as string | null,
      });
    }

    return { byEmoji };
  });
}

