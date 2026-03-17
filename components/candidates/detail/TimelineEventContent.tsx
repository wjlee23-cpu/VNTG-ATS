'use client';

import {
  Star,
  ArrowRight,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowUp,
  ArrowDown,
  Settings,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { STAGE_ID_TO_NAME_MAP } from '@/constants/stages';
import { formatEmailBodyForDisplay, isLongEmail } from '@/lib/candidate-detail-utils';
import type { TimelineEvent } from '@/types/candidate-detail';
import { useRouter } from 'next/navigation';

function renderStars(rating: number) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-4 h-4 ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
        />
      ))}
    </div>
  );
}

interface TimelineEventContentProps {
  event: TimelineEvent;
  expandedEmails: Set<string>;
  onToggleEmailExpand: (eventId: string) => void;
  candidateId: string;
  // 일정 관련 액션 콜백 (타임라인 헤더에서 내려옴)
  onCancelSchedule?: (scheduleId: string) => void;
  onDeleteSchedule?: (scheduleId: string) => void;
  onRescheduleSchedule?: (scheduleId: string) => void;
}

/** 타임라인 이벤트 타입별 본문 렌더링 */
export function TimelineEventContent({
  event,
  expandedEmails,
  onToggleEmailExpand,
  candidateId,
  onCancelSchedule,
  onDeleteSchedule,
  onRescheduleSchedule,
}: TimelineEventContentProps) {
  const router = useRouter();

  switch (event.type) {
    case 'scorecard': {
      const rating = event.content?.overall_rating ?? event.content?.rating;
      return (
        <div className="space-y-3">
          <p className="text-sm text-foreground">
            {event.content?.notes || event.content?.message || '평가가 작성되었습니다.'}
          </p>
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
      return (
        <div className="space-y-3">
          <div className="flex items-start gap-3 pb-3 border-b border-border/50">
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-foreground break-words mb-1">{emailSubject}</h4>
              <div className="flex items-center gap-2 mt-1.5">
                <Badge
                  variant={emailDirection === 'outbound' ? 'default' : 'secondary'}
                  className="text-xs flex items-center gap-1"
                >
                  {emailDirection === 'outbound' ? (
                    <ArrowUpRight className="w-3 h-3" />
                  ) : (
                    <ArrowDownLeft className="w-3 h-3" />
                  )}
                  {emailDirection === 'outbound' ? '발신' : '수신'}
                </Badge>
                {(event.content?.from_email || event.content?.to_email) && (
                  <span className="text-xs text-muted-foreground">
                    {emailDirection === 'outbound'
                      ? `To: ${event.content?.to_email ?? ''}`
                      : `From: ${event.content?.from_email ?? ''}`}
                  </span>
                )}
              </div>
            </div>
          </div>
          {emailBody && (
            <div className="p-4 bg-muted/30 rounded-lg border border-border/50">
              <div className="space-y-1.5 text-sm text-foreground leading-relaxed">
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
                        className={`pl-4 border-l-2 border-muted-foreground/30 text-muted-foreground italic ${quoteLevel > 1 ? 'ml-2' : ''}`}
                      >
                        {quoteText || '\u00A0'}
                      </div>
                    );
                  }
                  return (
                    <div key={index} className="break-words">
                      {trimmed}
                    </div>
                  );
                })}
                {hasMoreLines && !isExpanded && (
                  <div className="pt-2 text-xs text-muted-foreground italic">
                    ... {emailBodyLines.length - maxLines}줄 더 있음
                  </div>
                )}
              </div>
              {isLong && (
                <button
                  onClick={() => onToggleEmailExpand(event.id)}
                  className="mt-3 text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1.5 transition-colors duration-200"
                >
                  {isExpanded ? (
                    <>
                      <ArrowUp className="w-3.5 h-3.5" />
                      접기
                    </>
                  ) : (
                    <>
                      <ArrowDown className="w-3.5 h-3.5" />
                      전체 내용 보기
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      );
    }
    case 'comment':
      return (
        <div className="p-3 bg-primary/5 rounded-lg border border-primary/10">
          <p className="text-sm text-foreground">
            {event.content?.content || event.content?.message || '코멘트가 작성되었습니다.'}
          </p>
        </div>
      );
    case 'stage_changed':
      return (
        <div className="space-y-3">
          <p className="text-sm text-foreground">
            {event.content?.from_stage || '이전 단계'} →{' '}
            {event.content?.to_stage || event.content?.message || '다음 단계'}
          </p>
          {(event.content?.from_stage || event.content?.to_stage) && (
            <div className="flex items-center gap-2 flex-wrap">
              {event.content?.from_stage && (
                <Badge variant="outline" className="text-xs">
                  {event.content.from_stage}
                </Badge>
              )}
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
              {event.content?.to_stage && (
                <Badge variant="default" className="text-xs">
                  {event.content.to_stage}
                </Badge>
              )}
            </div>
          )}
        </div>
      );
    case 'archive':
      return (
        <div className="space-y-2">
          <p className="text-sm text-foreground">
            {event.content?.message || '후보자가 아카이브되었습니다.'}
          </p>
          {event.content?.archive_reason && (
            <p className="text-xs text-muted-foreground">사유: {event.content.archive_reason}</p>
          )}
        </div>
      );
    case 'stage_evaluation': {
      const stageName = event.content?.stage_id
        ? (STAGE_ID_TO_NAME_MAP[event.content.stage_id] || event.content?.stage_name || '전형 평가')
        : (event.content?.stage_name || '전형 평가');
      return (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-foreground">{stageName} 평가</p>
          <p className="text-sm text-foreground">
            {event.content?.notes || event.content?.message || '평가가 완료되었습니다.'}
          </p>
          {event.content?.result && (
            <Badge
              variant={
                event.content.result === 'pass'
                  ? 'default'
                  : event.content.result === 'fail'
                    ? 'destructive'
                    : 'secondary'
              }
              className="text-xs"
            >
              {event.content.result === 'pass' ? '합격' : event.content.result === 'fail' ? '불합격' : '대기중'}
            </Badge>
          )}
          {event.content?.rating != null && renderStars(event.content.rating)}
        </div>
      );
    }
    case 'schedule_created':
    case 'schedule_regenerated': {
      const scheduleOptions = event.content?.schedule_options as
        | Array<{ id: string; scheduled_at: string }>
        | undefined;
      const retryCount = event.content?.retry_count as number | undefined;
      const originalDateRange = event.content?.original_date_range as
        | { start: string; end: string }
        | undefined;
      const scheduleId = (event.content?.schedule_id as string | undefined) || event.id;
      return (
        <div className="space-y-3">
          <p className="text-sm text-gray-700">
            {event.content?.message || '면접 일정 자동화가 시작되었습니다.'}
          </p>
          {scheduleOptions && scheduleOptions.length > 0 && (
            <div className="mt-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
              <p className="text-xs font-medium text-foreground mb-2">
                생성된 일정 옵션 ({scheduleOptions.length}개):
              </p>
              <div className="space-y-2">
                {scheduleOptions.map((option, index) => {
                  const date = new Date(option.scheduled_at);
                  return (
                    <div
                      key={option.id || index}
                      className="text-xs text-foreground p-2 bg-card rounded border border-border"
                    >
                      <span className="font-medium">옵션 {index + 1}:</span>{' '}
                      {date.toLocaleDateString('ko-KR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        weekday: 'short',
                      })}{' '}
                      {date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {retryCount !== undefined && retryCount > 0 && (
            <div className="mt-2 p-3 bg-yellow-50/50 rounded-lg border border-yellow-200/50">
              <p className="text-xs text-foreground">
                <span className="font-medium">날짜 범위 확장:</span> 원본 날짜 범위에 일정이 없어{' '}
                {retryCount}회 날짜 범위를 확장하여 검색했습니다.
              </p>
              {originalDateRange && (
                <p className="text-xs text-muted-foreground mt-1">
                  원본 날짜 범위:{' '}
                  {new Date(originalDateRange.start).toLocaleDateString('ko-KR')} ~{' '}
                  {new Date(originalDateRange.end).toLocaleDateString('ko-KR')}
                </p>
              )}
            </div>
          )}
          {scheduleId && (onRescheduleSchedule || onCancelSchedule || onDeleteSchedule) && (
            <div className="mt-3 flex items-center justify-end gap-2 flex-nowrap">
              {onRescheduleSchedule && (
                <Button
                  onClick={() => onRescheduleSchedule(scheduleId)}
                  variant="outline"
                  size="sm"
                  className="border-blue-400/40 text-blue-600 hover:bg-blue-50 transition-colors duration-200 whitespace-nowrap flex-shrink-0"
                >
                  <Settings className="w-4 h-4 mr-1.5" />
                  재조율
                </Button>
              )}
              {onCancelSchedule && (
                <Button
                  onClick={() => onCancelSchedule(scheduleId)}
                  variant="outline"
                  size="sm"
                  className="border-rose-400/40 text-rose-600 hover:bg-rose-50 transition-colors duration-200 whitespace-nowrap flex-shrink-0"
                >
                  일정 취소
                </Button>
              )}
              {onDeleteSchedule && (
                <Button
                  onClick={() => onDeleteSchedule(scheduleId)}
                  variant="ghost"
                  size="sm"
                  className="text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors duration-200 whitespace-nowrap flex-shrink-0"
                >
                  완전 삭제
                </Button>
              )}
            </div>
          )}
        </div>
      );
    }
    case 'interviewer_response': {
      const response = event.content?.response as string | undefined;
      const interviewerEmail = event.content?.interviewer_email as string | undefined;
      const optionScheduledAt = event.content?.option_scheduled_at as string | undefined;
      const allAccepted = event.content?.all_accepted as boolean | undefined;
      return (
        <div className="space-y-2">
          <p className="text-sm text-gray-700">
            {event.content?.message || '면접관이 일정에 응답했습니다.'}
          </p>
          {allAccepted ? (
            <div className="mt-2 p-3 bg-green-50/50 rounded-lg border border-green-200/50">
              <p className="text-xs text-foreground font-medium">모든 면접관이 수락했습니다.</p>
              {optionScheduledAt && (
                <p className="text-xs text-muted-foreground mt-1">
                  일정: {new Date(optionScheduledAt).toLocaleString('ko-KR')}
                </p>
              )}
            </div>
          ) : (
            interviewerEmail &&
            response && (
              <div className="mt-2 p-3 bg-muted/50 rounded-lg border border-border">
                <p className="text-xs text-foreground">
                  <span className="font-medium">{interviewerEmail}</span>님이{' '}
                  <Badge
                    variant={
                      response === 'accepted' ? 'default' : response === 'declined' ? 'destructive' : 'secondary'
                    }
                    className="text-xs"
                  >
                    {response === 'accepted' ? '수락' : response === 'declined' ? '거절' : '보류'}
                  </Badge>
                  했습니다.
                </p>
                {optionScheduledAt && (
                  <p className="text-xs text-muted-foreground mt-1">
                    일정: {new Date(optionScheduledAt).toLocaleString('ko-KR')}
                  </p>
                )}
              </div>
            )
          )}
        </div>
      );
    }
    case 'position_changed': {
      const previousJobTitle = event.content?.previous_job_post_title as string | undefined;
      const newJobTitle = event.content?.new_job_post_title as string | undefined;
      return (
        <div className="space-y-2">
          <p className="text-sm text-gray-700">
            {event.content?.message || '포지션이 변경되었습니다.'}
          </p>
          {previousJobTitle && newJobTitle && (
            <div className="mt-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
              <div className="flex items-center gap-2 text-xs flex-wrap">
                <Badge variant="outline" className="text-xs">
                  {previousJobTitle}
                </Badge>
                <ArrowRight className="w-4 h-4 text-primary" />
                <Badge variant="default" className="text-xs">
                  {newJobTitle}
                </Badge>
              </div>
            </div>
          )}
        </div>
      );
    }
    case 'comment_created':
    case 'comment_updated':
      return (
        <div className="p-3 bg-primary/5 rounded-lg border border-primary/10">
          <p className="text-sm text-foreground">
            {event.content?.content || event.content?.message || '코멘트가 작성되었습니다.'}
          </p>
          {event.content?.previous_content && (
            <div className="mt-2 p-2 bg-card rounded border border-border">
              <p className="text-xs text-muted-foreground mb-1">이전 내용:</p>
              <p className="text-xs text-muted-foreground line-through">
                {event.content.previous_content}
              </p>
            </div>
          )}
        </div>
      );
    case 'scorecard_created': {
      const scorecardRating = event.content?.overall_rating ?? event.content?.rating;
      return (
        <div className="space-y-3">
          <p className="text-sm text-foreground">
            {event.content?.message || '면접 평가표가 작성되었습니다.'}
          </p>
          {scorecardRating != null && (
            <div className="mt-2">
              {renderStars(scorecardRating)}
              {event.content?.previous_rating != null && (
                <div className="mt-2 text-xs text-muted-foreground">
                  이전 평가: {renderStars(event.content.previous_rating)}
                </div>
              )}
            </div>
          )}
        </div>
      );
    }
    default:
      return (
        <p className="text-sm text-foreground">{event.content?.message || event.type}</p>
      );
  }
}
