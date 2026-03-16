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
}: ActivityTimelineProps) {
  const showUserAvatar = (event: TimelineEvent) => {
    const types = [
      'comment',
      'comment_created',
      'comment_updated',
      'email',
      'email_received',
      'stage_evaluation',
      'scorecard',
      'scorecard_created',
    ];
    return types.includes(event.type) && event.created_by_user;
  };

  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow duration-200 card-modern">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg font-semibold">Activity Timeline</CardTitle>
            {canManageCandidate && (
              <Button
                onClick={onSyncEmails}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hover:bg-primary/10 transition-all duration-200"
                disabled={isSyncingEmails}
                title="이메일 동기화"
              >
                {isSyncingEmails ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                ) : (
                  <RefreshCw className="w-4 h-4 text-primary" />
                )}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              onClick={onAddComment}
              variant="outline"
              size="sm"
              className="border-blue-500/30 text-blue-600 hover:bg-blue-50 transition-all duration-200"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Add Comment
            </Button>
            {currentStageId && (
              <Button
                onClick={onAddEvaluation}
                variant="outline"
                size="sm"
                className="border-primary/30 text-primary hover:bg-primary/10 transition-all duration-200"
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
                        <div className="w-2 h-2 rounded-full bg-brand-main ring-4 ring-brand-main/20" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 pb-6 min-w-0">
                    <div className="bg-white border border-slate-100 shadow-sm rounded-lg p-3 hover:shadow-md transition-all duration-200">
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
