'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Paperclip, MessageSquareText, X } from 'lucide-react';
import { createComment } from '@/api/actions/comments';
import type { ActivityCommentThreadRoot } from '@/api/actions/comments';
import {
  getActivityThreadCommentsByEmailId,
  getActivityThreadCommentsByTimelineEvent,
  type ActivityThreadCommentRow,
} from '@/api/queries/activity-threads';
import type { TimelineEvent } from '@/types/candidate-detail';
import { MentionTextarea, buildMentionUserMap, type MentionableUser } from './MentionTextarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { renderBlockTextWithResolvedMentions } from '@/lib/render-mention-text';
import { getTimelineThreadRootExcerpt } from '@/lib/timeline-thread-preview';
import { cn } from '@/lib/utils';

interface ActivityThreadSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateId: string;
  threadRoot: ActivityCommentThreadRoot | null;
  /** 스레드가 달린 원본 타임라인 행(요약용) */
  previewEvent: TimelineEvent | null;
  mentionUsers: MentionableUser[];
  onAfterPost: () => void | Promise<void>;
  className?: string;
}

function formatThreadTime(iso: string) {
  try {
    return format(new Date(iso), 'a h:mm', { locale: ko });
  } catch {
    return iso;
  }
}

export function ActivityThreadSheet({
  open,
  onOpenChange,
  candidateId,
  threadRoot,
  previewEvent,
  mentionUsers,
  className,
  onAfterPost,
}: ActivityThreadSheetProps) {
  const [rows, setRows] = useState<ActivityThreadCommentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const userMap = buildMentionUserMap(mentionUsers);

  const reload = useCallback(async () => {
    if (!threadRoot) return;
    setLoading(true);
    try {
      const applyMigrationHint =
        'Supabase 대시보드 → SQL Editor에서 `supabase/migrations/20260423120000_activity_timeline_threads_quotes.sql` 파일 전체를 실행한 뒤 다시 시도해 주세요.';

      if (threadRoot.kind === 'timeline_event') {
        const res = await getActivityThreadCommentsByTimelineEvent(candidateId, threadRoot.id);
        if (res.error) {
          if (
            res.error.includes('activity_thread_root_timeline_event_id') &&
            res.error.includes('does not exist')
          ) {
            setRows([]);
            toast.error(`스레드 기능에 필요한 DB 컬럼이 없습니다. ${applyMigrationHint}`, {
              duration: 14_000,
            });
            return;
          }
          throw new Error(res.error);
        }
        setRows((res.data || []) as ActivityThreadCommentRow[]);
      } else {
        const res = await getActivityThreadCommentsByEmailId(candidateId, threadRoot.id);
        if (res.error) {
          if (
            res.error.includes('activity_thread_root_email_id') &&
            res.error.includes('does not exist')
          ) {
            setRows([]);
            toast.error(`스레드 기능에 필요한 DB 컬럼이 없습니다. ${applyMigrationHint}`, {
              duration: 14_000,
            });
            return;
          }
          throw new Error(res.error);
        }
        setRows((res.data || []) as ActivityThreadCommentRow[]);
      }
    } catch (e) {
      console.error(e);
      toast.error('스레드를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [candidateId, threadRoot]);

  useEffect(() => {
    if (open && threadRoot) void reload();
    if (!open) {
      setText('');
    }
  }, [open, threadRoot, reload]);

  const handleSendThread = async () => {
    if (!threadRoot || !text.trim()) {
      toast.error('내용을 입력해주세요.');
      return;
    }
    setSending(true);
    try {
      const res = await createComment(candidateId, text.trim(), undefined, undefined, true, threadRoot);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success('답장이 등록되었습니다.');
        setText('');
        await reload();
        await onAfterPost();
      }
    } catch {
      toast.error('저장 중 오류가 발생했습니다.');
    } finally {
      setSending(false);
    }
  };

  if (!open || !threadRoot || !previewEvent) return null;

  const previewAuthor = previewEvent.created_by_user;
  const previewLabel =
    previewAuthor?.name?.trim() || previewAuthor?.email?.split('@')[0] || '사용자';
  const previewFb = previewLabel.slice(0, 1).toUpperCase();
  const rootExcerpt = getTimelineThreadRootExcerpt(previewEvent);

  return (
    <aside
      className={cn(
        'box-border flex min-h-0 w-[380px] min-w-[380px] max-w-[380px] flex-none flex-col self-stretch border-l border-neutral-200/80 bg-white shadow-[-8px_0_30px_rgba(0,0,0,0.03)]',
        className
      )}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-neutral-100 bg-white px-5 py-4">
        <div className="flex items-center gap-2">
          <MessageSquareText className="h-4 w-4 text-indigo-500" />
          <h3 className="text-sm font-bold text-neutral-900">스레드 (대화)</h3>
        </div>
        <button
          type="button"
          className="rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
          onClick={() => onOpenChange(false)}
          aria-label="스레드 닫기"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto bg-[#FDFDFD] p-5">
        <div className="relative">
          <div className="mb-2 flex items-center gap-2">
            <Avatar className="h-5 w-5 border border-neutral-200 shadow-sm">
              <AvatarImage src={previewAuthor?.avatar_url ?? undefined} alt="" />
              <AvatarFallback className="text-[9px]">{previewFb}</AvatarFallback>
            </Avatar>
            <span className="text-[12px] font-bold text-neutral-900">{previewLabel}</span>
            <span className="text-[10px] font-medium text-neutral-400">
              {formatThreadTime(previewEvent.created_at)}
            </span>
          </div>
          <div className="rounded-xl rounded-tl-sm border border-neutral-100 border-l-4 border-l-indigo-400 bg-white p-3 shadow-sm">
            <p className="text-[13px] leading-relaxed text-neutral-700 [overflow-wrap:anywhere] whitespace-pre-wrap">
              {rootExcerpt}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-neutral-100" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
            답장 {rows.length}개
          </span>
          <div className="h-px flex-1 bg-neutral-100" />
        </div>

        {loading ? (
          <p className="text-sm text-neutral-500">불러오는 중…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-neutral-500">아직 답장이 없습니다.</p>
        ) : (
          <div className="space-y-5">
            {rows.map((row) => {
              const u = row.created_by_user;
              const label = u?.name?.trim() || u?.email?.split('@')[0] || '사용자';
              const fb = label.slice(0, 1).toUpperCase();
              return (
                <div key={row.id}>
                  <div className="mb-1.5 flex items-center gap-2">
                    <Avatar className="h-5 w-5 border border-neutral-200">
                      <AvatarImage src={u?.avatar_url ?? undefined} alt="" />
                      <AvatarFallback className="text-[9px]">{fb}</AvatarFallback>
                    </Avatar>
                    <span className="text-[12px] font-bold text-neutral-900">{label}</span>
                    <span className="text-[10px] font-medium text-neutral-400">
                      {formatThreadTime(row.created_at)}
                    </span>
                  </div>
                  <div className="pl-7 text-[13px] leading-relaxed text-neutral-700 [overflow-wrap:anywhere]">
                    {renderBlockTextWithResolvedMentions(row.content, userMap)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-neutral-100 bg-white p-4">
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-[#FCFCFC] transition-all focus-within:border-neutral-900 focus-within:ring-1 focus-within:ring-neutral-900">
          <MentionTextarea
            value={text}
            onChange={setText}
            users={mentionUsers}
            disabled={sending || !threadRoot}
            rows={2}
            placeholder="답장을 입력하세요. @로 동료를 멘션할 수 있습니다."
            className="border-0 bg-transparent px-3 py-2.5 text-[13px] text-neutral-800 shadow-none focus-visible:ring-0"
          />
          <div className="flex items-center justify-between border-t border-neutral-100/60 bg-white px-3 py-2">
            <button
              type="button"
              className="p-1 text-neutral-400 transition-colors hover:text-neutral-900"
              title="첨부"
              disabled
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={sending || !text.trim()}
              onClick={() => void handleSendThread()}
              className="rounded-lg bg-indigo-600 px-4 py-1.5 text-[11px] font-bold text-white shadow-sm transition-all hover:bg-indigo-700 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
            >
              {sending ? '전송 중…' : '답장 보내기'}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
