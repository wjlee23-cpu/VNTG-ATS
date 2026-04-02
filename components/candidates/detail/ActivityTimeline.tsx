'use client';

import { MessageSquare, Plus, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDate, formatRelativeTime } from '@/lib/candidate-detail-utils';
import { getTimelineEventTitle, getTimelineEventColor } from './timeline-utils';
import { TimelineEventContent } from './TimelineEventContent';
import type { TimelineEvent } from '@/types/candidate-detail';
import { CANDIDATE_STATUS_CONFIG } from '@/constants/candidates';

interface ActivityTimelineProps {
  events: TimelineEvent[];
  expandedEmails: Set<string>;
  onToggleEmailExpand: (eventId: string) => void;
  candidateId: string;
  currentStageId: string | null;
  canManageCandidate: boolean;
  isSyncingEmails: boolean;
  onSyncEmails: () => void;
  onAddComment: () => void;
  onAddEvaluation: () => void;
  // 일정 관련 액션 콜백 (후보자 상세 컨테이너에서 주입)
  onDeleteSchedule?: (scheduleId: string) => void;
  onCheckSchedule?: (scheduleId: string) => void;
}

/** Activity Timeline 카드: 이벤트 목록 + 동기화/코멘트/평가 버튼 */
export function ActivityTimeline({
  events,
  expandedEmails,
  onToggleEmailExpand,
  candidateId,
  currentStageId,
  canManageCandidate,
  isSyncingEmails,
  onSyncEmails,
  onAddComment,
  onAddEvaluation,
  onDeleteSchedule,
  onCheckSchedule,
}: ActivityTimelineProps) {
  const showUserAvatar = (event: TimelineEvent) => {
    // 이벤트 타입과 무관하게 작성자 정보가 있으면 실행 주체를 아바타로 표시합니다.
    return !!event.created_by_user;
  };

  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow duration-200 card-modern">
      <CardHeader className="border-b border-neutral-200 pb-4">
        {/* Flex 레이아웃: 왼쪽(아이콘+제목)과 오른쪽(버튼 그룹)으로 분리 */}
        <div className="flex items-center justify-between gap-3">
          {/* 왼쪽: 아이콘 + 제목 (DS 2.0: Neutral 기반) */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-neutral-900" />
            </div>
            <CardTitle className="text-base md:text-lg font-semibold text-neutral-900 whitespace-nowrap">
              Activity Timeline
            </CardTitle>
          </div>

          {/* 오른쪽: 버튼 그룹 */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* 이메일 동기화 아이콘 */}
            {canManageCandidate && (
              <Button
                onClick={onSyncEmails}
                variant="ghost"
                size="icon"
                className="w-8 h-8 rounded-full flex-shrink-0"
                disabled={isSyncingEmails}
                title="이메일 동기화"
              >
                <RefreshCw
                  className={`w-4 h-4 ${isSyncingEmails ? 'animate-spin' : ''}`}
                />
              </Button>
            )}

            {/* Add Comment 버튼 (DS 2.0: Neutral outline) */}
            <Button
              onClick={onAddComment}
              variant="outline"
              size="sm"
              className="whitespace-nowrap flex-shrink-0"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Add Comment
            </Button>

            {/* Add Evaluation 버튼 */}
            {currentStageId && (
              <Button
                onClick={onAddEvaluation}
                variant="outline"
                size="sm"
                className="whitespace-nowrap flex-shrink-0"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Evaluation
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <MessageSquare className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">타임라인 이벤트가 없습니다.</p>
            </div>
          </div>
        ) : (
          <div className="relative">
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-muted via-border to-muted" />
            <div className="space-y-6">
              {events.map((event) => (
                <div key={event.id} className="relative flex gap-4 group">
                  <div className="relative z-10 flex-shrink-0 flex items-center justify-center">
                    {showUserAvatar(event) ? (
                      <Avatar className="w-12 h-12 border-2 shadow-sm group-hover:shadow-md group-hover:scale-105 transition-all duration-200">
                        <AvatarImage
                          src={(event.created_by_user as { avatar_url?: string })?.avatar_url}
                          alt={(event.created_by_user as { name?: string })?.name ?? (event.created_by_user as { email?: string })?.email ?? 'user'}
                        />
                        <AvatarFallback className="text-xs font-semibold">
                          {(
                            ((event.created_by_user as { name?: string })?.name ||
                              (event.created_by_user as { email?: string })?.email ||
                              '?') as string
                          )
                            .trim()
                            .slice(0, 1)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <div className="w-12 h-12 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-neutral-400 ring-4 ring-neutral-200" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 pb-6">
                    <div className="bg-white border border-neutral-200 shadow-sm rounded-lg p-3 hover:shadow-md transition-all duration-200">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={`text-sm font-semibold ${getTimelineEventColor(event.type)}`}>
                          {getTimelineEventTitle(event)}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {formatRelativeTime(event.created_at)}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">
                        {(event.created_by_user as { name?: string })?.name ||
                        (event.created_by_user as { email?: string })?.email
                          ? `${(event.created_by_user as { name?: string })?.name || (event.created_by_user as { email?: string })?.email} • ${formatDate(event.created_at)} ${new Date(event.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`
                          : `${formatDate(event.created_at)} ${new Date(event.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`}
                      </p>
                      <div className="text-sm text-foreground">
                        <TimelineEventContent
                          event={event}
                          expandedEmails={expandedEmails}
                          onToggleEmailExpand={onToggleEmailExpand}
                          candidateId={candidateId}
                          // 일정 관리 액션들은 아직 UI 리디자인 단계에서 사용할 예정
                          onDeleteSchedule={onDeleteSchedule}
                          onCheckSchedule={onCheckSchedule}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
