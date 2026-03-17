'use client';

import {
  User,
  Calendar,
  CalendarRange,
  Clock,
  Layers,
  ListChecks,
  Users,
  Loader2,
  AlertTriangle,
  Ban,
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
import { BackButton } from '@/components/common/BackButton';

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
  exclude_start_hour: string;
  exclude_start_minute: string;
  exclude_end_hour: string;
  exclude_end_minute: string;
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
    <div className="space-y-4">
      {/* 상단 공통 뒤로 가기 버튼: 카드와 동일한 좌측 기준선에서 정렬 */}
      <BackButton onClick={onBack} className="mb-2" />

      <form onSubmit={onSubmit} className="space-y-6">
        <div className="bg-white border border-neutral-200 rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2.5">
            <User className="size-5 text-neutral-400" />
            후보자
          </h3>
          <div className="bg-[#FCFCFC] border border-neutral-200 px-4 py-3 rounded-lg flex items-center text-sm font-medium text-neutral-700 w-full">
            {candidateName}
          </div>
        </div>

        <div className="bg-white border border-neutral-200 rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2.5">
            <CalendarRange className="size-5 text-neutral-400" />
            일정 검색 기간
          </h3>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  'w-full justify-start text-left font-normal bg-[#FCFCFC] border border-neutral-200 hover:border-neutral-300 focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 rounded-lg px-4 py-3 transition-all text-sm',
                  !formData.dateRange.from && !formData.dateRange.to && 'text-neutral-400',
                  formData.dateRange.from && formData.dateRange.to && 'text-neutral-900 font-medium',
                )}
              >
                <Calendar className="mr-2 h-4 w-4 text-neutral-400" />
                {formData.dateRange.from && formData.dateRange.to
                  ? `${format(formData.dateRange.from, 'yyyy년 MM월 dd일', { locale: ko })} - ${format(formData.dateRange.to, 'yyyy년 MM월 dd일', { locale: ko })}`
                  : formData.dateRange.from
                    ? `${format(formData.dateRange.from, 'yyyy년 MM월 dd일', { locale: ko })} - (종료일 선택)`
                    : '기간을 선택해주세요'}
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-[calc(100vw-2rem)] max-w-[320px] p-2 bg-white rounded-lg shadow-lg border border-neutral-200"
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

        <div className="bg-white border border-neutral-200 rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2.5">
            <Clock className="size-5 text-neutral-400" />
            면접 시간
          </h3>
          <div className="bg-neutral-100/80 p-1 rounded-lg flex items-center w-full max-w-lg">
            {DURATION_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onFormDataChange({ duration_minutes: option.value })}
                className={cn(
                  'flex-1 py-2 text-sm rounded-lg transition-all',
                  formData.duration_minutes === option.value
                    ? 'bg-white text-neutral-900 font-semibold shadow-sm'
                    : 'text-neutral-600 font-medium hover:text-neutral-900',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white border border-neutral-200 rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2.5">
            <Layers className="size-5 text-neutral-400" />
            면접 단계
          </h3>
          <select
            id="stage_id"
            required
            value={formData.stage_id}
            onChange={(e) => onFormDataChange({ stage_id: e.target.value })}
            className="bg-[#FCFCFC] border border-neutral-200 hover:border-neutral-300 focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 rounded-lg px-4 py-3 transition-all w-full text-sm text-neutral-900 focus:outline-none"
          >
            {Object.entries(STAGE_ID_TO_NAME_MAP).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </div>

        <div className="bg-white border border-neutral-200 rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2.5">
            <ListChecks className="size-5 text-neutral-400" />
            일정 옵션 개수
          </h3>
          <div className="bg-neutral-100/80 p-1 rounded-lg flex items-center w-full max-w-lg">
            {NUM_OPTIONS_LIST.map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => onFormDataChange({ num_options: num.toString() })}
                className={cn(
                  'flex-1 py-2 text-sm rounded-lg transition-all',
                  formData.num_options === num.toString()
                    ? 'bg-white text-neutral-900 font-semibold shadow-sm'
                    : 'text-neutral-600 font-medium hover:text-neutral-900',
                )}
              >
                {num}개
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white border border-neutral-200 rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2.5">
            <Ban className="size-5 text-neutral-400" />
            제외 시간
            <span className="text-xs font-normal text-neutral-400 ml-2">(점심시간 등)</span>
          </h3>
          <div className="space-y-4">
            <p className="text-sm text-neutral-600 mb-3">
              면접 일정에서 제외할 시간대를 설정하세요. 예: 점심시간 11:30 ~ 12:30
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="exclude_start" className="block text-xs font-medium text-neutral-700 mb-2">
                  시작 시간
                </label>
                <div className="flex gap-2">
                  <select
                    id="exclude_start_hour"
                    value={formData.exclude_start_hour || '11'}
                    onChange={(e) => onFormDataChange({ exclude_start_hour: e.target.value })}
                    className="flex-1 bg-[#FCFCFC] border border-neutral-200 hover:border-neutral-300 focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 rounded-lg px-3 py-2.5 transition-all text-sm text-neutral-900 focus:outline-none"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i.toString().padStart(2, '0')}>
                        {i.toString().padStart(2, '0')}시
                      </option>
                    ))}
                  </select>
                  <select
                    id="exclude_start_minute"
                    value={formData.exclude_start_minute || '30'}
                    onChange={(e) => onFormDataChange({ exclude_start_minute: e.target.value })}
                    className="flex-1 bg-[#FCFCFC] border border-neutral-200 hover:border-neutral-300 focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 rounded-lg px-3 py-2.5 transition-all text-sm text-neutral-900 focus:outline-none"
                  >
                    {[0, 15, 30, 45].map((m) => (
                      <option key={m} value={m.toString().padStart(2, '0')}>
                        {m.toString().padStart(2, '0')}분
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="exclude_end" className="block text-xs font-medium text-neutral-700 mb-2">
                  종료 시간
                </label>
                <div className="flex gap-2">
                  <select
                    id="exclude_end_hour"
                    value={formData.exclude_end_hour || '12'}
                    onChange={(e) => onFormDataChange({ exclude_end_hour: e.target.value })}
                    className="flex-1 bg-[#FCFCFC] border border-neutral-200 hover:border-neutral-300 focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 rounded-lg px-3 py-2.5 transition-all text-sm text-neutral-900 focus:outline-none"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i.toString().padStart(2, '0')}>
                        {i.toString().padStart(2, '0')}시
                      </option>
                    ))}
                  </select>
                  <select
                    id="exclude_end_minute"
                    value={formData.exclude_end_minute || '30'}
                    onChange={(e) => onFormDataChange({ exclude_end_minute: e.target.value })}
                    className="flex-1 bg-[#FCFCFC] border border-neutral-200 hover:border-neutral-300 focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 rounded-lg px-3 py-2.5 transition-all text-sm text-neutral-900 focus:outline-none"
                  >
                    {[0, 15, 30, 45].map((m) => (
                      <option key={m} value={m.toString().padStart(2, '0')}>
                        {m.toString().padStart(2, '0')}분
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3 text-xs text-neutral-600">
              <p>
                <strong>현재 설정:</strong> {formData.exclude_start_hour || '11'}시{' '}
                {formData.exclude_start_minute || '30'}분 ~ {formData.exclude_end_hour || '12'}시{' '}
                {formData.exclude_end_minute || '30'}분
              </p>
              <p className="mt-1 text-neutral-400">
                이 시간대에 걸치는 면접 일정은 제안되지 않습니다.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-neutral-200 rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2.5">
            <Users className="size-5 text-neutral-400" />
            면접관 선택
            <span className="text-xs font-normal text-neutral-400 ml-2">(최소 1명 이상)</span>
          </h3>
          {isLoadingUsers ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-neutral-600" />
              <span className="ml-2 text-sm text-neutral-600">면접관 목록 로딩 중...</span>
            </div>
          ) : (
            <>
              <div className="flex gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-4 lg:grid-cols-5 md:overflow-x-visible">
                {users.length === 0 ? (
                  <p className="text-sm text-neutral-400 text-center py-4 w-full">
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
                          'flex flex-col items-center gap-2 p-3.5 rounded-lg transition-all min-w-[80px]',
                          isSelected
                            ? 'bg-neutral-100 ring-2 ring-neutral-900 shadow-sm'
                            : 'bg-[#FCFCFC] border border-neutral-200 hover:bg-neutral-50 hover:border-neutral-300',
                        )}
                      >
                        <Avatar
                          className={cn(
                            'w-11 h-11 border-2 transition-all',
                            isSelected ? 'border-neutral-900' : 'border-neutral-200',
                          )}
                        >
                          <AvatarFallback
                            className={cn(
                              'text-sm font-medium',
                              isSelected ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600',
                            )}
                          >
                            {user.email.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="text-center">
                          <p className="text-xs font-bold text-neutral-700 break-words">
                            {user.email.split('@')[0]}
                          </p>
                          {user.role === 'admin' && (
                            <Badge
                              variant="outline"
                              className="mt-1 text-[10px] px-1.5 py-0 border-neutral-300 text-neutral-600"
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
                <div className="bg-red-50 text-red-600 px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 mt-2">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>최소 1명의 면접관을 선택해주세요.</span>
                </div>
              )}
            </>
          )}
        </div>

        {scheduleWarning && (
          <div className="bg-amber-50/80 text-amber-800 rounded-lg p-5 border border-amber-200/60 mt-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold mb-1">일정을 찾을 수 없습니다</h4>
                <p className="text-sm">{scheduleWarning}</p>
              </div>
            </div>
          </div>
        )}

        <div className="border-t border-neutral-200 pt-4 mt-8">
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
                'px-6 py-3 text-sm font-semibold rounded-lg transition-opacity',
                isValid
                  ? ''
                  : 'opacity-50 cursor-not-allowed',
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
