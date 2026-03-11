'use client';

import { useMemo } from 'react';
import { format, startOfDay, isSameDay, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale/ko';
import { CalendarDays } from 'lucide-react';
import { ScheduleCard } from './ScheduleCard';
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

interface ScheduleTimelineViewProps {
  schedules: Schedule[];
  onCheckResponse?: (scheduleId: string) => void;
  onResendEmail?: (scheduleId: string) => void;
  onDelete?: (scheduleId: string) => void;
  onCancel?: (scheduleId: string) => void;
  onEdit?: (scheduleId: string) => void;
  onCandidateClick?: (candidateId: string) => void;
  checkingScheduleId?: string | null;
  deletingScheduleId?: string | null;
  cancellingScheduleId?: string | null;
  selectedCandidateId?: string | null;
  className?: string;
}

interface GroupedSchedules {
  date: Date;
  dateString: string;
  schedules: Schedule[];
}

export function ScheduleTimelineView({
  schedules,
  onCheckResponse,
  onResendEmail,
  onDelete,
  onCancel,
  onEdit,
  onCandidateClick,
  checkingScheduleId,
  deletingScheduleId,
  cancellingScheduleId,
  selectedCandidateId,
  className,
}: ScheduleTimelineViewProps) {
  // 일정을 날짜별로 그룹핑
  const groupedSchedules = useMemo(() => {
    const groups = new Map<string, GroupedSchedules>();

    schedules.forEach((schedule) => {
      // 첫 번째 일정 옵션의 날짜를 기준으로 그룹핑
      const firstOption = schedule.schedule_options?.[0];
      if (!firstOption) {
        // 일정 옵션이 없으면 created_at을 기준으로
        const date = startOfDay(parseISO(schedule.created_at));
        const dateString = format(date, 'yyyy-MM-dd');
        
        if (!groups.has(dateString)) {
          groups.set(dateString, {
            date,
            dateString,
            schedules: [],
          });
        }
        groups.get(dateString)!.schedules.push(schedule);
        return;
      }

      const scheduledDate = parseISO(firstOption.scheduled_at);
      const date = startOfDay(scheduledDate);
      const dateString = format(date, 'yyyy-MM-dd');

      if (!groups.has(dateString)) {
        groups.set(dateString, {
          date,
          dateString,
          schedules: [],
        });
      }
      groups.get(dateString)!.schedules.push(schedule);
    });

    // 날짜순으로 정렬 (오래된 것부터)
    return Array.from(groups.values()).sort((a, b) => 
      a.date.getTime() - b.date.getTime()
    );
  }, [schedules]);

  // 각 날짜 그룹 내에서 시간순으로 정렬
  const sortedGroupedSchedules = useMemo(() => {
    return groupedSchedules.map((group) => ({
      ...group,
      schedules: group.schedules.sort((a, b) => {
        const aOption = a.schedule_options?.[0];
        const bOption = b.schedule_options?.[0];
        
        if (!aOption && !bOption) return 0;
        if (!aOption) return 1;
        if (!bOption) return -1;
        
        return parseISO(aOption.scheduled_at).getTime() - parseISO(bOption.scheduled_at).getTime();
      }),
    }));
  }, [groupedSchedules]);

  if (schedules.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-16 px-4', className)}>
        <CalendarDays className="w-16 h-16 text-slate-300 mb-4" />
        <p className="text-slate-500 text-lg font-medium mb-2">예정된 면접 일정이 없습니다</p>
        <p className="text-slate-400 text-sm">새로운 일정을 생성하면 여기에 표시됩니다.</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-8', className)}>
      {sortedGroupedSchedules.map((group) => {
        const isToday = isSameDay(group.date, new Date());
        
        return (
          <div key={group.dateString} className="relative">
            {/* 날짜 헤더 */}
            <div className="sticky top-0 z-10 mb-4 flex items-center gap-2 sm:gap-3 bg-slate-50/80 backdrop-blur-sm py-2 -mx-4 px-4 rounded-lg">
              <CalendarDays className={cn(
                'w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0',
                isToday ? 'text-brand-main' : 'text-slate-400'
              )} />
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 min-w-0 flex-1">
                <h3 className={cn(
                  'text-base sm:text-lg font-bold truncate',
                  isToday ? 'text-brand-main' : 'text-slate-900'
                )}>
                  {format(group.date, 'yyyy년 MM월 dd일 (EEE)', { locale: ko })}
                </h3>
                <div className="flex items-center gap-2 flex-wrap">
                  {isToday && (
                    <span className="px-2 py-0.5 bg-brand-main/10 text-brand-main rounded-full text-xs font-medium whitespace-nowrap">
                      오늘
                    </span>
                  )}
                  <span className="text-xs sm:text-sm text-slate-500 font-normal whitespace-nowrap">
                    ({group.schedules.length}개 일정)
                  </span>
                </div>
              </div>
            </div>

            {/* 일정 카드 목록 */}
            <div className="space-y-4 pl-0 sm:pl-8 relative">
              {/* 타임라인 연결선 - 모바일에서는 숨김 */}
              {group.schedules.length > 1 && (
                <div className="hidden sm:block absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-200 via-blue-300 to-blue-200" />
              )}
              
              {group.schedules.map((schedule, index) => {
                const firstOption = schedule.schedule_options?.[0];
                const scheduledTime = firstOption 
                  ? parseISO(firstOption.scheduled_at)
                  : parseISO(schedule.created_at);

                return (
                  <div key={schedule.id} className="relative">
                    {/* 타임라인 노드 - 모바일에서는 숨김 */}
                    <div className="hidden sm:block absolute -left-10 top-6">
                      <div className={cn(
                        'w-3 h-3 rounded-full border-2 border-white shadow-md',
                        schedule.workflow_status === 'confirmed'
                          ? 'bg-emerald-500 ring-4 ring-emerald-200'
                          : schedule.workflow_status === 'pending_candidate'
                          ? 'bg-blue-500 ring-4 ring-blue-200'
                          : schedule.workflow_status === 'pending_interviewers'
                          ? 'bg-amber-500 ring-4 ring-amber-200'
                          : schedule.workflow_status === 'needs_rescheduling'
                          ? 'bg-rose-500 ring-4 ring-rose-200'
                          : 'bg-slate-400 ring-4 ring-slate-200'
                      )} />
                    </div>

                    {/* 시간 표시 - 모바일에서는 카드 내부로 이동 */}
                    {firstOption && (
                      <div className="hidden sm:block absolute -left-24 top-6 text-xs font-medium text-slate-500 whitespace-nowrap">
                        {format(scheduledTime, 'HH:mm', { locale: ko })}
                      </div>
                    )}

                    {/* 일정 카드 */}
                    <div className="sm:ml-4">
                      <ScheduleCard
                        schedule={schedule}
                        onCheckResponse={onCheckResponse}
                        onResendEmail={onResendEmail}
                        onDelete={onDelete}
                        onCancel={onCancel}
                        onEdit={onEdit}
                        onCandidateClick={onCandidateClick}
                        isChecking={checkingScheduleId === schedule.id}
                        isDeleting={deletingScheduleId === schedule.id}
                        isCancelling={cancellingScheduleId === schedule.id}
                        isSelected={selectedCandidateId === schedule.candidates.id}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
