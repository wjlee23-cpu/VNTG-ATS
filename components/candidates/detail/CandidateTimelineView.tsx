'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Paperclip,
  ThumbsUp,
  ThumbsDown,
  PauseCircle,
  MessageSquare,
  GitMerge,
  CalendarPlus,
  Mail,
  Archive,
  Pencil,
  Quote,
} from 'lucide-react';
import { TimelineEventContent, type TimelineEventChrome } from './TimelineEventContent';
import type { TimelineEvent } from '@/types/candidate-detail';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { createComment, updateComment, type ActivityCommentThreadRoot } from '@/api/actions/comments';
import {
  getActivityThreadSummariesForCandidate,
  type ActivityThreadSummary,
} from '@/api/queries/activity-threads';
import { MentionTextarea, buildMentionUserMap, type MentionableUser } from './MentionTextarea';
import { createStageEvaluation, updateStageEvaluation } from '@/api/actions/evaluations';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { STAGE_ID_TO_NAME_MAP } from '@/constants/stages';
import { normalizeStageEvalResult } from './timeline-utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { createQuotedActivityTimelineEntry } from '@/api/actions/activity-quotes';

/** 타임라인에서 평가 수정 시 매칭용 (getStageEvaluations 결과) */
export type StageEvaluationRow = {
  id: string;
  result: 'pass' | 'fail' | 'pending';
  notes?: string | null;
  stage_id: string;
  evaluator_id: string;
};

interface CandidateTimelineViewProps {
  candidateName: string;
  events: TimelineEvent[];
  isLoading?: boolean;
  hasLoaded?: boolean;
  expandedEmails: Set<string>;
  onToggleEmailExpand: (eventId: string) => void;
  candidateId: string;
  currentStageId: string | null;
  canManageCandidate: boolean;
  onAddComment: () => void;
  onRefreshTimeline?: () => void | Promise<void>;
  onSwitchToTimeline?: () => void;
  currentUserId?: string | null;
  stageEvaluations?: StageEvaluationRow[];
  /** @멘션 자동완성용 조직 전체 사용자 */
  mentionUsers?: MentionableUser[];
  /** 상위(모달 밖 포털)에서 스레드 패널을 열 때 전달 — 없으면 스레드 열기 비활성 */
  onActivityThreadOpen?: (session: ActivityThreadSession) => void;
}

/** 스레드 패널에 넘길 루트 + 미리보기 이벤트 */
export type ActivityThreadSession = {
  root: ActivityCommentThreadRoot;
  preview: TimelineEvent;
};

function timelineEmailIdFromEvent(event: TimelineEvent): string | null {
  const raw = event.content?.email_id;
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
}

function buildActivityThreadRoot(event: TimelineEvent): ActivityCommentThreadRoot | null {
  if (event.id.startsWith('email-')) {
    const eid = timelineEmailIdFromEvent(event);
    if (!eid) return null;
    return { kind: 'email', id: eid };
  }
  return { kind: 'timeline_event', id: event.id };
}

type ComposerTab = 'memo' | 'evaluation';

type InlineEditState =
  | { kind: 'comment'; eventId: string; commentId: string; text: string }
  | {
      kind: 'evaluation';
      eventId: string;
      evaluationId: string;
      stageId: string;
      result: 'pass' | 'fail' | 'pending';
      notes: string;
    };

function rowEvalResult(r: string | undefined | null): 'pass' | 'fail' | 'pending' {
  const u = (r ?? '').toLowerCase();
  if (u === 'pass') return 'pass';
  if (u === 'fail') return 'fail';
  return 'pending';
}

const timelineNodeBase =
  'absolute -left-[13px] top-0 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center shadow-sm';

function isEditedTimelineEvent(event: TimelineEvent): boolean {
  const c: any = event.content;
  if (!c) return false;
  if (c.edited === true) return true;
  if (typeof c.edited_at === 'string' && c.edited_at.trim()) return true;
  return false;
}

function getTimelineNodeVisual(event: TimelineEvent): {
  wrapClass: string;
  Icon: LucideIcon;
  iconClass: string;
} {
  const type = event.type;
  switch (type) {
    case 'stage_evaluation': {
      const r = normalizeStageEvalResult(event.content?.result);
      if (r === 'fail') {
        return {
          wrapClass: `${timelineNodeBase} bg-red-100`,
          Icon: ThumbsDown,
          iconClass: 'w-3 h-3 text-red-600',
        };
      }
      if (r === 'pending') {
        return {
          wrapClass: `${timelineNodeBase} bg-amber-100`,
          Icon: PauseCircle,
          iconClass: 'w-3 h-3 text-amber-700',
        };
      }
      return {
        wrapClass: `${timelineNodeBase} bg-emerald-100`,
        Icon: ThumbsUp,
        iconClass: 'w-3 h-3 text-emerald-600',
      };
    }
    case 'comment':
    case 'comment_created':
    case 'comment_updated':
      return {
        wrapClass: `${timelineNodeBase} bg-neutral-200`,
        Icon: MessageSquare,
        iconClass: 'w-3 h-3 text-neutral-600',
      };
    case 'activity_quote':
      return {
        wrapClass: `${timelineNodeBase} bg-indigo-100`,
        Icon: Quote,
        iconClass: 'w-3 h-3 text-indigo-600',
      };
    case 'stage_changed':
      return {
        wrapClass: `${timelineNodeBase} bg-indigo-100`,
        Icon: GitMerge,
        iconClass: 'w-3 h-3 text-indigo-600',
      };
    case 'schedule_created':
    case 'schedule_confirmed':
    case 'schedule_deleted':
    case 'schedule_regenerated':
      return {
        wrapClass: `${timelineNodeBase} bg-purple-100`,
        Icon: CalendarPlus,
        iconClass: 'w-3 h-3 text-purple-600',
      };
    case 'email':
    case 'email_received':
      return {
        wrapClass: `${timelineNodeBase} bg-blue-100`,
        Icon: Mail,
        iconClass: 'w-3 h-3 text-blue-600',
      };
    case 'archive':
      return {
        wrapClass: `${timelineNodeBase} bg-neutral-200`,
        Icon: Archive,
        iconClass: 'w-3 h-3 text-neutral-600',
      };
    default:
      return {
        wrapClass: `${timelineNodeBase} bg-neutral-200`,
        Icon: MessageSquare,
        iconClass: 'w-3 h-3 text-neutral-600',
      };
  }
}

/** 후보자 액티비티 타임라인 뷰 — 타임라인 V3(HTML) 레이아웃 */
export function CandidateTimelineView({
  candidateName,
  events,
  isLoading = false,
  hasLoaded = true,
  expandedEmails,
  onToggleEmailExpand,
  candidateId,
  currentStageId,
  canManageCandidate,
  onAddComment: _onAddComment,
  onRefreshTimeline,
  onSwitchToTimeline,
  currentUserId = null,
  stageEvaluations = [],
  mentionUsers = [],
  onActivityThreadOpen,
}: CandidateTimelineViewProps) {
  const router = useRouter();
  const [composerTab, setComposerTab] = useState<ComposerTab>('memo');
  const [commentText, setCommentText] = useState('');
  const [evalNotes, setEvalNotes] = useState('');
  const [evalResult, setEvalResult] = useState<'pass' | 'pending' | 'fail'>('pending');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inlineEdit, setInlineEdit] = useState<InlineEditState | null>(null);
  const [inlineSaving, setInlineSaving] = useState(false);
  const currentUserInitial = '나';

  const mentionUserMap = useMemo(() => buildMentionUserMap(mentionUsers), [mentionUsers]);
  const [threadSummaries, setThreadSummaries] = useState<{
    byTimelineEventId: Record<string, ActivityThreadSummary>;
    byEmailId: Record<string, ActivityThreadSummary>;
  }>({ byTimelineEventId: {}, byEmailId: {} });
  /** 스레드 없이 UI만: 이벤트별 이모지 반응 카운트(로컬) */
  const [reactionMap, setReactionMap] = useState<Record<string, Record<string, number>>>({});
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quoteText, setQuoteText] = useState('');
  const [quoteTargetEvent, setQuoteTargetEvent] = useState<TimelineEvent | null>(null);
  const [quoting, setQuoting] = useState(false);

  const refreshThreadSummaries = useCallback(async () => {
    const res = await getActivityThreadSummariesForCandidate(candidateId);
    if (res.error) return;
    if (res.data) setThreadSummaries(res.data);
  }, [candidateId]);

  useEffect(() => {
    if (!hasLoaded || !candidateId) return;
    void refreshThreadSummaries();
  }, [hasLoaded, candidateId, events, refreshThreadSummaries]);

  const getAuthorDisplay = (event: TimelineEvent) => {
    const u = event.created_by_user;
    if (u) {
      const authorName = u.name?.trim();
      const authorEmail = u.email?.trim();
      const displayName = authorName || authorEmail?.split('@')[0] || '사용자';
      const fallback = displayName.slice(0, 1).toUpperCase();
      return {
        displayName,
        fallback,
        avatarUrl: u.avatar_url,
        hasUser: true as const,
      };
    }
    return {
      displayName: '자동',
      fallback: '?',
      avatarUrl: undefined as string | undefined,
      hasUser: false as const,
    };
  };

  const eventTypeBadgeClass =
    'text-[11px] font-bold text-neutral-400 uppercase tracking-wider bg-neutral-100 px-1.5 py-0.5 rounded';

  const getEventBadgeText = (event: TimelineEvent) => {
    switch (event.type) {
      case 'stage_evaluation':
        return '평가';
      case 'comment':
      case 'comment_created':
      case 'comment_updated':
        return '메모';
      case 'activity_quote':
        return '인용';
      case 'stage_changed':
        return '전형 이동';
      case 'schedule_created':
      case 'schedule_confirmed':
      case 'schedule_deleted':
      case 'schedule_regenerated':
        return '일정';
      case 'email':
      case 'email_received':
        return '이메일';
      case 'archive':
        return '아카이브';
      default:
        return '이벤트';
    }
  };

  const formatTimeForDisplay = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / 86400000);

    const timeStr = date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    const trimmedTime = timeStr.replace(/\s*(AM|PM)\s*/i, '').trim();
    const hasKoreanPeriod = /(오전|오후)/.test(trimmedTime);

    if (diffDays === 0) {
      if (hasKoreanPeriod) return `오늘, ${trimmedTime}`;
      const period = date.getHours() < 12 ? '오전' : '오후';
      return `오늘, ${period} ${trimmedTime}`;
    }
    if (diffDays === 1) {
      if (hasKoreanPeriod) return `어제, ${trimmedTime}`;
      const period = date.getHours() < 12 ? '오전' : '오후';
      return `어제, ${period} ${trimmedTime}`;
    }
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });
  };

  const refreshAfterMutation = async () => {
    if (onSwitchToTimeline) onSwitchToTimeline();
    if (onRefreshTimeline) await onRefreshTimeline();
    else router.refresh();
    await refreshThreadSummaries();
  };

  const threadSummaryFor = (event: TimelineEvent): ActivityThreadSummary | null => {
    if (event.id.startsWith('email-')) {
      const eid = timelineEmailIdFromEvent(event);
      if (!eid) return null;
      return threadSummaries.byEmailId[eid] ?? null;
    }
    return threadSummaries.byTimelineEventId[event.id] ?? null;
  };

  const openThreadSheet = (event: TimelineEvent) => {
    const root = buildActivityThreadRoot(event);
    if (!root) {
      toast.error('이 항목에는 답장을 달 수 없습니다.');
      return;
    }
    if (!onActivityThreadOpen) return;
    onActivityThreadOpen({ root, preview: event });
  };

  const getCommentBodyForEdit = (event: TimelineEvent) => {
    const c = event.content;
    return (
      (typeof c?.content === 'string' ? c.content : undefined) ??
      (typeof c?.new_content === 'string' ? c.new_content : undefined) ??
      (typeof c?.message === 'string' ? c.message : undefined) ??
      ''
    );
  };

  const getTimelineCommentId = (event: TimelineEvent): string | null => {
    const raw = event.content?.comment_id;
    return typeof raw === 'string' ? raw : null;
  };

  const canEditTimelineComment = (event: TimelineEvent) => {
    if (!currentUserId) return false;
    if (timelineActorId(event) !== currentUserId) return false;
    const id = getTimelineCommentId(event);
    return (
      !!id &&
      (event.type === 'comment' || event.type === 'comment_created' || event.type === 'comment_updated')
    );
  };

  const timelineActorId = (event: TimelineEvent): string | undefined =>
    event.created_by_user?.id ?? (typeof event.created_by === 'string' ? event.created_by : undefined);

  const resolveEvaluationForTimelineEvent = (event: TimelineEvent): StageEvaluationRow | null => {
    if (event.type !== 'stage_evaluation') return null;
    const evalId = event.content?.evaluation_id;
    if (typeof evalId === 'string') {
      const byId = stageEvaluations.find((e) => e.id === evalId);
      if (byId) return byId;
    }
    const sid = event.content?.stage_id as string | undefined;
    if (!sid) return null;
    const actorId = timelineActorId(event);
    if (actorId) {
      const matched = stageEvaluations.find((e) => e.stage_id === sid && e.evaluator_id === actorId);
      if (matched) return matched;
    }
    const sameStage = stageEvaluations.filter((e) => e.stage_id === sid);
    if (
      sameStage.length === 1 &&
      currentUserId &&
      sameStage[0].evaluator_id === currentUserId
    ) {
      return sameStage[0];
    }
    return null;
  };

  const canEditTimelineEvaluation = (event: TimelineEvent) => {
    if (!currentUserId) return false;
    const row = resolveEvaluationForTimelineEvent(event);
    return row?.evaluator_id === currentUserId;
  };

  const openInlineCommentEditor = (event: TimelineEvent) => {
    const id = getTimelineCommentId(event);
    if (!id) return;
    setInlineEdit({
      kind: 'comment',
      eventId: event.id,
      commentId: id,
      text: getCommentBodyForEdit(event),
    });
  };

  const openInlineEvaluationEditor = (event: TimelineEvent) => {
    const row = resolveEvaluationForTimelineEvent(event);
    if (!row) return;
    setInlineEdit({
      kind: 'evaluation',
      eventId: event.id,
      evaluationId: row.id,
      stageId: row.stage_id,
      result: rowEvalResult(row.result),
      notes: row.notes ?? '',
    });
  };

  const handleInlineCommentSave = async () => {
    if (inlineEdit?.kind !== 'comment') return;
    if (!inlineEdit.text.trim()) {
      toast.error('내용을 입력해주세요.');
      return;
    }
    setInlineSaving(true);
    try {
      const res = await updateComment(inlineEdit.commentId, inlineEdit.text.trim());
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success('메모가 수정되었습니다.');
        setInlineEdit(null);
        await refreshAfterMutation();
      }
    } catch {
      toast.error('수정 중 오류가 발생했습니다.');
    } finally {
      setInlineSaving(false);
    }
  };

  const handleInlineEvaluationSave = async () => {
    if (inlineEdit?.kind !== 'evaluation') return;
    setInlineSaving(true);
    try {
      const res = await updateStageEvaluation(
        inlineEdit.evaluationId,
        inlineEdit.result,
        inlineEdit.notes.trim() || undefined
      );
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success('평가가 수정되었습니다.');
        setInlineEdit(null);
        await refreshAfterMutation();
      }
    } catch {
      toast.error('평가 수정 중 오류가 발생했습니다.');
    } finally {
      setInlineSaving(false);
    }
  };

  const handleCommentSubmit = async () => {
    if (!commentText.trim()) {
      toast.error('코멘트 내용을 입력해주세요.');
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await createComment(
        candidateId,
        commentText.trim(),
        undefined,
        undefined,
        true
      );
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('코멘트가 저장되었습니다.');
        setCommentText('');
        await refreshAfterMutation();
      }
    } catch (error) {
      toast.error('코멘트 저장 중 오류가 발생했습니다.');
      console.error('Comment error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEvaluationSubmit = async () => {
    if (!currentStageId) {
      toast.error('전형 단계 정보가 없어 평가를 등록할 수 없습니다.');
      return;
    }
    if (!canManageCandidate) {
      toast.error('평가를 등록할 권한이 없습니다.');
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await createStageEvaluation(
        candidateId,
        currentStageId,
        evalResult,
        evalNotes.trim() || undefined
      );
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('평가가 저장되었습니다.');
        setEvalNotes('');
        setEvalResult('pending');
        await refreshAfterMutation();
      }
    } catch (error) {
      toast.error('평가 저장 중 오류가 발생했습니다.');
      console.error('Evaluation error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const evalSubmitDisabled = isSubmitting || !canManageCandidate || !currentStageId;

  const memoSendDisabled = isSubmitting || !commentText.trim();

  const getReactionPillsForEvent = (eventId: string) => {
    const m = reactionMap[eventId] ?? {};
    return [
      { emoji: '👍', count: m['👍'] ?? 0 },
      { emoji: '👀', count: m['👀'] ?? 0 },
    ];
  };

  const bumpReaction = (eventId: string, emoji: string) => {
    setReactionMap((prev) => ({
      ...prev,
      [eventId]: {
        ...(prev[eventId] ?? {}),
        [emoji]: ((prev[eventId] ?? {})[emoji] ?? 0) + 1,
      },
    }));
  };

  const buildTimelineChromeFor = (event: TimelineEvent): TimelineEventChrome | undefined => {
    const root = buildActivityThreadRoot(event);
    if (!root) return undefined;
    const s = threadSummaryFor(event);
    return {
      interaction: {
        onOpenThread: () => openThreadSheet(event),
        onEdit: canEditTimelineComment(event) ? () => openInlineCommentEditor(event) : undefined,
        onQuote: () => {
          setQuoteTargetEvent(event);
          setQuoteText('');
          setQuoteOpen(true);
        },
        onEmojiPicker: () => {
          toast.message('이모지', { description: '곧 지원할 예정입니다.' });
        },
        canEdit: canEditTimelineComment(event),
        threadDisabled: !onActivityThreadOpen,
      },
      reactions: getReactionPillsForEvent(event.id),
      onToggleReaction: (emoji: string) => bumpReaction(event.id, emoji),
      threadPreview:
        onActivityThreadOpen && s && s.count >= 1
          ? { count: s.count, onOpen: () => openThreadSheet(event) }
          : undefined,
    };
  };

  const handleQuoteSubmit = async () => {
    if (!quoteTargetEvent) return;
    const root = buildActivityThreadRoot(quoteTargetEvent);
    if (!root) {
      toast.error('인용할 수 없는 항목입니다.');
      return;
    }
    if (!quoteText.trim()) {
      toast.error('인용 코멘트를 입력해주세요.');
      return;
    }
    setQuoting(true);
    try {
      const res = await createQuotedActivityTimelineEntry(candidateId, quoteText.trim(), root);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success('타임라인에 인용이 등록되었습니다.');
        setQuoteOpen(false);
        setQuoteText('');
        setQuoteTargetEvent(null);
        await refreshAfterMutation();
      }
    } catch {
      toast.error('인용 저장 중 오류가 발생했습니다.');
    } finally {
      setQuoting(false);
    }
  };

  return (
    <>
      <div className="relative flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-x-auto overflow-y-hidden bg-white">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-8">
        <div className="mb-12 flex gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-neutral-900 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-inner">
            {currentUserInitial}
          </div>

          <div className="flex-1 min-w-0 bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden focus-within:border-neutral-900 focus-within:ring-1 focus-within:ring-neutral-900 transition-all">
            <div className="flex items-center border-b border-neutral-100 bg-[#FCFCFC] px-2 pt-2">
              <button
                type="button"
                onClick={() => setComposerTab('memo')}
                className={cn(
                  'px-4 py-2 text-xs transition-colors border-b-2 border-transparent',
                  composerTab === 'memo'
                    ? 'font-bold text-neutral-900 border-neutral-900'
                    : 'font-semibold text-neutral-400 hover:text-neutral-900'
                )}
              >
                메모 작성
              </button>
              <button
                type="button"
                onClick={() => setComposerTab('evaluation')}
                disabled={!canManageCandidate || !currentStageId}
                className={cn(
                  'px-4 py-2 text-xs transition-colors border-b-2 border-transparent',
                  composerTab === 'evaluation'
                    ? 'font-bold text-neutral-900 border-neutral-900'
                    : 'font-semibold text-neutral-400 hover:text-neutral-900',
                  (!canManageCandidate || !currentStageId) && 'opacity-50 cursor-not-allowed hover:text-neutral-400'
                )}
              >
                전형 평가
              </button>
            </div>

            <div className="p-4 bg-white space-y-3">
              {composerTab === 'memo' ? (
                <MentionTextarea
                  value={commentText}
                  onChange={setCommentText}
                  users={mentionUsers}
                  disabled={isSubmitting}
                  rows={3}
                  placeholder={`${candidateName}님에 대한 메모를 남겨주세요. @로 동료를 멘션할 수 있습니다.`}
                />
              ) : (
                <>
                  {!currentStageId || !canManageCandidate ? (
                    <p className="text-xs text-neutral-500">
                      현재 전형에서 평가를 남기려면 단계 정보와 권한이 필요합니다.
                    </p>
                  ) : null}
                  <div className="flex gap-2">
                    <label className="flex-1 cursor-pointer">
                      <input
                        type="radio"
                        name="eval_result"
                        className="sr-only"
                        checked={evalResult === 'pass'}
                        onChange={() => setEvalResult('pass')}
                      />
                      <div
                        className={cn(
                          'py-2.5 text-center text-xs font-medium rounded-lg border transition-colors',
                          evalResult === 'pass'
                            ? 'text-emerald-700 border-emerald-500 bg-emerald-50 font-bold'
                            : 'text-emerald-600 bg-white border-neutral-200 hover:bg-emerald-50'
                        )}
                      >
                        합격 (Pass)
                      </div>
                    </label>
                    <label className="flex-1 cursor-pointer">
                      <input
                        type="radio"
                        name="eval_result"
                        className="sr-only"
                        checked={evalResult === 'pending'}
                        onChange={() => setEvalResult('pending')}
                      />
                      <div
                        className={cn(
                          'py-2.5 text-center text-xs font-medium rounded-lg border transition-colors',
                          evalResult === 'pending'
                            ? 'text-neutral-800 border-neutral-500 bg-neutral-50 font-bold'
                            : 'text-neutral-600 bg-white border-neutral-200 hover:bg-neutral-50'
                        )}
                      >
                        보류 (Hold)
                      </div>
                    </label>
                    <label className="flex-1 cursor-pointer">
                      <input
                        type="radio"
                        name="eval_result"
                        className="sr-only"
                        checked={evalResult === 'fail'}
                        onChange={() => setEvalResult('fail')}
                      />
                      <div
                        className={cn(
                          'py-2.5 text-center text-xs font-medium rounded-lg border transition-colors',
                          evalResult === 'fail'
                            ? 'text-red-700 border-red-500 bg-red-50 font-bold'
                            : 'text-red-600 bg-white border-neutral-200 hover:bg-red-50'
                        )}
                      >
                        불합격 (Fail)
                      </div>
                    </label>
                  </div>
                  <textarea
                    value={evalNotes}
                    onChange={(e) => setEvalNotes(e.target.value)}
                    disabled={isSubmitting || !canManageCandidate || !currentStageId}
                    rows={3}
                    className="w-full bg-neutral-50/50 border border-neutral-200 rounded-lg px-3 py-2.5 text-sm text-neutral-800 outline-none resize-none placeholder:text-neutral-400 focus:bg-white focus:border-neutral-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="면접에서 파악한 장단점 및 종합적인 평가 의견을 작성해주세요."
                  />
                </>
              )}
            </div>

            <div className="px-4 py-2.5 flex items-center justify-end border-t border-neutral-100 bg-[#FCFCFC]">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="p-1.5 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-200/60 rounded transition-colors"
                  title="첨부"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                {composerTab === 'memo' ? (
                  <button
                    type="button"
                    onClick={handleCommentSubmit}
                    disabled={memoSendDisabled}
                    className="px-3 py-1.5 bg-neutral-900 text-white text-xs font-bold rounded-md hover:bg-neutral-800 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    title={isSubmitting ? '전송 중...' : '전송'}
                  >
                    {isSubmitting ? '전송 중…' : '전송'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleEvaluationSubmit}
                    disabled={evalSubmitDisabled}
                    className="px-4 py-1.5 bg-neutral-900 text-white text-xs font-bold rounded-md hover:bg-neutral-800 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    평가 등록
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-neutral-500">타임라인을 불러오는 중입니다...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-neutral-500">
              {hasLoaded ? '타임라인 이벤트가 없습니다.' : '타임라인을 불러올 준비 중입니다...'}
            </p>
          </div>
        ) : (
          <div className="relative border-l-2 border-neutral-100 ml-4 pb-8 space-y-10 min-w-0 max-w-full">
            {events.map((event) => {
              const node = getTimelineNodeVisual(event);
              const NodeIcon = node.Icon;
              const author = getAuthorDisplay(event);
              const showEvalEdit = canEditTimelineEvaluation(event);
              const showEditedLabel = isEditedTimelineEvent(event);

              return (
                <div key={event.id} className="group relative min-w-0 max-w-full pl-8">
                  <div className={node.wrapClass}>
                    <NodeIcon className={node.iconClass} />
                  </div>

                  <div className="flex justify-between items-center mb-1.5 gap-2 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <Avatar className="w-5 h-5 rounded-full border border-neutral-200 shrink-0">
                        {author.hasUser ? (
                          <AvatarImage src={author.avatarUrl} alt={author.displayName} />
                        ) : null}
                        <AvatarFallback className="text-[9px] font-semibold bg-neutral-100 text-neutral-600 rounded-full">
                          {author.fallback}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-semibold text-neutral-900 truncate">{author.displayName}</span>
                      <span className={eventTypeBadgeClass}>{getEventBadgeText(event)}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {showEvalEdit && (
                        <button
                          type="button"
                          onClick={() => openInlineEvaluationEditor(event)}
                          className="p-1 rounded-md text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
                          title="평가 수정"
                          aria-label="평가 수정"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <span className="text-[11px] text-neutral-400 whitespace-nowrap">
                        {showEditedLabel ? <span className="mr-1">(수정)</span> : null}
                        {formatTimeForDisplay(event.created_at)}
                      </span>
                    </div>
                  </div>

                  <div className="text-sm text-neutral-600 leading-relaxed w-full max-w-full min-w-0 mt-2">
                    {inlineEdit?.kind === 'comment' && inlineEdit.eventId === event.id ? (
                      <div className="w-full min-w-0 max-w-full space-y-3 rounded-xl rounded-tl-sm border border-neutral-300 bg-white p-3.5 shadow-sm">
                        <textarea
                          value={inlineEdit.text}
                          onChange={(e) =>
                            setInlineEdit((prev) =>
                              prev?.kind === 'comment' ? { ...prev, text: e.target.value } : prev
                            )
                          }
                          rows={5}
                          disabled={inlineSaving}
                          className="w-full min-h-[100px] rounded-lg border border-neutral-200 bg-neutral-50/50 px-3 py-2 text-sm text-neutral-800 outline-none focus:border-neutral-400 focus:bg-white disabled:opacity-60"
                        />
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setInlineEdit(null)}
                            disabled={inlineSaving}
                          >
                            취소
                          </Button>
                          <Button type="button" size="sm" onClick={() => void handleInlineCommentSave()} disabled={inlineSaving}>
                            {inlineSaving ? '저장 중…' : '저장'}
                          </Button>
                        </div>
                      </div>
                    ) : inlineEdit?.kind === 'evaluation' && inlineEdit.eventId === event.id ? (
                      <div
                        className={cn(
                          'w-full min-w-0 max-w-full space-y-3 rounded-xl rounded-tl-sm border p-4 shadow-sm',
                          inlineEdit.result === 'pass' && 'border-emerald-200 bg-emerald-50/60',
                          inlineEdit.result === 'fail' && 'border-red-200 bg-red-50/60',
                          inlineEdit.result === 'pending' && 'border-amber-200 bg-amber-50/50'
                        )}
                      >
                        <p className="text-xs font-semibold text-neutral-600">평가 결과</p>
                        <div className="flex gap-2">
                          {(['pass', 'pending', 'fail'] as const).map((r) => {
                            const selected = inlineEdit.result === r;
                            return (
                              <button
                                key={r}
                                type="button"
                                disabled={inlineSaving}
                                onClick={() =>
                                  setInlineEdit((prev) =>
                                    prev?.kind === 'evaluation' ? { ...prev, result: r } : prev
                                  )
                                }
                                className={cn(
                                  'flex-1 rounded-lg border py-2 text-xs font-medium transition-colors',
                                  selected &&
                                    r === 'pass' &&
                                    'border-emerald-500 bg-emerald-100 text-emerald-900 font-semibold',
                                  selected &&
                                    r === 'fail' &&
                                    'border-red-500 bg-red-100 text-red-900 font-semibold',
                                  selected &&
                                    r === 'pending' &&
                                    'border-amber-500 bg-amber-100 text-amber-900 font-semibold',
                                  !selected && 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
                                )}
                              >
                                {r === 'pass' ? '합격' : r === 'fail' ? '불합격' : '보류'}
                              </button>
                            );
                          })}
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-neutral-600">평가 노트</label>
                          <textarea
                            value={inlineEdit.notes}
                            onChange={(e) =>
                              setInlineEdit((prev) =>
                                prev?.kind === 'evaluation' ? { ...prev, notes: e.target.value } : prev
                              )
                            }
                            rows={4}
                            disabled={inlineSaving}
                            className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 outline-none focus:border-neutral-400 disabled:opacity-60"
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setInlineEdit(null)}
                            disabled={inlineSaving}
                          >
                            취소
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => void handleInlineEvaluationSave()}
                            disabled={inlineSaving}
                          >
                            {inlineSaving ? '저장 중…' : '저장'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <TimelineEventContent
                        event={event}
                        expandedEmails={expandedEmails}
                        onToggleEmailExpand={onToggleEmailExpand}
                        candidateId={candidateId}
                        mentionUserMap={mentionUserMap}
                        timelineChrome={buildTimelineChromeFor(event)}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
          </div>
        </div>
      </div>

      <Dialog
        open={quoteOpen}
        onOpenChange={(o) => {
          setQuoteOpen(o);
          if (!o) {
            setQuoteText('');
            setQuoteTargetEvent(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>인용하여 타임라인에 남기기</DialogTitle>
          </DialogHeader>
          <MentionTextarea
            value={quoteText}
            onChange={setQuoteText}
            users={mentionUsers}
            disabled={quoting}
            rows={4}
            placeholder="인용과 함께 올릴 메시지를 작성하세요."
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setQuoteOpen(false)} disabled={quoting}>
              취소
            </Button>
            <Button type="button" onClick={() => void handleQuoteSubmit()} disabled={quoting || !quoteText.trim()}>
              {quoting ? '저장 중…' : '타임라인에 등록'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
