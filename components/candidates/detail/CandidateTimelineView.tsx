'use client';

// VNTG Design System 2.0 - 후보자 액티비티 타임라인 뷰
// 샘플화면3.html 기반의 초미니멀리즘 디자인 적용
import { useState } from 'react';
import { Paperclip, Send } from 'lucide-react';
import { getTimelineEventTitle } from './timeline-utils';
import { TimelineEventContent } from './TimelineEventContent';
import type { TimelineEvent } from '@/types/candidate-detail';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { createComment } from '@/api/actions/comments';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface CandidateTimelineViewProps {
  candidateName: string;
  events: TimelineEvent[];
  /** 타임라인 데이터를 불러오는 중인지(탭 지연 로딩) */
  isLoading?: boolean;
  /** 타임라인을 한 번이라도 로드해본 적이 있는지(빈 상태 메시지 제어) */
  hasLoaded?: boolean;
  expandedEmails: Set<string>;
  onToggleEmailExpand: (eventId: string) => void;
  candidateId: string;
  currentStageId: string | null;
  canManageCandidate: boolean;
  onAddComment: () => void;
  onRefreshTimeline?: () => void | Promise<void>;
  onSwitchToTimeline?: () => void;
}

/** 후보자 액티비티 타임라인 뷰 - VNTG Design System 2.0 */
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
  onAddComment,
  onRefreshTimeline,
  onSwitchToTimeline,
}: CandidateTimelineViewProps) {
  const router = useRouter();
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const currentUserInitial = '나'; // TODO: 실제 사용자 정보에서 가져오기

  // 타임라인 이벤트의 작성자 표시용 이름/아바타 정보를 가공합니다.
  const getAuthorDisplay = (event: TimelineEvent) => {
    const authorName = event.created_by_user?.name?.trim();
    const authorEmail = event.created_by_user?.email?.trim();
    const displayName = authorName || authorEmail?.split('@')[0] || 'System';
    const fallback = displayName.slice(0, 1).toUpperCase();
    return {
      displayName,
      fallback,
      avatarUrl: event.created_by_user?.avatar_url,
      hasAuthor: !!event.created_by_user,
    };
  };

  // 이벤트 타입에 따른 배지 스타일 결정
  const getEventBadgeStyle = (event: TimelineEvent) => {
    switch (event.type) {
      case 'stage_evaluation':
        return 'px-2 py-0.5 rounded bg-indigo-50 text-[11px] font-medium text-indigo-600 border border-indigo-100/50';
      case 'comment':
      case 'comment_created':
      case 'comment_updated':
        return 'px-2 py-0.5 rounded bg-neutral-100 text-[11px] font-medium text-neutral-600';
      case 'schedule_created':
      case 'schedule_confirmed':
      case 'schedule_regenerated':
        return 'px-2 py-0.5 rounded bg-neutral-100 border border-neutral-200/60 text-[10px] font-bold text-neutral-500 tracking-wider uppercase';
      case 'email':
      case 'email_received':
        return 'px-2 py-0.5 rounded bg-blue-50 text-[11px] font-medium text-blue-600';
      default:
        return 'px-2 py-0.5 rounded bg-neutral-100 border border-neutral-200/60 text-[10px] font-bold text-neutral-500 tracking-wider uppercase';
    }
  };

  // 이벤트 타입에 따른 배지 텍스트
  const getEventBadgeText = (event: TimelineEvent) => {
    switch (event.type) {
      case 'stage_evaluation':
        return '평가';
      case 'comment':
      case 'comment_created':
      case 'comment_updated':
        return '메모';
      case 'schedule_created':
      case 'schedule_confirmed':
      case 'schedule_regenerated':
        return '일정';
      case 'email':
      case 'email_received':
        return '발신';
      default:
        return '이벤트';
    }
  };

  // 상대 시간 포맷 (HTML 샘플 기준: "오늘, 오후 4:30", "어제, 오전 10:20", "2026. 2. 18")
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
    
    if (diffDays === 0) {
      const period = date.getHours() < 12 ? '오전' : '오후';
      return `오늘, ${period} ${timeStr.replace(/AM|PM/, '').trim()}`;
    } else if (diffDays === 1) {
      const period = date.getHours() < 12 ? '오전' : '오후';
      return `어제, ${period} ${timeStr.replace(/AM|PM/, '').trim()}`;
    } else {
      return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
      });
    }
  };

  // 코멘트 전송 핸들러 - 직접 코멘트를 생성합니다
  const handleCommentSubmit = async () => {
    // 내용 검증
    if (!commentText.trim()) {
      toast.error('코멘트 내용을 입력해주세요.');
      return;
    }

    setIsSubmitting(true);

    try {
      // skipRevalidate: true로 설정하여 전체 페이지 리프레시 방지
      // 클라이언트에서 타임라인을 직접 업데이트하므로 서버 캐시 무효화가 불필요합니다.
      const result = await createComment(
        candidateId,
        commentText.trim(),
        undefined, // mentionedUserIds
        undefined, // parentCommentId
        true // skipRevalidate: true - 리프레시 방지
      );

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('코멘트가 저장되었습니다.');
        setCommentText('');
        // Activity Timeline 탭으로 전환
        if (onSwitchToTimeline) {
          onSwitchToTimeline();
        }
        // 타임라인만 새로고침 (전체 페이지 새로고침 방지)
        if (onRefreshTimeline) {
          await onRefreshTimeline();
        } else {
          // 폴백: 콜백이 없으면 router.refresh() 사용
          router.refresh();
        }
      }
    } catch (error) {
      toast.error('코멘트 저장 중 오류가 발생했습니다.');
      console.error('Comment error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-white relative min-h-0">
      <div className="flex-1 overflow-y-auto p-8 min-h-0">
        {/* 코멘트 입력 영역 */}
        <div className="mb-10">
          <div className="relative flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-neutral-800 text-white flex items-center justify-center text-xs font-semibold shrink-0 mt-0.5">
              {currentUserInitial}
            </div>
            <div className="flex-1 relative">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                disabled={isSubmitting}
                className="w-full bg-[#FCFCFC] border border-neutral-200 rounded-lg pl-4 pr-20 py-3 text-sm focus:outline-none focus:border-neutral-900 focus:bg-white focus:ring-1 focus:ring-neutral-900 transition-all resize-none placeholder:text-neutral-400 disabled:opacity-50 disabled:cursor-not-allowed"
                rows={2}
                placeholder={`${candidateName} 후보자에 대한 평가나 메모를 남겨주세요...`}
              />
              <div className="absolute right-2 bottom-2 flex gap-1">
                <button
                  type="button"
                  className="p-1.5 text-neutral-400 hover:text-neutral-900 transition-colors rounded"
                  title="첨부"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleCommentSubmit}
                  disabled={!commentText.trim() || isSubmitting}
                  className="p-1.5 bg-neutral-900 text-white rounded hover:bg-neutral-800 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  title={isSubmitting ? '전송 중...' : '전송'}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 타임라인 이벤트 리스트 */}
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
          <div className="relative border-l border-neutral-200 ml-[15px] pb-8">
            {events.map((event, index) => {
              const isLast = index === events.length - 1;
              
              return (
                <div key={event.id} className={`relative pl-8 ${isLast ? '' : 'pb-10'} group`}>
                  {/* 타임라인 점 */}
                  <div className="absolute -left-[5px] top-1.5 w-[9px] h-[9px] rounded-full bg-neutral-200 ring-4 ring-white group-hover:bg-neutral-900 transition-colors"></div>
                  
                  {/* 이벤트 헤더 */}
                  <div className="flex items-center justify-between mb-2 gap-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      {(() => {
                        const author = getAuthorDisplay(event);
                        if (!author.hasAuthor) {
                          return (
                            <span className="px-2 py-0.5 rounded bg-neutral-100 text-[11px] font-medium text-neutral-500">
                              System
                            </span>
                          );
                        }
                        return (
                          <div className="flex items-center gap-2">
                            <Avatar className="w-6 h-6 border border-neutral-200 shadow-sm">
                              <AvatarImage src={author.avatarUrl} alt={author.displayName} />
                              <AvatarFallback className="text-[10px] font-semibold bg-neutral-100 text-neutral-700">
                                {author.fallback}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs font-medium text-neutral-600">{author.displayName}</span>
                          </div>
                        );
                      })()}
                      <span className="text-sm font-semibold text-neutral-900">
                        {getTimelineEventTitle(event)}
                      </span>
                      <span className={getEventBadgeStyle(event)}>
                        {getEventBadgeText(event)}
                      </span>
                    </div>
                    <time className="text-xs text-neutral-400 font-medium">
                      {formatTimeForDisplay(event.created_at)}
                    </time>
                  </div>
                  
                  {/* 이벤트 본문 */}
                  <div className="text-sm text-neutral-600 leading-relaxed max-w-2xl">
                    {event.type === 'stage_evaluation' ? (
                      <div className="p-4 rounded-lg border border-neutral-200 bg-white max-w-2xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
                        <div className="flex items-center gap-2 mb-3">
                          {event.content?.result === 'pass' && (
                            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[11px] font-bold tracking-wide rounded-md border border-emerald-100">
                              STRONG HIRE
                            </span>
                          )}
                          {event.content?.rating && (
                            <span className="text-xs font-medium text-neutral-500">
                              종합 점수: {event.content.rating} / 5.0
                            </span>
                          )}
                        </div>
                        <TimelineEventContent
                          event={event}
                          expandedEmails={expandedEmails}
                          onToggleEmailExpand={onToggleEmailExpand}
                          candidateId={candidateId}
                        />
                      </div>
                    ) : event.type === 'comment' || event.type === 'comment_created' || event.type === 'comment_updated' ? (
                      <div className="p-3.5 rounded-lg rounded-tl-sm bg-[#FCFCFC] border border-neutral-200 max-w-2xl">
                        <TimelineEventContent
                          event={event}
                          expandedEmails={expandedEmails}
                          onToggleEmailExpand={onToggleEmailExpand}
                          candidateId={candidateId}
                        />
                      </div>
                    ) : event.type === 'email' || event.type === 'email_received' ? (
                      <div className="mt-2 p-4 rounded-lg border border-neutral-100 bg-[#FCFCFC] max-w-2xl">
                        <TimelineEventContent
                          event={event}
                          expandedEmails={expandedEmails}
                          onToggleEmailExpand={onToggleEmailExpand}
                          candidateId={candidateId}
                        />
                      </div>
                    ) : (
                      <TimelineEventContent
                        event={event}
                        expandedEmails={expandedEmails}
                        onToggleEmailExpand={onToggleEmailExpand}
                        candidateId={candidateId}
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
  );
}
