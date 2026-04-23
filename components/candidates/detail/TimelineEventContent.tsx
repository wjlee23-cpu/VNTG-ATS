'use client';

import { Star, Calendar } from 'lucide-react';
import { STAGE_ID_TO_NAME_MAP } from '@/constants/stages';
import { normalizeStageEvalResult } from './timeline-utils';
import { formatEmailBodyForDisplay, isLongEmail } from '@/lib/candidate-detail-utils';
import { renderBlockTextWithMentions, renderTextWithMentionBadges } from '@/lib/render-mention-text';
import { cn } from '@/lib/utils';
import type { TimelineEvent } from '@/types/candidate-detail';

/** 타임라인 코멘트 본문 필드 우선순위 */
function getCommentTimelineBody(content: TimelineEvent['content'] | undefined): string {
  if (!content) return '코멘트가 작성되었습니다.';
  const raw =
    (typeof content.content === 'string' ? content.content : undefined) ??
    (typeof content.new_content === 'string' ? content.new_content : undefined) ??
    (typeof content.message === 'string' ? content.message : undefined);
  return raw?.trim() ? raw : '코멘트가 작성되었습니다.';
}

function getAutomationStatusLabel(status: string | undefined) {
  switch (status) {
    case 'pending_interviewers':
      return '면접관 응답 대기';
    case 'regenerated':
      return '재생성됨';
    case 'needs_rescheduling':
      return '재조율 필요';
    case 'pending_candidate':
      return '후보자 응답 대기';
    case 'confirmed':
      return '확정';
    case 'cancelled':
      return '취소됨';
    case 'deleted':
      return '삭제됨';
    default:
      return '진행중';
  }
}

function renderStars(rating: number) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn('w-4 h-4', star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-neutral-300')}
        />
      ))}
    </div>
  );
}

function stageChip(text: string, emphasized: boolean) {
  return (
    <span
      className={cn(
        'px-2.5 py-1 text-xs rounded-md border',
        emphasized
          ? 'font-bold text-neutral-900 bg-white shadow-sm border-neutral-200'
          : 'font-semibold text-neutral-500 bg-neutral-100 border-neutral-200/60'
      )}
    >
      {text}
    </span>
  );
}

function evaluationResultBadge(result: 'pass' | 'fail' | 'pending' | undefined) {
  const r = normalizeStageEvalResult(result) ?? 'pending';
  if (r === 'pass') {
    return (
      <span className="px-2 py-0.5 bg-emerald-500 text-white text-[10px] font-extrabold tracking-wider rounded uppercase">
        Pass
      </span>
    );
  }
  if (r === 'fail') {
    return (
      <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] font-extrabold tracking-wider rounded uppercase">
        Fail
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 bg-neutral-500 text-white text-[10px] font-extrabold tracking-wider rounded uppercase">
      Hold
    </span>
  );
}

interface TimelineEventContentProps {
  event: TimelineEvent;
  expandedEmails: Set<string>;
  onToggleEmailExpand: (eventId: string) => void;
  candidateId: string;
}

/** 타임라인 이벤트 타입별 본문 — V3 카드 레이아웃 */
export function TimelineEventContent({
  event,
  expandedEmails,
  onToggleEmailExpand,
  candidateId: _candidateId,
}: TimelineEventContentProps) {
  switch (event.type) {
    case 'scorecard': {
      const rating = event.content?.overall_rating ?? event.content?.rating;
      const body = event.content?.notes || event.content?.message || '평가가 작성되었습니다.';
      return (
        <div className="w-full min-w-0 space-y-2 rounded-xl border border-neutral-200 bg-white p-3.5 shadow-sm">
          <p className="text-sm leading-relaxed text-neutral-700">{renderBlockTextWithMentions(body)}</p>
          {rating != null && renderStars(rating)}
        </div>
      );
    }
    case 'email':
    case 'email_received': {
      const emailDirection =
        event.content?.direction ?? (event.type === 'email_received' ? 'inbound' : 'outbound');
      const emailBody = formatEmailBodyForDisplay(event.content?.body);
      const emailSubject = event.content?.subject || '제목 없음';
      const isLong = isLongEmail(event.content?.body);
      const isExpanded = expandedEmails.has(event.id);
      const emailBodyLines = emailBody.split('\n');
      const maxLines = 10;
      const displayLines = isLong && !isExpanded ? emailBodyLines.slice(0, maxLines) : emailBodyLines;
      const hasMoreLines = emailBodyLines.length > maxLines;
      const directionLabel = emailDirection === 'outbound' ? '발송' : '수신';

      return (
        <div className="w-full max-w-full min-w-0 rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
          <div className="w-full min-w-0 max-w-full border-b border-neutral-100 bg-[#FCFCFC] px-4 py-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="shrink-0 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700 border border-blue-100">
                {directionLabel}
              </span>
              <h4 className="min-w-0 flex-1 break-words [overflow-wrap:anywhere] text-sm font-bold leading-snug text-neutral-900">
                {emailSubject}
              </h4>
            </div>
            {(event.content?.from_email || event.content?.to_email) && (
              <p className="mt-2 break-all text-xs text-neutral-500">
                {emailDirection === 'outbound'
                  ? `To: ${event.content?.to_email ?? ''}`
                  : `From: ${event.content?.from_email ?? ''}`}
              </p>
            )}
          </div>
          {emailBody ? (
            <div className="min-w-0 max-w-full overflow-x-auto bg-white p-4 text-sm leading-relaxed text-neutral-600">
              <div className="min-w-0 max-w-full space-y-1.5">
                {displayLines.map((line, index) => {
                  const trimmed = line.trim();
                  const isEmpty = trimmed === '';
                  const isQuote = trimmed.startsWith('>');
                  if (isEmpty) return <div key={index} className="h-2" />;
                  if (isQuote) {
                    const quoteLevel = trimmed.match(/^>+/)?.[0].length ?? 1;
                    const quoteText = trimmed.substring(quoteLevel).trim();
                    return (
                      <div
                        key={index}
                        className={cn(
                          'pl-4 border-l-2 border-neutral-300 text-neutral-500 italic text-sm',
                          quoteLevel > 1 && 'ml-2'
                        )}
                      >
                        {quoteText || '\u00A0'}
                      </div>
                    );
                  }
                  return (
                    <div key={index} className="min-w-0 break-words">
                      {renderTextWithMentionBadges(trimmed)}
                    </div>
                  );
                })}
                {hasMoreLines && !isExpanded && (
                  <div className="pt-2 text-xs text-neutral-400 italic">
                    ... {emailBodyLines.length - maxLines}줄 더 있음
                  </div>
                )}
              </div>
              {isLong && (
                <button
                  type="button"
                  onClick={() => onToggleEmailExpand(event.id)}
                  className="mt-3 text-xs text-indigo-600 hover:text-indigo-500 font-medium transition-colors underline-offset-2 hover:underline"
                >
                  {isExpanded ? '접기' : '전체 내용 보기'}
                </button>
              )}
            </div>
          ) : null}
        </div>
      );
    }
    case 'comment':
      return (
        <div className="w-full min-w-0 rounded-xl rounded-tl-sm border border-neutral-200 bg-[#FCFCFC] p-3.5">
          <p className="text-sm leading-relaxed text-neutral-700">
            {renderBlockTextWithMentions(getCommentTimelineBody(event.content))}
          </p>
        </div>
      );
    case 'stage_changed': {
      const from = event.content?.from_stage?.trim();
      const to = event.content?.to_stage?.trim();
      const msg = event.content?.message?.trim();
      const stageId = event.content?.stage_id as string | undefined;
      const stageHint =
        stageId && !from && !to
          ? STAGE_ID_TO_NAME_MAP[stageId] || stageId
          : null;
      const prevStatus = event.content?.previous_status as string | undefined;
      const newStatus = event.content?.new_status as string | undefined;

      if (from && to) {
        return (
          <div className="mt-0 flex w-full min-w-0 max-w-full flex-wrap items-center gap-x-2 gap-y-2 pb-0.5 sm:gap-x-3">
            <span className="shrink-0 max-w-full">{stageChip(from, false)}</span>
            <span className="shrink-0 text-sm font-medium text-neutral-400" aria-hidden>
              →
            </span>
            <span className="shrink-0 max-w-full">{stageChip(to, true)}</span>
          </div>
        );
      }
      if (from || to) {
        return (
          <div className="mt-0 w-full min-w-0 max-w-full space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {from ? <span className="shrink-0 max-w-full">{stageChip(from, false)}</span> : null}
              {to ? <span className="shrink-0 max-w-full">{stageChip(to, true)}</span> : null}
            </div>
            {msg ? <p className="text-xs text-neutral-600 leading-relaxed [overflow-wrap:anywhere]">{msg}</p> : null}
          </div>
        );
      }

      return (
        <div className="mt-0 w-full min-w-0 max-w-full space-y-2 rounded-xl border border-neutral-200 bg-[#FCFCFC] p-3.5 text-sm text-neutral-700">
          {msg ? <p className="leading-relaxed [overflow-wrap:anywhere]">{msg}</p> : null}
          {stageHint ? (
            <p className="text-xs text-neutral-500">
              관련 전형: <span className="font-semibold text-neutral-800">{stageHint}</span>
            </p>
          ) : null}
          {prevStatus || newStatus ? (
            <p className="text-xs text-neutral-500">
              {prevStatus ? <span>이전 상태: {prevStatus}</span> : null}
              {prevStatus && newStatus ? ' → ' : null}
              {newStatus ? <span>변경: {newStatus}</span> : null}
            </p>
          ) : null}
        </div>
      );
    }
    case 'archive': {
      const reason = event.content?.archive_reason?.trim();
      const message = event.content?.message?.trim();
      if (message) {
        return (
          <div className="mt-0 text-sm text-neutral-600 leading-relaxed">
            {renderBlockTextWithMentions(message)}
          </div>
        );
      }
      return (
        <div className="mt-0 flex items-center gap-2 text-sm text-neutral-600 flex-wrap">
          <span>후보자를</span>
          {reason ? <span className="font-semibold text-neutral-900">{reason}</span> : null}
          <span>사유로 아카이브했습니다.</span>
        </div>
      );
    }
    case 'stage_evaluation': {
      const stageName = event.content?.stage_id
        ? STAGE_ID_TO_NAME_MAP[event.content.stage_id as string] ||
          event.content?.stage_name ||
          '전형 평가'
        : event.content?.stage_name || '전형 평가';
      const result = normalizeStageEvalResult(event.content?.result);
      const notes =
        event.content?.notes ||
        (typeof event.content?.reason === 'string' ? event.content.reason : undefined) ||
        event.content?.message ||
        '평가가 완료되었습니다.';
      const tone =
        result === 'pass'
          ? 'border-emerald-200 bg-emerald-50/60'
          : result === 'fail'
            ? 'border-red-200 bg-red-50/60'
            : 'border-amber-200 bg-amber-50/50';
      return (
        <div className={cn('w-full min-w-0 max-w-full space-y-2 rounded-xl rounded-tl-sm border p-4', tone)}>
          <div className="flex items-center gap-2 flex-wrap">
            {evaluationResultBadge(result)}
            <span className="text-[11px] font-semibold text-neutral-500">{stageName}</span>
          </div>
          <p className="text-sm text-neutral-800 leading-relaxed [overflow-wrap:anywhere]">
            {renderBlockTextWithMentions(notes)}
          </p>
          {event.content?.rating != null && <div className="pt-1">{renderStars(event.content.rating)}</div>}
        </div>
      );
    }
    case 'schedule_created':
    case 'schedule_regenerated':
    case 'schedule_confirmed':
    case 'schedule_deleted': {
      const scheduleOptions = event.content?.schedule_options as
        | Array<{ id: string; scheduled_at: string }>
        | undefined;
      const retryCount = event.content?.retry_count as number | undefined;
      const originalDateRange = event.content?.original_date_range as
        | { start: string; end: string }
        | undefined;
      const automationStatus = event.content?.automation_status as string | undefined;
      const latestMessage =
        (event.content?.latest_message as string | undefined) ||
        (event.content?.message as string | undefined) ||
        '면접 일정이 업데이트되었습니다.';
      const interviewerSummary = event.content?.interviewer_summary as
        | { accepted: number; declined: number; pending: number; total: number }
        | undefined;
      const user = event.created_by_user as { name?: string; email?: string } | null;
      const authorName = user?.name || user?.email?.split('@')[0] || '';
      const statusMeta = getAutomationStatusLabel(automationStatus);

      return (
        <div className="w-full min-w-0 space-y-3 rounded-xl border border-neutral-200 bg-white p-3.5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-neutral-900">
                {latestMessage}
                {authorName ? <span className="text-neutral-400 font-normal ml-1">· {authorName}</span> : null}
              </p>
              {interviewerSummary ? (
                <p className="mt-1 text-xs text-neutral-500">
                  면접관 응답 요약: 수락 {interviewerSummary.accepted} / 거절 {interviewerSummary.declined} / 대기{' '}
                  {interviewerSummary.pending} (총 {interviewerSummary.total})
                </p>
              ) : null}
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 bg-neutral-100 px-2 py-1 rounded-md border border-neutral-200/80 shrink-0">
              {statusMeta}
            </span>
          </div>

          {scheduleOptions && scheduleOptions.length > 0 ? (
            <div className="space-y-1.5">
              {scheduleOptions.map((option, index) => {
                const date = new Date(option.scheduled_at);
                const formattedDate = date.toLocaleDateString('ko-KR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  weekday: 'short',
                });
                const formattedTime = date.toLocaleTimeString('ko-KR', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true,
                });
                return (
                  <div
                    key={option.id || index}
                    className="flex items-center gap-2 px-3 py-2 bg-[#FCFCFC] rounded-md border border-neutral-100 text-xs font-medium text-neutral-600"
                  >
                    <Calendar className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                    {formattedDate} {formattedTime}
                  </div>
                );
              })}
            </div>
          ) : null}

          {retryCount !== undefined && retryCount > 0 ? (
            <div className="p-3 bg-amber-50/50 rounded-lg border border-amber-200/60">
              <p className="text-xs text-neutral-800">
                <span className="font-medium">날짜 범위 확장:</span> 원본 날짜 범위에 일정이 없어 {retryCount}회
                날짜 범위를 확장하여 검색했습니다.
              </p>
              {originalDateRange ? (
                <p className="text-xs text-neutral-500 mt-1">
                  원본 날짜 범위: {new Date(originalDateRange.start).toLocaleDateString('ko-KR')} ~{' '}
                  {new Date(originalDateRange.end).toLocaleDateString('ko-KR')}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      );
    }
    case 'interviewer_response': {
      const response = event.content?.response as string | undefined;
      const interviewerEmail = event.content?.interviewer_email as string | undefined;
      const optionScheduledAt = event.content?.option_scheduled_at as string | undefined;
      const allAccepted = event.content?.all_accepted as boolean | undefined;
      return (
        <div className="w-full min-w-0 space-y-2 rounded-xl border border-neutral-200 bg-white p-3.5 shadow-sm">
          <p className="text-sm text-neutral-700">
            {event.content?.message || '면접관이 일정에 응답했습니다.'}
          </p>
          {allAccepted ? (
            <div className="p-3 bg-emerald-50/40 rounded-lg border border-emerald-100">
              <p className="text-xs font-medium text-neutral-900">모든 면접관이 수락했습니다.</p>
              {optionScheduledAt ? (
                <p className="text-xs text-neutral-500 mt-1">
                  일정: {new Date(optionScheduledAt).toLocaleString('ko-KR')}
                </p>
              ) : null}
            </div>
          ) : interviewerEmail && response ? (
            <div className="p-3 bg-[#FCFCFC] rounded-lg border border-neutral-200">
              <p className="text-xs text-neutral-800">
                <span className="font-semibold">{interviewerEmail}</span>님이{' '}
                <span
                  className={cn(
                    'text-[10px] font-bold uppercase px-1.5 py-0.5 rounded',
                    response === 'accepted' && 'bg-emerald-100 text-emerald-800',
                    response === 'declined' && 'bg-red-100 text-red-800',
                    response !== 'accepted' &&
                      response !== 'declined' &&
                      'bg-neutral-100 text-neutral-600'
                  )}
                >
                  {response === 'accepted' ? '수락' : response === 'declined' ? '거절' : '보류'}
                </span>{' '}
                했습니다.
              </p>
              {optionScheduledAt ? (
                <p className="text-xs text-neutral-500 mt-1">
                  일정: {new Date(optionScheduledAt).toLocaleString('ko-KR')}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      );
    }
    case 'position_changed': {
      const previousJobTitle = event.content?.previous_job_post_title as string | undefined;
      const newJobTitle = event.content?.new_job_post_title as string | undefined;
      return (
        <div className="w-full min-w-0 space-y-2 rounded-xl border border-neutral-200 bg-white p-3.5 shadow-sm">
          <p className="text-sm text-neutral-700">
            {event.content?.message || '포지션이 변경되었습니다.'}
          </p>
          {previousJobTitle && newJobTitle ? (
            <div className="flex items-center gap-2 text-xs flex-wrap">
              {stageChip(previousJobTitle, false)}
              <span className="text-neutral-400 font-medium" aria-hidden>
                →
              </span>
              {stageChip(newJobTitle, true)}
            </div>
          ) : null}
        </div>
      );
    }
    case 'comment_created':
    case 'comment_updated':
      return (
        <div className="w-full min-w-0 max-w-full space-y-2 rounded-xl rounded-tl-sm border border-neutral-200 bg-[#FCFCFC] p-3.5">
          <p className="text-sm text-neutral-700 leading-relaxed [overflow-wrap:anywhere]">
            {renderBlockTextWithMentions(getCommentTimelineBody(event.content))}
          </p>
          {event.content?.previous_content ? (
            <div className="mt-2 p-2 bg-white rounded-lg border border-neutral-200">
              <p className="text-xs text-neutral-500 mb-1">이전 내용:</p>
              <p className="text-xs text-neutral-400 line-through">
                {renderBlockTextWithMentions(event.content.previous_content)}
              </p>
            </div>
          ) : null}
        </div>
      );
    case 'scorecard_created': {
      const scorecardRating = event.content?.overall_rating ?? event.content?.rating;
      return (
        <div className="w-full min-w-0 space-y-2 rounded-xl border border-neutral-200 bg-white p-3.5 shadow-sm">
          <p className="text-sm text-neutral-700">
            {event.content?.message || '면접 평가표가 작성되었습니다.'}
          </p>
          {scorecardRating != null ? (
            <div>
              {renderStars(scorecardRating)}
              {event.content?.previous_rating != null ? (
                <div className="mt-2 text-xs text-neutral-500">
                  이전 평가: {renderStars(event.content.previous_rating)}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      );
    }
    default:
      return (
        <div className="w-full min-w-0 rounded-xl border border-neutral-200 bg-white p-3.5 shadow-sm">
          <p className="text-sm text-neutral-700">{event.content?.message || event.type}</p>
        </div>
      );
  }
}
