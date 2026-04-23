'use server';

import { createServiceClient } from '@/lib/supabase/server';
import { verifyCandidateAccess } from '@/api/utils/auth';
import { validateUUID } from '@/api/utils/validation';
import { withErrorHandling } from '@/api/utils/errors';

export type ActivityThreadCommentRow = {
  id: string;
  candidate_id: string;
  content: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  mentioned_user_ids: string[] | null;
  parent_comment_id: string | null;
  activity_thread_root_timeline_event_id: string | null;
  activity_thread_root_email_id: string | null;
  created_by_user?: {
    id: string;
    email: string;
    name: string | null;
    avatar_url: string | null;
  } | null;
};

function normalizeThreadCommentRows(raw: unknown[] | null | undefined): ActivityThreadCommentRow[] {
  const list = raw || [];
  return list.map((row: any) => {
    const u = row.created_by_user;
    const created_by_user = Array.isArray(u) ? u[0] ?? null : u ?? null;
    return { ...row, created_by_user } as ActivityThreadCommentRow;
  });
}

/** 특정 타임라인 이벤트에 달린 스레드 코멘트 목록 */
export async function getActivityThreadCommentsByTimelineEvent(
  candidateId: string,
  timelineEventId: string,
) {
  return withErrorHandling(async () => {
    await verifyCandidateAccess(candidateId);
    const validatedCandidateId = validateUUID(candidateId, '후보자 ID');
    const validatedTe = validateUUID(timelineEventId, '타임라인 이벤트 ID');
    const supabase = createServiceClient();

    const { data: te, error: teError } = await supabase
      .from('timeline_events')
      .select('id, candidate_id')
      .eq('id', validatedTe)
      .single();
    if (teError || !te || te.candidate_id !== validatedCandidateId) {
      throw new Error('타임라인 이벤트를 찾을 수 없거나 후보자와 일치하지 않습니다.');
    }

    const { data, error } = await supabase
      .from('comments')
      .select(
        `
        id, candidate_id, content, created_by, created_at, updated_at,
        mentioned_user_ids, parent_comment_id,
        activity_thread_root_timeline_event_id, activity_thread_root_email_id,
        created_by_user:users!created_by ( id, email, name, avatar_url )
      `,
      )
      .eq('candidate_id', validatedCandidateId)
      .eq('activity_thread_root_timeline_event_id', validatedTe)
      .order('created_at', { ascending: true });

    if (error) throw new Error(`스레드 코멘트 조회 실패: ${error.message}`);
    return normalizeThreadCommentRows(data);
  });
}

/** 합성 이메일 행(emails.id)에 달린 스레드 코멘트 목록 */
export async function getActivityThreadCommentsByEmailId(candidateId: string, emailId: string) {
  return withErrorHandling(async () => {
    await verifyCandidateAccess(candidateId);
    const validatedCandidateId = validateUUID(candidateId, '후보자 ID');
    const validatedEmail = validateUUID(emailId, '이메일 ID');
    const supabase = createServiceClient();

    const { data: em, error: emError } = await supabase
      .from('emails')
      .select('id, candidate_id')
      .eq('id', validatedEmail)
      .single();
    if (emError || !em || em.candidate_id !== validatedCandidateId) {
      throw new Error('이메일을 찾을 수 없거나 후보자와 일치하지 않습니다.');
    }

    const { data, error } = await supabase
      .from('comments')
      .select(
        `
        id, candidate_id, content, created_by, created_at, updated_at,
        mentioned_user_ids, parent_comment_id,
        activity_thread_root_timeline_event_id, activity_thread_root_email_id,
        created_by_user:users!created_by ( id, email, name, avatar_url )
      `,
      )
      .eq('candidate_id', validatedCandidateId)
      .eq('activity_thread_root_email_id', validatedEmail)
      .order('created_at', { ascending: true });

    if (error) throw new Error(`스레드 코멘트 조회 실패: ${error.message}`);
    return normalizeThreadCommentRows(data);
  });
}

export type ActivityThreadSummary = {
  count: number;
  lastCreatedAt: string | null;
};

/** 후보자 기준 스레드 요약: 타임라인 이벤트별 */
export async function getActivityThreadSummariesForCandidate(candidateId: string) {
  return withErrorHandling(async () => {
    await verifyCandidateAccess(candidateId);
    const validatedCandidateId = validateUUID(candidateId, '후보자 ID');
    const supabase = createServiceClient();

    const { data: rowsTe, error: e1 } = await supabase
      .from('comments')
      .select('activity_thread_root_timeline_event_id, created_at')
      .eq('candidate_id', validatedCandidateId)
      .not('activity_thread_root_timeline_event_id', 'is', null);

    if (e1) throw new Error(`스레드 요약 조회 실패: ${e1.message}`);

    const { data: rowsEm, error: e2 } = await supabase
      .from('comments')
      .select('activity_thread_root_email_id, created_at')
      .eq('candidate_id', validatedCandidateId)
      .not('activity_thread_root_email_id', 'is', null);

    if (e2) throw new Error(`스레드 요약 조회 실패: ${e2.message}`);

    const byTimelineEventId: Record<string, ActivityThreadSummary> = {};
    for (const r of rowsTe || []) {
      const tid = r.activity_thread_root_timeline_event_id as string;
      const at = r.created_at as string;
      const cur = byTimelineEventId[tid] || { count: 0, lastCreatedAt: null as string | null };
      cur.count += 1;
      if (!cur.lastCreatedAt || at > cur.lastCreatedAt) cur.lastCreatedAt = at;
      byTimelineEventId[tid] = cur;
    }

    const byEmailId: Record<string, ActivityThreadSummary> = {};
    for (const r of rowsEm || []) {
      const eid = r.activity_thread_root_email_id as string;
      const at = r.created_at as string;
      const cur = byEmailId[eid] || { count: 0, lastCreatedAt: null as string | null };
      cur.count += 1;
      if (!cur.lastCreatedAt || at > cur.lastCreatedAt) cur.lastCreatedAt = at;
      byEmailId[eid] = cur;
    }

    return { byTimelineEventId, byEmailId };
  });
}
