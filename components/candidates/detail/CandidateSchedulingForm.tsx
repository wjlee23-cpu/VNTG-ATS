'use client';

import {
  ArrowRight,
  User,
  Calendar,
  CalendarRange,
  Clock,
  Layers,
  ListChecks,
  Users,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { STAGE_ID_TO_NAME_MAP } from '@/constants/stages';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale/ko';
import { cn } from '@/components/ui/utils';

const DURATION_OPTIONS = [
  { value: '30', label: '30분' },
  { value: '60', label: '60분' },
  { value: '90', label: '90분' },
  { value: '120', label: '120분' },
];

const NUM_OPTIONS_LIST = [1, 2, 3, 4, 5];

interface ScheduleFormData {
  dateRange: { from: Date | undefined; to: Date | undefined };
  duration_minutes: string;
  stage_id: string;
  interviewer_ids: string[];
  num_options: string;
}

interface UserOption {
  id: string;
  email: string;
  role: string;
}

interface CandidateSchedulingFormProps {
  candidateName: string;
  formData: ScheduleFormData;
  onFormDataChange: (data: Partial<ScheduleFormData>) => void;
  users: UserOption[];
  isLoadingUsers: boolean;
  scheduleWarning: string | null;
  isLoadingSchedule: boolean;
  isValid: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onToggleInterviewer: (userId: string) => void;
  onBack: () => void;
}

/** 일정 등록(자동화) 폼 */
export function CandidateSchedulingForm({
  candidateName,
  formData,
  onFormDataChange,
  users,
  isLoadingUsers,
  scheduleWarning,
  isLoadingSchedule,
  isValid,
  onSubmit,
  onToggleInterviewer,
  onBack,
}: CandidateSchedulingFormProps) {
  return (
    <div>
      <Button
        onClick={onBack}
        variant="ghost"
        className="mb-6 -ml-3 px-3 py-2 w-fit flex items-center gap-2 hover:bg-slate-100 hover:text-slate-900 rounded-md transition-colors text-slate-600"
      >
        <ArrowRight className="w-4 h-4 rotate-180" />
        <span>뒤로 가기</span>
      </Button>

      <form onSubmit={onSubmit} className="space-y-6">
        <div className="bg-white border border-slate-100 rounded-xl p-6 shadow-sm card-modern">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2.5">
            <User className="size-5 text-slate-400" />
            후보자
          </h3>
          <div className="bg-slate-50 border border-slate-200/60 px-4 py-3 rounded-xl flex items-center text-sm font-medium text-slate-700 w-full">
            {candidateName}
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-xl p-6 shadow-sm card-modern">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2.5">
            <CalendarRange className="size-5 text-slate-400" />
            일정 검색 기간
          </h3>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  'w-full justify-start text-left font-normal bg-white border border-slate-200 hover:border-slate-300 focus:border-brand-main focus:ring-4 focus:ring-brand-main/10 rounded-xl px-4 py-3 transition-all text-sm',
                  !formData.dateRange.from && !formData.dateRange.to && 'text-slate-500',
                  formData.dateRange.from && formData.dateRange.to && 'text-slate-900 font-medium',
                )}
              >
                <Calendar className="mr-2 h-4 w-4 text-slate-500" />
                {formData.dateRange.from && formData.dateRange.to
                  ? `${format(formData.dateRange.from, 'yyyy년 MM월 dd일', { locale: ko })} - ${format(formData.dateRange.to, 'yyyy년 MM월 dd일', { locale: ko })}`
                  : formData.dateRange.from
                    ? `${format(formData.dateRange.from, 'yyyy년 MM월 dd일', { locale: ko })} - (종료일 선택)`
                    : '기간을 선택해주세요'}
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-[calc(100vw-2rem)] max-w-[320px] p-2 bg-white rounded-xl shadow-lg border border-slate-100"
              align="start"
            >
              <DateRangePicker
                selected={formData.dateRange}
                onSelect={(range) => onFormDataChange({ dateRange: range })}
                numberOfMonths={1}
                disabled={(date) => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  return date < today;
                }}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="bg-white border border-slate-100 rounded-xl p-6 shadow-sm card-modern">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2.5">
            <Clock className="size-5 text-slate-400" />
            면접 시간
          </h3>
          <div className="bg-slate-100/70 p-1.5 rounded-xl flex items-center w-full max-w-lg">
            {DURATION_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onFormDataChange({ duration_minutes: option.value })}
                className={cn(
                  'flex-1 py-2 text-sm rounded-lg transition-all',
                  formData.duration_minutes === option.value
                    ? 'bg-white text-slate-900 font-bold shadow-sm ring-1 ring-slate-200'
                    : 'text-slate-500 font-medium hover:text-slate-700',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-xl p-6 shadow-sm card-modern">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2.5">
            <Layers className="size-5 text-slate-400" />
            면접 단계
          </h3>
          <select
            id="stage_id"
            required
            value={formData.stage_id}
            onChange={(e) => onFormDataChange({ stage_id: e.target.value })}
            className="bg-white border border-slate-200 hover:border-slate-300 focus:border-brand-main focus:ring-4 focus:ring-brand-main/10 rounded-xl px-4 py-3 transition-all w-full text-sm text-slate-900 focus:outline-none"
          >
            {Object.entries(STAGE_ID_TO_NAME_MAP).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </div>

        <div className="bg-white border border-slate-100 rounded-xl p-6 shadow-sm card-modern">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2.5">
            <ListChecks className="size-5 text-slate-400" />
            일정 옵션 개수
          </h3>
          <div className="bg-slate-100/70 p-1.5 rounded-xl flex items-center w-full max-w-lg">
            {NUM_OPTIONS_LIST.map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => onFormDataChange({ num_options: num.toString() })}
                className={cn(
                  'flex-1 py-2 text-sm rounded-lg transition-all',
                  formData.num_options === num.toString()
                    ? 'bg-white text-slate-900 font-bold shadow-sm ring-1 ring-slate-200'
                    : 'text-slate-500 font-medium hover:text-slate-700',
                )}
              >
                {num}개
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-xl p-6 shadow-sm card-modern">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2.5">
            <Users className="size-5 text-slate-400" />
            면접관 선택
            <span className="text-xs font-normal text-slate-500 ml-2">(최소 1명 이상)</span>
          </h3>
          {isLoadingUsers ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-[#5287FF]" />
              <span className="ml-2 text-sm text-slate-600">면접관 목록 로딩 중...</span>
            </div>
          ) : (
            <>
              <div className="flex gap-3 overflow-x-auto md:grid md:grid-cols-4 lg:grid-cols-5 md:overflow-x-visible pb-2">
                {users.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4 w-full">
                    면접관이 없습니다. 먼저 면접관을 등록해주세요.
                  </p>
                ) : (
                  users.map((user) => {
                    const isSelected = formData.interviewer_ids.includes(user.id);
                    return (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => onToggleInterviewer(user.id)}
                        className={cn(
                          'flex flex-col items-center gap-2 p-3.5 rounded-xl transition-all min-w-[80px] md:min-w-0',
                          isSelected
                            ? 'bg-blue-50/50 ring-2 ring-[#5287FF] shadow-sm'
                            : 'bg-slate-50 border border-slate-200 hover:bg-blue-50/30 hover:border-slate-300',
                        )}
                      >
                        <Avatar
                          className={cn(
                            'w-11 h-11 border-2 transition-all',
                            isSelected ? 'border-[#5287FF]' : 'border-slate-200',
                          )}
                        >
                          <AvatarFallback
                            className={cn(
                              'text-sm font-medium',
                              isSelected ? 'bg-[#5287FF]/10 text-[#5287FF]' : 'bg-slate-100 text-slate-600',
                            )}
                          >
                            {user.email.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="text-center">
                          <p className="text-xs font-bold text-slate-700 truncate max-w-[70px]">
                            {user.email.split('@')[0]}
                          </p>
                          {user.role === 'admin' && (
                            <Badge
                              variant="outline"
                              className="mt-1 text-[10px] px-1.5 py-0 border-slate-300 text-slate-500"
                            >
                              관리자
                            </Badge>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
              {formData.interviewer_ids.length === 0 && (
                <div className="bg-rose-50 text-rose-600 px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 mt-2">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>최소 1명의 면접관을 선택해주세요.</span>
                </div>
              )}
            </>
          )}
        </div>

        {scheduleWarning && (
          <div className="bg-amber-50/80 text-amber-800 rounded-2xl p-5 border border-amber-200/60 mt-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold mb-1">일정을 찾을 수 없습니다</h4>
                <p className="text-sm">{scheduleWarning}</p>
              </div>
            </div>
          </div>
        )}

        <div className="border-t border-slate-100 pt-4 mt-8">
          <div className="flex gap-3 justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={onBack}
              disabled={isLoadingSchedule}
              className="px-6"
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={!isValid || isLoadingSchedule}
              className={cn(
                'px-6 py-3 text-sm font-semibold rounded-xl transition-opacity',
                isValid
                  ? 'bg-brand-main text-white shadow-md shadow-brand-main/20 hover:opacity-95'
                  : 'opacity-50 cursor-not-allowed bg-brand-main text-white',
              )}
            >
              {isLoadingSchedule ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  처리 중...
                </>
              ) : (
                '자동화 시작'
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
