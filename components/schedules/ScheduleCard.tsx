'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale/ko';
import {
  Calendar as CalendarIcon,
  Clock,
  User,
  Mail,
  RefreshCw,
  Trash2,
  RotateCcw,
  Edit,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScheduleStatusBadge } from './ScheduleStatusBadge';
import { ScheduleProgressBar } from './ScheduleProgressBar';
import { cn } from '@/components/ui/utils';

interface ScheduleOption {
  id: string;
  scheduled_at: string;
  status: string;
  interviewer_responses?: Record<string, string> | null;
  google_event_id?: string | null;
}

interface Interviewer {
  id: string;
  email: string;
}

interface Candidate {
  id: string;
  name: string;
  email: string;
  job_posts?: {
    id: string;
    title: string;
  } | null;
}

interface Schedule {
  id: string;
  candidate_id: string;
  workflow_status: 'pending_interviewers' | 'pending_candidate' | 'confirmed' | 'cancelled' | 'needs_rescheduling' | null;
  interviewer_ids: string[];
  duration_minutes: number;
  created_at: string;
  candidates: Candidate;
  schedule_options?: ScheduleOption[];
  interviewers?: Interviewer[];
}

interface ScheduleCardProps {
  schedule: Schedule;
  onCheckResponse?: (scheduleId: string) => void;
  onResendEmail?: (scheduleId: string) => void;
  onDelete?: (scheduleId: string) => void;
  onCancel?: (scheduleId: string) => void;
  onEdit?: (scheduleId: string) => void;
  onCandidateClick?: (candidateId: string) => void;
  isChecking?: boolean;
  isDeleting?: boolean;
  isCancelling?: boolean;
  isSelected?: boolean;
  className?: string;
}

// 면접관 응답 상태 아이콘
const getStatusIcon = (status: string) => {
  switch (status) {
    case 'accepted':
      return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
    case 'declined':
      return <XCircle className="w-4 h-4 text-rose-600" />;
    case 'tentative':
      return <Clock className="w-4 h-4 text-amber-600" />;
    default:
      return <AlertCircle className="w-4 h-4 text-slate-400" />;
  }
};

// 면접관 응답 상태 텍스트
const getStatusText = (status: string) => {
  switch (status) {
    case 'accepted':
      return '수락';
    case 'declined':
      return '거절';
    case 'tentative':
      return '보류';
    default:
      return '대기 중';
  }
};

export function ScheduleCard({
  schedule,
  onCheckResponse,
  onResendEmail,
  onDelete,
  onCancel,
  onEdit,
  onCandidateClick,
  isChecking = false,
  isDeleting = false,
  isCancelling = false,
  isSelected = false,
  className,
}: ScheduleCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // 첫 번째 일정 옵션의 날짜/시간 정보 추출
  const firstOption = schedule.schedule_options && schedule.schedule_options.length > 0
    ? schedule.schedule_options[0]
    : null;
  const scheduledDate = firstOption ? new Date(firstOption.scheduled_at) : null;

  return (
    <div
      className={cn(
        'bg-white rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md hover:border-brand-main/20 transition-all duration-200 p-6 mb-4',
        isSelected && 'border-brand-main border-2 shadow-lg ring-2 ring-brand-main/10',
        className
      )}
    >
      {/* 헤더: 후보자 정보 */}
      <div className="flex items-start gap-4 mb-5">
        <Avatar className="w-12 h-12 flex-shrink-0">
          <AvatarFallback className="bg-primary/10 text-primary font-semibold text-base">
            {schedule.candidates.name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h3
            onClick={() => onCandidateClick?.(schedule.candidates.id)}
            className={cn(
              'text-lg font-bold text-slate-900 tracking-tight mb-1.5 cursor-pointer transition-colors',
              'hover:text-brand-main'
            )}
          >
            {schedule.candidates.name}
          </h3>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <Mail className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{schedule.candidates.email}</span>
            </div>
            {schedule.candidates.job_posts?.title && (
              <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                <User className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{schedule.candidates.job_posts.title}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 상태 섹션 */}
      <div className="mb-5 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <ScheduleStatusBadge status={schedule.workflow_status} size="md" />
          {schedule.workflow_status === 'needs_rescheduling' && (
            <span className="bg-rose-50 text-rose-700 px-2.5 py-1 rounded-md text-xs font-semibold border border-rose-200/50">
              재조율 필요
            </span>
          )}
        </div>
        <ScheduleProgressBar status={schedule.workflow_status} />
      </div>

      {/* 일정 정보 */}
      <div className="mb-5 space-y-2.5">
        {scheduledDate ? (
          <>
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <CalendarIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <span>
                {format(scheduledDate, 'yyyy년 MM월 dd일 (EEE)', { locale: ko })}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <span>
                {format(scheduledDate, 'HH:mm', { locale: ko })} -{' '}
                {format(
                  new Date(scheduledDate.getTime() + schedule.duration_minutes * 60000),
                  'HH:mm',
                  { locale: ko }
                )}
              </span>
              <span className="text-slate-500 font-normal">({schedule.duration_minutes}분)</span>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
            <Clock className="w-4 h-4 text-slate-400" />
            <span>일정 옵션 없음</span>
          </div>
        )}

        {/* 면접관 목록 */}
        {schedule.interviewers && schedule.interviewers.length > 0 && (
          <div className="flex items-start gap-2 text-sm font-medium text-slate-700">
            <Users className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <span>면접관: </span>
              <span className="text-slate-600 font-normal">
                {schedule.interviewers.map((inv) => inv.email).join(', ')}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 액션 버튼 */}
      <div className="flex flex-wrap gap-2 mb-4 touch-manipulation">
        {schedule.workflow_status === 'pending_interviewers' && onCheckResponse && (
          <Button
            onClick={() => onCheckResponse(schedule.id)}
            disabled={isChecking}
            size="sm"
            variant="outline"
            className="flex-1 sm:flex-none"
          >
            {isChecking ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                확인 중...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                응답 확인
              </>
            )}
          </Button>
        )}
        {schedule.workflow_status === 'pending_candidate' && onResendEmail && (
          <Button
            onClick={() => onResendEmail(schedule.id)}
            disabled={isChecking}
            size="sm"
            className="bg-brand-main text-white rounded-lg shadow-sm hover:opacity-90 transition-opacity px-4 py-2 text-sm font-medium flex-1 sm:flex-none"
          >
            {isChecking ? (
              <>
                <Mail className="w-4 h-4 mr-2 animate-spin" />
                전송 중...
              </>
            ) : (
              <>
                <Mail className="w-4 h-4 mr-2" />
                이메일 재전송
              </>
            )}
          </Button>
        )}
        {schedule.workflow_status === 'confirmed' && onEdit && (
          <Button
            onClick={() => onEdit(schedule.id)}
            size="sm"
            variant="outline"
            className="flex-1 sm:flex-none"
          >
            <Edit className="w-4 h-4 mr-2" />
            수정
          </Button>
        )}
        {onCancel && schedule.workflow_status !== 'cancelled' && (
          <Button
            onClick={() => onCancel(schedule.id)}
            disabled={isCancelling}
            size="sm"
            variant="ghost"
            className="text-amber-600 hover:bg-amber-50 flex-1 sm:flex-none"
          >
            {isCancelling ? (
              <>
                <RotateCcw className="w-4 h-4 mr-2 animate-spin" />
                취소 중...
              </>
            ) : (
              <>
                <RotateCcw className="w-4 h-4 mr-2" />
                취소
              </>
            )}
          </Button>
        )}
        {onDelete && (
          <Button
            onClick={() => onDelete(schedule.id)}
            disabled={isDeleting || isCancelling}
            size="sm"
            variant="ghost"
            className="text-rose-600 hover:bg-rose-50 flex-1 sm:flex-none"
          >
            {isDeleting ? (
              <>
                <Trash2 className="w-4 h-4 mr-2 animate-spin" />
                삭제 중...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                삭제
              </>
            )}
          </Button>
        )}
      </div>

      {/* 일정 옵션 상세 정보 (아코디언) */}
      {schedule.schedule_options && schedule.schedule_options.length > 0 && (
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="options" className="border-0">
            <AccordionTrigger className="py-2 text-sm font-medium text-slate-700 hover:no-underline">
              <span className="flex items-center gap-2">
                일정 옵션 상세 보기 ({schedule.schedule_options.length}개)
              </span>
            </AccordionTrigger>
            <AccordionContent className="pt-2">
              <div className="space-y-3">
                {schedule.schedule_options.map((option) => {
                  const date = new Date(option.scheduled_at);
                  const responses = option.interviewer_responses || {};

                  // 부분적 충돌 정보 확인
                  const metadata = (responses as any)?._metadata;
                  const isPartialConflict = metadata?.isPartialConflict || false;
                  const missingInterviewerIds = metadata?.missingInterviewers || [];
                  const missingInterviewers = missingInterviewerIds
                    .map((id: string) => {
                      const interviewer = schedule.interviewers?.find((inv) => inv.id === id);
                      return interviewer?.email || id;
                    })
                    .filter(Boolean);

                  // 옵션 상태 결정
                  const getOptionStatus = () => {
                    if (option.status === 'selected') return '선택됨';
                    if (option.status === 'rejected') return '거절됨';
                    if (option.status === 'accepted') return '후보자 선택 대기';

                    if (schedule.interviewer_ids && schedule.interviewer_ids.length > 0) {
                      const allAccepted = schedule.interviewer_ids.every(
                        (interviewerId: string) => responses[interviewerId] === 'accepted'
                      );
                      const allDeclined = schedule.interviewer_ids.every(
                        (interviewerId: string) => responses[interviewerId] === 'declined'
                      );
                      const hasDeclined = schedule.interviewer_ids.some(
                        (interviewerId: string) => responses[interviewerId] === 'declined'
                      );
                      const hasAccepted = schedule.interviewer_ids.some(
                        (interviewerId: string) => responses[interviewerId] === 'accepted'
                      );

                      if (allAccepted) return '후보자 선택 대기';
                      if (allDeclined) return '거절됨';
                      if (hasDeclined && hasAccepted) return '일부 거절';
                      if (hasAccepted) return '일부 수락';
                    }

                    return '대기 중';
                  };

                  return (
                    <div
                      key={option.id}
                      className="border border-slate-200/60 rounded-lg p-3 bg-slate-50/30"
                    >
                      <div className="mb-3">
                        <div className="flex items-center gap-2 mb-2">
                          <CalendarIcon className="w-4 h-4 text-slate-400" />
                          <p className="text-sm font-semibold text-gray-900">
                            {format(date, 'yyyy년 MM월 dd일 (EEE)', { locale: ko })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className="w-4 h-4 text-slate-400" />
                          <p className="text-sm font-medium text-gray-700">
                            {format(date, 'HH:mm', { locale: ko })}
                          </p>
                        </div>
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs text-slate-500">상태: {getOptionStatus()}</p>
                          {isPartialConflict && missingInterviewers.length > 0 && (
                            <span className="bg-amber-50 text-amber-700 px-2.5 py-1 rounded-md text-xs font-semibold border border-amber-200/50">
                              일부 면접관 제외
                            </span>
                          )}
                        </div>
                        {isPartialConflict && missingInterviewers.length > 0 && (
                          <div className="mt-2 p-2 border border-amber-200/60 rounded bg-amber-50/50">
                            <p className="text-xs text-amber-700 font-medium mb-1">
                              참석 불가능한 면접관:
                            </p>
                            <p className="text-xs text-amber-600">{missingInterviewers.join(', ')}</p>
                          </div>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        {schedule.interviewer_ids.map((interviewerId) => {
                          const interviewer = schedule.interviewers?.find(
                            (inv) => inv.id === interviewerId
                          );
                          const response = responses[interviewerId] || 'needsAction';

                          return (
                            <div
                              key={interviewerId}
                              className="flex items-center justify-between text-xs sm:text-sm"
                            >
                              <span className="text-slate-700 truncate">
                                {interviewer?.email || interviewerId}
                              </span>
                              <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                                {getStatusIcon(response)}
                                <span className="text-slate-600">{getStatusText(response)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  );
}
