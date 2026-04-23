'use server';

import { revalidatePath } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentUser, verifyCandidateAccess } from '@/api/utils/auth';
import { validateRequired, validateUUID } from '@/api/utils/validation';
import { withErrorHandling } from '@/api/utils/errors';
import { parseMentionUserIdsFromText } from '@/lib/mention-tokens';

export type QuoteActivityTarget =
  | { kind: 'timeline_event'; id: string }
  | { kind: 'email'; id: string };

export type QuotedActivitySnapshot = {
  source_type: 'timeline_event' | 'email';
  excerpt: string;
  author_display: string;
  source_created_at: string | null;
};

function truncate(s: string, max: number): string {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function excerptFromTimelineContent(content: Record<string, unknown> | null): string {
  if (!content || typeof content !== 'object') return '액티비티';
  const c = content as Record<string, unknown>;
  const parts = [
    typeof c.message === 'string' ? c.message : '',
    typeof c.content === 'string' ? c.content : '',
    typeof c.latest_message === 'string' ? c.latest_message : '',
    typeof c.subject === 'string' ? c.subject : '',
    typeof c.notes === 'string' ? c.notes : '',
  ].filter(Boolean);
  const raw = parts[0] || '액티비티';
  return truncate(String(raw), 220);
}

/**
 * 인용하여 메인 Activity Timeline에 새 행을 남깁니다 (스레드 밖).
 */
export async function createQuotedActivityTimelineEntry(
  candidateId: string,
  message: string,
  quoteTarget: QuoteActivityTarget,
) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    await verifyCandidateAccess(candidateId);
    const supabase = createServiceClient();

    const validatedCandidateId = validateUUID(candidateId, '후보자 ID');
    const validatedMessage = validateRequired(message, '메시지');

    const mentionedFromText = parseMentionUserIdsFromText(validatedMessage);
    const mentioned_user_ids = [...new Set(mentionedFromText)];

    let snapshot: QuotedActivitySnapshot;
    let quoted_timeline_event_id: string | null = null;
    let quoted_email_id: string | null = null;

    if (quoteTarget.kind === 'timeline_event') {
      const teId = validateUUID(quoteTarget.id, '인용 대상 타임라인 ID');
      const { data: te, error } = await supabase
        .from('timeline_events')
        .select('id, candidate_id, type, content, created_at, created_by')
        .eq('id', teId)
        .single();

      if (error || !te) throw new Error('인용할 타임라인 이벤트를 찾을 수 없습니다.');
      if (te.candidate_id !== validatedCandidateId) {
        throw new Error('인용 대상이 해당 후보자의 타임라인이 아닙니다.');
      }

      quoted_timeline_event_id = teId;
      let author_display = '시스템';
      if (te.created_by) {
        const { data: u } = await supabase
          .from('users')
          .select('email, name')
          .eq('id', te.created_by as string)
          .maybeSingle();
        if (u) {
          author_display =
            (u.name && String(u.name).trim()) || (u.email ? String(u.email).split('@')[0] : '') || author_display;
        }
      }
      snapshot = {
        source_type: 'timeline_event',
        excerpt: excerptFromTimelineContent(te.content as Record<string, unknown>),
        author_display,
        source_created_at: typeof te.created_at === 'string' ? te.created_at : null,
      };
    } else {
      const emId = validateUUID(quoteTarget.id, '인용 대상 이메일 ID');
      const { data: em, error } = await supabase
        .from('emails')
        .select('id, candidate_id, subject, body, from_email, created_at')
        .eq('id', emId)
        .single();

      if (error || !em) throw new Error('인용할 이메일을 찾을 수 없습니다.');
      if (em.candidate_id !== validatedCandidateId) {
        throw new Error('인용 대상이 해당 후보자의 이메일이 아닙니다.');
      }

      quoted_email_id = emId;
      const subj = typeof em.subject === 'string' ? em.subject : '';
      const excerpt = truncate(subj || (typeof em.body === 'string' ? em.body : '') || '이메일', 220);
      snapshot = {
        source_type: 'email',
        excerpt,
        author_display: typeof em.from_email === 'string' ? em.from_email.split('@')[0] || em.from_email : '이메일',
        source_created_at: typeof em.created_at === 'string' ? em.created_at : null,
      };
    }

    const { error: insError } = await supabase.from('timeline_events').insert({
      candidate_id: validatedCandidateId,
      type: 'activity_quote',
      content: {
        message: validatedMessage,
        quoted_timeline_event_id,
        quoted_email_id,
        quoted_snapshot: snapshot,
        mentioned_user_ids,
      },
      created_by: user.userId,
    });

    if (insError) throw new Error(`인용 타임라인 저장 실패: ${insError.message}`);

    revalidatePath(`/dashboard/candidates/${validatedCandidateId}`);
    return { success: true as const };
  });
}
