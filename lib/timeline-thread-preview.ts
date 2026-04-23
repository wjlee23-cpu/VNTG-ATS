import type { TimelineEvent } from '@/types/candidate-detail';
import { formatEmailBodyForDisplay } from '@/lib/candidate-detail-utils';

/** 코멘트형 타임라인 본문을 한 줄 텍스트로 (스레드 패널 원문 요약용) */
export function getCommentBodyPlain(content: TimelineEvent['content'] | undefined): string {
  if (!content) return '코멘트가 작성되었습니다.';
  const raw =
    (typeof content.content === 'string' ? content.content : undefined) ??
    (typeof content.new_content === 'string' ? content.new_content : undefined) ??
    (typeof content.message === 'string' ? content.message : undefined);
  return raw?.trim() ? raw : '코멘트가 작성되었습니다.';
}

function truncate(s: string, maxLen: number) {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen - 1)}…`;
}

/** 스레드 패널 상단에 표시할 원문 텍스트 (멘션 토큰은 그대로 두고 길이만 제한) */
export function getTimelineThreadRootExcerpt(event: TimelineEvent, maxLen = 480): string {
  switch (event.type) {
    case 'comment':
    case 'comment_created':
    case 'comment_updated':
      return truncate(getCommentBodyPlain(event.content), maxLen);
    case 'email':
    case 'email_received': {
      const sub = event.content?.subject || '제목 없음';
      const body = formatEmailBodyForDisplay(event.content?.body);
      const combined = body ? `${sub} — ${body}` : sub;
      return truncate(combined, maxLen);
    }
    case 'activity_quote': {
      const msg = typeof event.content?.message === 'string' ? event.content.message : '';
      const ex = event.content?.quoted_snapshot as { excerpt?: string } | undefined;
      const snap = ex?.excerpt?.trim();
      return truncate(snap || msg || '인용 메시지', maxLen);
    }
    case 'stage_evaluation': {
      const notes =
        event.content?.notes ||
        (typeof event.content?.reason === 'string' ? event.content.reason : undefined) ||
        event.content?.message ||
        '평가가 완료되었습니다.';
      return truncate(String(notes), maxLen);
    }
    case 'scorecard':
    case 'scorecard_created': {
      const body =
        event.content?.notes || event.content?.message || (event.type === 'scorecard' ? '평가가 작성되었습니다.' : '면접 평가표가 작성되었습니다.');
      return truncate(String(body), maxLen);
    }
    default: {
      const msg = event.content?.message;
      if (typeof msg === 'string' && msg.trim()) return truncate(msg, maxLen);
      const c = event.content?.content;
      if (typeof c === 'string' && c.trim()) return truncate(c, maxLen);
      return '활동 기록';
    }
  }
}
