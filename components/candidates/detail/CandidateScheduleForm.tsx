'use client';

// VNTG Design System 2.0 - 면접 일정 자동화 폼
// 샘플화면6.html 기반의 Settings 스타일 Split View 디자인 적용
import { useState } from 'react';
import {
  ArrowLeft,
  Sparkles,
  ChevronDown,
  Calendar,
  X,
  Plus,
  Loader2,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { STAGE_ID_TO_NAME_MAP } from '@/constants/stages';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale/ko';
import { cn } from '@/components/ui/utils';
import { CandidateSidebar } from './CandidateSidebar';
import type { Candidate } from '@/types/candidates';

const DURATION_OPTIONS = [
  { value: '30', label: '30분' },
  { value: '60', label: '60분' },
  { value: '90', label: '90분' },
  { value: '120', label: '120분' },
];

const NUM_OPTIONS_LIST = [1, 2, 3, 4];

interface ScheduleFormData {
  dateRange: { from: Date | undefined; to: Date | undefined };
  duration_minutes: string;
  stage_id: string;
  interviewer_ids: string[];
  external_interviewer_emails: string[];
  num_options: string;
  work_start_hour: string;
  work_start_minute: string;
  work_end_hour: string;
  work_end_minute: string;
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

interface StageOption {
  id: string;
  name: string;
  order: number;
  isCurrent: boolean;
}

interface CandidateScheduleFormProps {
  candidate: Candidate;
  currentStageName: string;
  currentStageId: string;
  formData: ScheduleFormData;
  onFormDataChange: (data: Partial<ScheduleFormData>) => void;
  users: UserOption[];
  externalInterviewerPool: Array<{ id: string; email: string; display_name: string | null }>;
  isLoadingUsers: boolean;
  scheduleWarning: string | null;
  isLoadingSchedule: boolean;
  isValid: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onToggleInterviewer: (userId: string) => void;
  onAddExternalInterviewer: (email: string) => void;
  onRemoveExternalInterviewer: (email: string) => void;
  onBack: () => void;
  // 사이드바 관련 (옵션)
  availableStages?: StageOption[];
  isLoadingStages?: boolean;
  isMovingStage?: boolean;
  onMoveToStage?: (stageId: string) => void;
  onLoadStages?: () => void;
  onConfirmHire?: () => void;
  onEmailClick?: () => void;
  onArchiveClick?: () => void;
}

/** 면접 일정 자동화 폼 - VNTG Design System 2.0 */
export function CandidateScheduleForm({
  candidate,
  currentStageName,
  currentStageId,
  formData,
  onFormDataChange,
  users,
  externalInterviewerPool,
  isLoadingUsers,
  scheduleWarning,
  isLoadingSchedule,
  isValid,
  onSubmit,
  onToggleInterviewer,
  onAddExternalInterviewer,
  onRemoveExternalInterviewer,
  onBack,
  availableStages = [],
  isLoadingStages = false,
  isMovingStage = false,
  onMoveToStage,
  onLoadStages,
  onConfirmHire,
  onEmailClick,
  onArchiveClick,
}: CandidateScheduleFormProps) {
  const [externalEmailInput, setExternalEmailInput] = useState('');
  // 선택된 면접관 정보 가져오기
  const selectedUsers = users.filter((user) => formData.interviewer_ids.includes(user.id));
  const selectedExternalEmails = formData.external_interviewer_emails;

  // 사용자 이름 추출 (이메일에서)
  const getUserName = (email: string) => {
    return email.split('@')[0];
  };

  // 사용자 이니셜 추출
  const getUserInitial = (email: string) => {
    return email.charAt(0).toUpperCase();
  };

  const addExternalEmailFromInput = () => {
    const normalized = externalEmailInput.trim().toLowerCase();
    if (!normalized) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalized)) return;
    onAddExternalInterviewer(normalized);
    setExternalEmailInput('');
  };

  // 날짜 범위 포맷
  const formatDateRange = () => {
    if (formData.dateRange.from && formData.dateRange.to) {
      return `${format(formData.dateRange.from, 'yyyy. MM. dd', { locale: ko })} - ${format(formData.dateRange.to, 'yyyy. MM. dd', { locale: ko })}`;
    }
    return '기간을 선택해주세요';
  };

  return (
    // 브라우저 배율(줌) 변화에 따라 보이는 화면 높이가 달라져도
    // 하단 버튼이 화면 밖으로 밀려 가려지지 않도록 "가변 높이"로 구성합니다.
    // - 기본 디자인 높이: 820px
    // - 실제 화면에서는 100dvh(동적 viewport height)를 기준으로 줄어들 수 있음
    <div className="flex h-full min-h-[calc(100dvh-2rem)] w-full max-w-[1080px] bg-white rounded-2xl shadow-[0_24px_60px_-15px_rgba(0,0,0,0.05)] border border-neutral-200 overflow-hidden font-sans">
      {/* 좌측 사이드바 */}
      <CandidateSidebar
        candidate={candidate}
        currentStageName={currentStageName}
        currentStageId={currentStageId}
        canManageCandidate={true}
        isMovingStage={isMovingStage}
        availableStages={availableStages}
        isLoadingStages={isLoadingStages}
        onScheduleClick={() => {}}
        onMoveToStage={onMoveToStage || (() => {})}
        onLoadStages={onLoadStages || (() => {})}
        onConfirmHire={onConfirmHire || (() => {})}
        onEmailClick={onEmailClick || (() => {})}
        onArchiveClick={onArchiveClick || (() => {})}
      />

      {/* 우측 폼 영역 */}
      <div className="flex-1 flex flex-col bg-white relative">
        {/* 헤더 */}
        <header className="h-16 border-b border-neutral-100 px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-1.5 -ml-1.5 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="text-sm font-semibold text-neutral-900">면접 일정 자동화</h1>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-neutral-600 bg-neutral-100 px-2.5 py-1.5 rounded-md border border-neutral-200">
            <Sparkles className="w-3.5 h-3.5 text-neutral-500" />
            AI Scheduling
          </div>
        </header>

        <form onSubmit={onSubmit} className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-8 py-10 pb-28">
            {/* 제목 및 설명 */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold tracking-tight text-neutral-900">
                스케줄링 설정
              </h2>
              <p className="text-sm text-neutral-500 mt-1">
                참석자들의 캘린더를 분석하여 겹치지 않는 최적의 일정을 후보자에게 제안합니다.
              </p>
            </div>

            {/* 폼 필드들 */}
            <div className="flex flex-col border-t border-neutral-100">
              {/* 면접 단계 */}
              <div className="py-6 border-b border-neutral-100 grid grid-cols-[200px_1fr] gap-8 items-center">
                <div>
                  <label className="text-sm font-medium text-neutral-900">면접 단계</label>
                </div>
                <div className="relative max-w-sm">
                  <select
                    value={formData.stage_id}
                    onChange={(e) => onFormDataChange({ stage_id: e.target.value })}
                    className="w-full bg-[#FCFCFC] border border-neutral-200 hover:border-neutral-300 text-neutral-900 text-sm rounded-lg px-3 py-2 focus:border-neutral-900 transition-colors cursor-pointer appearance-none focus:outline-none"
                  >
                    {Object.entries(STAGE_ID_TO_NAME_MAP).map(([id, name]) => (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-neutral-400 absolute right-3 top-2.5 pointer-events-none" />
                </div>
              </div>

              {/* 참석자 (면접관) */}
              <div className="py-6 border-b border-neutral-100 grid grid-cols-[200px_1fr] gap-8 items-start">
                <div>
                  <label className="text-sm font-medium text-neutral-900">참석자 (면접관)</label>
                  <p className="text-xs text-neutral-500 mt-1.5 leading-relaxed">
                    현재 단계에 기본 할당된 참석자입니다. 필요시 변경할 수 있습니다.
                  </p>
                </div>
                <div>
                  {isLoadingUsers ? (
                    <div className="flex items-center gap-2 text-sm text-neutral-500">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      면접관 목록 로딩 중...
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {selectedUsers.map((user) => (
                        <div
                          key={user.id}
                          className="flex items-center gap-1.5 pl-1.5 pr-2 py-1.5 bg-white border border-neutral-200 rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.02)] group hover:border-neutral-300 transition-colors"
                        >
                          <div className="w-5 h-5 rounded-full bg-neutral-900 text-white flex items-center justify-center text-[10px] font-medium">
                            {getUserInitial(user.email)}
                          </div>
                          <span className="text-xs font-medium text-neutral-900 ml-0.5">
                            {getUserName(user.email)}
                          </span>
                          {user.role && (
                            <span className="text-[10px] text-neutral-400 mr-1">{user.role}</span>
                          )}
                          <button
                            type="button"
                            onClick={() => onToggleInterviewer(user.id)}
                            className="text-neutral-300 hover:text-red-500 transition-colors rounded-full hover:bg-red-50 p-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      {selectedExternalEmails.map((email) => (
                        <div
                          key={email}
                          className="flex items-center gap-1.5 pl-1.5 pr-2 py-1.5 bg-white border border-neutral-200 rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.02)] group hover:border-neutral-300 transition-colors"
                        >
                          <div className="w-5 h-5 rounded-full bg-neutral-700 text-white flex items-center justify-center text-[10px] font-medium">
                            {getUserInitial(email)}
                          </div>
                          <span className="text-xs font-medium text-neutral-900 ml-0.5">
                            {getUserName(email)}
                          </span>
                          <span className="text-[10px] text-neutral-400 mr-1">external</span>
                          <button
                            type="button"
                            onClick={() => onRemoveExternalInterviewer(email)}
                            className="text-neutral-300 hover:text-red-500 transition-colors rounded-full hover:bg-red-50 p-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}

                      {/* 추가 버튼 */}
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-neutral-300 rounded-full hover:border-neutral-400 hover:bg-neutral-50 text-neutral-500 hover:text-neutral-900 transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span className="text-xs font-medium">추가</span>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 p-2" align="start">
                          <div className="border-b border-neutral-100 pb-2 mb-2">
                            <p className="text-[11px] text-neutral-500 mb-1">비가입 면접관 이메일 추가</p>
                            <div className="flex gap-1.5">
                              <input
                                type="email"
                                value={externalEmailInput}
                                onChange={(e) => setExternalEmailInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    addExternalEmailFromInput();
                                  }
                                }}
                                placeholder="name@example.com"
                                className="flex-1 h-8 px-2 text-xs border border-neutral-200 rounded-md focus:outline-none focus:border-neutral-400"
                              />
                              <button
                                type="button"
                                onClick={addExternalEmailFromInput}
                                className="h-8 px-2 text-xs rounded-md bg-neutral-900 text-white"
                              >
                                추가
                              </button>
                            </div>
                          </div>
                          <div className="space-y-1 max-h-64 overflow-y-auto">
                            {users
                              .filter((user) => !formData.interviewer_ids.includes(user.id))
                              .map((user) => (
                                <button
                                  key={user.id}
                                  type="button"
                                  onClick={() => onToggleInterviewer(user.id)}
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-100 rounded-md transition-colors"
                                >
                                  <div className="font-medium">{getUserName(user.email)}</div>
                                  {user.role && (
                                    <div className="text-xs text-neutral-500">{user.role}</div>
                                  )}
                                </button>
                              ))}
                            {externalInterviewerPool
                              .filter((entry) => !selectedExternalEmails.includes(entry.email))
                              .map((entry) => (
                                <button
                                  key={entry.id}
                                  type="button"
                                  onClick={() => onAddExternalInterviewer(entry.email)}
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-100 rounded-md transition-colors"
                                >
                                  <div className="font-medium">{entry.email}</div>
                                  <div className="text-xs text-neutral-500">저장된 외부 면접관</div>
                                </button>
                              ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}
                  {formData.interviewer_ids.length === 0 &&
                    formData.external_interviewer_emails.length === 0 &&
                    !isLoadingUsers && (
                    <p className="text-xs text-red-500">최소 1명의 면접관을 선택해주세요.</p>
                  )}
                </div>
              </div>

              {/* 소요 시간 */}
              <div className="py-6 border-b border-neutral-100 grid grid-cols-[200px_1fr] gap-8 items-center">
                <div>
                  <label className="text-sm font-medium text-neutral-900">소요 시간</label>
                </div>
                <div className="flex p-1 bg-neutral-100/80 rounded-lg max-w-[320px]">
                  {DURATION_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => onFormDataChange({ duration_minutes: option.value })}
                      className={cn(
                        'flex-1 py-1.5 text-xs transition-colors',
                        formData.duration_minutes === option.value
                          ? 'font-semibold bg-white text-neutral-900 rounded-md shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
                          : 'font-medium text-neutral-500 hover:text-neutral-700',
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 일정 검색 기간 */}
              <div className="py-6 border-b border-neutral-100 grid grid-cols-[200px_1fr] gap-8 items-center">
                <div>
                  <label className="text-sm font-medium text-neutral-900">일정 검색 기간</label>
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="max-w-sm w-full flex items-center justify-between bg-[#FCFCFC] border border-neutral-200 hover:border-neutral-300 text-neutral-900 text-sm rounded-lg px-3 py-2 transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-neutral-400" />
                        {formatDateRange()}
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-auto p-2 bg-white rounded-lg shadow-lg border border-neutral-200"
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

              {/* 제안할 옵션 개수 */}
              <div className="py-6 border-b border-neutral-100 grid grid-cols-[200px_1fr] gap-8 items-center">
                <div>
                  <label className="text-sm font-medium text-neutral-900">제안할 옵션 개수</label>
                  <p className="text-xs text-neutral-500 mt-1.5">후보자에게 보낼 선택지 수</p>
                </div>
                <div className="flex p-1 bg-neutral-100/80 rounded-lg max-w-[320px]">
                  {NUM_OPTIONS_LIST.map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => onFormDataChange({ num_options: num.toString() })}
                      className={cn(
                        'flex-1 py-1.5 text-xs transition-colors',
                        formData.num_options === num.toString()
                          ? 'font-semibold bg-white text-neutral-900 rounded-md shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
                          : 'font-medium text-neutral-500 hover:text-neutral-700',
                      )}
                    >
                      {num}개
                    </button>
                  ))}
                </div>
              </div>

              {/* 가능 시간 */}
              <div className="py-6 border-b border-neutral-100 grid grid-cols-[200px_1fr] gap-8 items-center">
                <div>
                  <label className="text-sm font-medium text-neutral-900">가능 시간</label>
                  <p className="text-xs text-neutral-500 mt-1.5">이 시간 안에서만 제안</p>
                </div>
                <div className="flex items-center gap-2 text-sm text-neutral-600">
                  <div className="flex items-center gap-1 bg-[#FCFCFC] border border-neutral-200 rounded-md px-2 py-1">
                    <select
                      value={formData.work_start_hour}
                      onChange={(e) => onFormDataChange({ work_start_hour: e.target.value })}
                      className="bg-transparent font-medium focus:outline-none cursor-pointer text-sm"
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i.toString().padStart(2, '0')}>
                          {i}
                        </option>
                      ))}
                    </select>
                    <span className="text-neutral-400">:</span>
                    <select
                      value={formData.work_start_minute}
                      onChange={(e) => onFormDataChange({ work_start_minute: e.target.value })}
                      className="bg-transparent font-medium focus:outline-none cursor-pointer text-sm"
                    >
                      {[0, 15, 30, 45].map((m) => (
                        <option key={m} value={m.toString().padStart(2, '0')}>
                          {m.toString().padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                  </div>
                  <span>부터</span>
                  <div className="flex items-center gap-1 bg-[#FCFCFC] border border-neutral-200 rounded-md px-2 py-1">
                    <select
                      value={formData.work_end_hour}
                      onChange={(e) => onFormDataChange({ work_end_hour: e.target.value })}
                      className="bg-transparent font-medium focus:outline-none cursor-pointer text-sm"
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i.toString().padStart(2, '0')}>
                          {i}
                        </option>
                      ))}
                    </select>
                    <span className="text-neutral-400">:</span>
                    <select
                      value={formData.work_end_minute}
                      onChange={(e) => onFormDataChange({ work_end_minute: e.target.value })}
                      className="bg-transparent font-medium focus:outline-none cursor-pointer text-sm"
                    >
                      {[0, 15, 30, 45].map((m) => (
                        <option key={m} value={m.toString().padStart(2, '0')}>
                          {m.toString().padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                  </div>
                  <span>까지</span>
                  <span className="ml-2 text-xs text-neutral-400">KST 기준</span>
                </div>
              </div>

              {/* 제외 시간 */}
              <div className="py-6 grid grid-cols-[200px_1fr] gap-8 items-center">
                <div>
                  <label className="text-sm font-medium text-neutral-900">제외 시간</label>
                  <p className="text-xs text-neutral-500 mt-1.5">점심시간 등 스케줄링 제외</p>
                </div>
                <div className="flex items-center gap-2 text-sm text-neutral-600">
                  <div className="flex items-center gap-1 bg-[#FCFCFC] border border-neutral-200 rounded-md px-2 py-1">
                    <select
                      value={formData.exclude_start_hour}
                      onChange={(e) => onFormDataChange({ exclude_start_hour: e.target.value })}
                      className="bg-transparent font-medium focus:outline-none cursor-pointer text-sm"
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i.toString().padStart(2, '0')}>
                          {i}
                        </option>
                      ))}
                    </select>
                    <span className="text-neutral-400">:</span>
                    <select
                      value={formData.exclude_start_minute}
                      onChange={(e) => onFormDataChange({ exclude_start_minute: e.target.value })}
                      className="bg-transparent font-medium focus:outline-none cursor-pointer text-sm"
                    >
                      {[0, 15, 30, 45].map((m) => (
                        <option key={m} value={m.toString().padStart(2, '0')}>
                          {m.toString().padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                  </div>
                  <span>부터</span>
                  <div className="flex items-center gap-1 bg-[#FCFCFC] border border-neutral-200 rounded-md px-2 py-1">
                    <select
                      value={formData.exclude_end_hour}
                      onChange={(e) => onFormDataChange({ exclude_end_hour: e.target.value })}
                      className="bg-transparent font-medium focus:outline-none cursor-pointer text-sm"
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i.toString().padStart(2, '0')}>
                          {i}
                        </option>
                      ))}
                    </select>
                    <span className="text-neutral-400">:</span>
                    <select
                      value={formData.exclude_end_minute}
                      onChange={(e) => onFormDataChange({ exclude_end_minute: e.target.value })}
                      className="bg-transparent font-medium focus:outline-none cursor-pointer text-sm"
                    >
                      {[0, 15, 30, 45].map((m) => (
                        <option key={m} value={m.toString().padStart(2, '0')}>
                          {m.toString().padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                  </div>
                  <span>까지</span>
                </div>
              </div>
            </div>

            {/* 경고 메시지 */}
            {scheduleWarning && (
              <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">{scheduleWarning}</p>
              </div>
            )}
          </div>

          {/* 하단 고정 액션 바 */}
          <div className="absolute bottom-0 left-0 right-0 p-5 bg-white/90 backdrop-blur-md border-t border-neutral-100 flex justify-end gap-3 z-10">
            <button
              type="button"
              onClick={onBack}
              disabled={isLoadingSchedule}
              className="px-5 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={!isValid || isLoadingSchedule}
              className="px-5 py-2.5 text-sm font-medium bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 shadow-[0_4px_14px_0_rgba(0,0,0,0.2)] transition-all active:scale-[0.98] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoadingSchedule ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  처리 중...
                </>
              ) : (
                <>
                  {/* 버튼 옆 화살표 아이콘은 제거하고 텍스트만 표시합니다. */}
                  자동화 시작
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
