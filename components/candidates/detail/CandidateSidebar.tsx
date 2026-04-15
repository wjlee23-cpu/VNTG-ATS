'use client';

// VNTG Design System 2.0 - 후보자 상세 좌측 사이드바 컴포넌트
// HTML 샘플 기반의 초미니멀리즘 디자인 적용
import {
  CalendarPlus,
  GitMerge,
  Mail,
  Archive,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Trash2,
  Sparkles,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Candidate } from '@/types/candidates';
import { STAGE_ID_TO_NAME_MAP } from '@/constants/stages';

interface StageOption {
  id: string;
  name: string;
  order: number;
  isCurrent: boolean;
}

interface CandidateSidebarProps {
  candidate: Candidate;
  currentStageName: string;
  currentStageId: string;
  canManageCandidate: boolean;
  isMovingStage: boolean;
  availableStages: StageOption[];
  isLoadingStages: boolean;
  onScheduleClick: () => void;
  onMoveToStage: (stageId: string) => void;
  onLoadStages: () => void;
  onConfirmHire: () => void;
  onEmailClick: () => void;
  onArchiveClick: () => void;
  currentActiveSchedule?: {
    id: string;
    stage_id?: string | null;
    workflow_status:
      | 'pending_interviewers'
      | 'pending_candidate'
      | 'regenerating'
      | 'confirmed'
      | 'cancelled'
      | 'needs_rescheduling'
      | null;
  } | null;
  onCheckSchedule?: (scheduleId: string) => void;
  onDeleteSchedule?: (scheduleId: string) => void;
  scheduleActionLoadingId?: string | null;
}

/** 후보자 상세 좌측 사이드바 - VNTG Design System 2.0 */
export function CandidateSidebar({
  candidate,
  currentStageName,
  currentStageId,
  canManageCandidate,
  isMovingStage,
  availableStages,
  isLoadingStages,
  onScheduleClick,
  onMoveToStage,
  onLoadStages,
  onConfirmHire,
  onEmailClick,
  onArchiveClick,
  currentActiveSchedule = null,
  onCheckSchedule,
  onDeleteSchedule,
  scheduleActionLoadingId = null,
}: CandidateSidebarProps) {
  // Offer 단계 여부 체크 (입사 확정 버튼 노출 여부 결정)
  const isOfferStage = currentStageName === 'Offer';
  
  // 후보자 이름의 첫 글자 추출 (아바타용)
  const avatarInitial = candidate.name.charAt(0).toUpperCase();
  
  // 직책 정보 (job_posts.title 또는 기본값)
  const jobTitle = candidate.job_posts?.title || '';

  // 컨트롤러 버튼 활성/비활성
  const hasSchedule = !!currentActiveSchedule;
  const isActionLoading =
    !!(scheduleActionLoadingId && currentActiveSchedule && scheduleActionLoadingId === currentActiveSchedule.id);
  const canInteract = canManageCandidate && hasSchedule && !isActionLoading;

  const workflowStatus = currentActiveSchedule?.workflow_status;
  const isConfirmed = workflowStatus === 'confirmed';
  const isCancelled = workflowStatus === 'cancelled';
  const isNeedsRescheduling = workflowStatus === 'needs_rescheduling';
  const isRegenerating = workflowStatus === 'regenerating';
  const isPendingCandidate = workflowStatus === 'pending_candidate';
  const isPendingInterviewers = workflowStatus === 'pending_interviewers';

  const activeScheduleStageName = (() => {
    const stageId = currentActiveSchedule?.stage_id;
    if (!stageId) return null;

    const jobStages = candidate.job_posts?.processes?.stages;
    const customStageName = jobStages?.find((s) => s.id === stageId)?.name;
    if (customStageName && customStageName.trim() !== '') return customStageName;

    if (STAGE_ID_TO_NAME_MAP[stageId]) return STAGE_ID_TO_NAME_MAP[stageId];

    return stageId;
  })();

  const getStepState = (step: 'interviewers' | 'candidate' | 'confirmed') => {
    // ✅ 직관적인 3단계: 면접관 → 후보자 → 확정
    // - 확정되면 모두 완료
    // - 후보자 선택 대기면 면접관은 완료, 후보자 진행, 확정 대기
    // - 면접관 대기면 면접관 진행, 나머지 대기
    if (!hasSchedule) return 'pending' as const;
    if (isCancelled) return 'pending' as const;
    if (isConfirmed) return 'done' as const;
    if (isPendingCandidate) {
      if (step === 'interviewers') return 'done' as const;
      if (step === 'candidate') return 'doing' as const;
      return 'pending' as const;
    }
    if (isPendingInterviewers || isRegenerating) {
      if (step === 'interviewers') return 'doing' as const;
      return 'pending' as const;
    }
    if (isNeedsRescheduling) {
      if (step === 'interviewers') return 'done' as const;
      if (step === 'candidate') return 'doing' as const;
      return 'pending' as const;
    }
    // 처리하지 않은 workflow_status는 면접관 단계를 진행 중으로 표시하지 않습니다.
    return 'pending' as const;
  };

  return (
    <div className="w-[280px] bg-[#FCFCFC] border-r border-neutral-200 p-7 flex flex-col justify-between shrink-0">
      <div>
        {/* 프로필 영역 */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-full bg-neutral-900 text-white flex items-center justify-center text-lg font-semibold tracking-tight">
            {avatarInitial}
          </div>
          <div>
            <h2 className="text-base font-semibold tracking-tight text-neutral-900">
              {candidate.name}
            </h2>
            {jobTitle && (
              <p className="text-sm text-neutral-500 font-medium">{jobTitle}</p>
            )}
          </div>
        </div>

        {/* 일정 등록 버튼 */}
        {canManageCandidate && (
          <button
            onClick={onScheduleClick}
            className="w-full flex items-center justify-center gap-2 bg-neutral-900 text-white rounded-lg py-2.5 px-4 text-sm font-medium hover:bg-neutral-800 transition-colors active:scale-[0.98]"
          >
            <CalendarPlus className="w-4 h-4 text-neutral-300" />
            일정 등록
          </button>
        )}

        {/* 입사 확정 버튼 (Offer 단계일 때만) */}
        {canManageCandidate && isOfferStage && (
          <button
            onClick={onConfirmHire}
            className="w-full flex items-center justify-center gap-2 bg-neutral-900 text-white rounded-lg py-2.5 px-4 text-sm font-medium hover:bg-neutral-800 transition-colors active:scale-[0.98] mt-3"
          >
            <CheckCircle2 className="w-4 h-4 text-neutral-300" />
            입사 확정
          </button>
        )}

        {/* 액션 메뉴 */}
        {canManageCandidate && (
          <div className="mt-8 flex flex-col gap-0.5">
            {/* 전형 이동 */}
            {!isOfferStage && (
              <DropdownMenu onOpenChange={(open) => open && onLoadStages()}>
                <DropdownMenuTrigger asChild>
                  <button
                    disabled={isMovingStage}
                    className="flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium text-neutral-600 hover:bg-neutral-100 transition-colors w-full group"
                  >
                    <div className="flex items-center gap-3">
                      <GitMerge className="w-4 h-4 text-neutral-400 group-hover:text-neutral-900 transition-colors" />
                      전형 이동
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-[calc(100vw-3rem)] sm:w-[var(--radix-dropdown-menu-trigger-width)] min-w-[200px] max-h-[300px] overflow-y-auto"
                >
                  {isLoadingStages ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-4 h-4 animate-spin text-neutral-400 mr-2" />
                      <span className="text-sm text-neutral-500">
                        단계 목록 로딩 중...
                      </span>
                    </div>
                  ) : availableStages.length === 0 ? (
                    <div className="py-4 text-center">
                      <p className="text-sm text-neutral-500">
                        이동 가능한 단계가 없습니다.
                      </p>
                    </div>
                  ) : (
                    availableStages.map((stage) => (
                      <DropdownMenuItem
                        key={stage.id}
                        onClick={() => onMoveToStage(stage.id)}
                        disabled={stage.isCurrent || isMovingStage}
                        className={
                          stage.isCurrent
                            ? 'opacity-50 cursor-not-allowed'
                            : 'cursor-pointer'
                        }
                      >
                        <div className="flex items-center justify-between w-full">
                          <span>{stage.name}</span>
                          {stage.isCurrent && (
                            <span className="text-xs text-neutral-400 ml-2">
                              현재
                            </span>
                          )}
                        </div>
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* 이메일 */}
            <button
              onClick={onEmailClick}
              className="flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium text-neutral-600 hover:bg-neutral-100 transition-colors w-full group"
            >
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-neutral-400 group-hover:text-neutral-900 transition-colors" />
                이메일
              </div>
            </button>

            {/* 아카이브 */}
            <button
              onClick={onArchiveClick}
              className="flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium text-neutral-600 hover:bg-neutral-100 transition-colors w-full group"
            >
              <div className="flex items-center gap-3">
                <Archive className="w-4 h-4 text-neutral-400 group-hover:text-neutral-900 transition-colors" />
                아카이브
              </div>
            </button>
          </div>
        )}

        {/* AI 스케줄링 코파일럿 컨트롤러 */}
        {/* 하단 버튼 영역과 겹치지 않도록 충분한 패딩을 부여합니다. */}
        <div className="pt-6 border-t border-neutral-200/60 flex-1 relative mt-6 pb-28">
          <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider mb-5 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            AI 스케줄링 코파일럿
          </h3>

          <div className="space-y-3">
            <div className="rounded-xl border border-neutral-200/60 bg-white p-4 shadow-[0_6px_18px_-10px_rgba(0,0,0,0.15)]">
              <p className="text-xs font-semibold text-neutral-900">
                {!hasSchedule
                  ? '등록된 일정이 없습니다'
                  : isConfirmed
                    ? '일정이 확정되었습니다'
                    : isCancelled
                      ? '일정이 취소되었습니다'
                      : '일정 조율 중'}
              </p>
              {hasSchedule && activeScheduleStageName && (
                <p className="text-[10px] text-neutral-600 mt-1">
                  단계: <span className="font-medium text-neutral-800">{activeScheduleStageName}</span>
                </p>
              )}
              <p className="text-[10px] text-neutral-500 mt-1">
                {!hasSchedule
                  ? '상단의 “일정 등록”에서 시작할 수 있어요.'
                  : isRegenerating
                    ? '면접관 응답을 반영해 옵션을 다시 만들고 있어요.'
                    : isNeedsRescheduling
                      ? '전원 수락 옵션이 없어 다시 조율이 필요해요.'
                      : isPendingCandidate
                        ? '면접관 응답이 완료되어, 후보자 선택을 기다리고 있어요.'
                        : isPendingInterviewers
                          ? '면접관 응답을 기다리고 있어요.'
                          : '상태를 확인하는 중이에요.'}
              </p>
            </div>

            <div className="rounded-xl border border-neutral-200/60 bg-[#FCFCFC] p-4">
              <div className="space-y-3">
                {(
                  [
                    { key: 'interviewers', label: '면접관', hint: isRegenerating ? '옵션 재생성 중' : '일정 수락/거절' },
                    { key: 'candidate', label: '후보자', hint: isNeedsRescheduling ? '재조율 필요' : '일정 선택' },
                    { key: 'confirmed', label: '확정', hint: '최종 확정' },
                  ] as const
                ).map((step) => {
                  const state = getStepState(step.key);
                  return (
                    <div key={step.key} className="flex items-center gap-3">
                      <div className="w-5 h-5 flex items-center justify-center shrink-0">
                        {state === 'done' ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        ) : state === 'doing' ? (
                          <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                        ) : (
                          <div className="w-2.5 h-2.5 rounded-full bg-neutral-300" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p
                            className={[
                              'text-sm font-semibold',
                              state === 'done'
                                ? 'text-neutral-900'
                                : state === 'doing'
                                  ? 'text-indigo-700'
                                  : 'text-neutral-500',
                            ].join(' ')}
                          >
                            {step.label}
                          </p>
                          <span
                            className={[
                              'text-[10px] font-medium',
                              state === 'done'
                                ? 'text-emerald-700'
                                : state === 'doing'
                                  ? 'text-indigo-600'
                                  : 'text-neutral-400',
                            ].join(' ')}
                          >
                            {state === 'done' ? '완료' : state === 'doing' ? '진행중' : '대기'}
                          </span>
                        </div>
                        <p className="text-[10px] text-neutral-500 mt-0.5">{step.hint}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 하단 컨트롤 바: 스크롤 시에도 사이드바 내부 하단에 고정되도록 sticky 사용 */}
          <div className="sticky bottom-0 left-0 right-0 p-4 bg-white rounded-xl border border-neutral-100 shadow-[0_-10px_20px_-5px_rgba(0,0,0,0.03)] flex flex-col gap-2.5 z-10">
            <button
              className="w-full flex items-center justify-center gap-2 bg-neutral-900 text-white rounded-lg py-2 px-3 text-xs font-semibold hover:bg-neutral-800 transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => hasSchedule && onCheckSchedule && onCheckSchedule(currentActiveSchedule!.id)}
              disabled={!canInteract || !onCheckSchedule}
              title={
                hasSchedule
                  ? '진행 상태를 최신으로 맞춥니다.'
                  : '진행 중인 스케줄이 없습니다.'
              }
            >
              {isActionLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-neutral-300" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 text-neutral-300" />
              )}
              진행 상태 새로고침
            </button>

            <button
              className="w-full flex items-center justify-center gap-1.5 py-1 text-xs font-medium text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => {
                if (!hasSchedule || !onDeleteSchedule) return;
                if (!confirm('이 일정을 삭제할까요? 되돌릴 수 없습니다.')) return;
                if (!confirm('정말 삭제할까요? 관련 옵션/캘린더 일정도 함께 정리될 수 있어요.')) return;
                onDeleteSchedule(currentActiveSchedule!.id);
              }}
              disabled={!canManageCandidate || !hasSchedule || isActionLoading || !onDeleteSchedule}
              title={hasSchedule ? '현재 일정을 삭제합니다.' : '진행 중인 스케줄이 없습니다.'}
            >
              <Trash2 className="w-3.5 h-3.5" />
              일정 삭제
            </button>
          </div>
        </div>
      </div>

      {/* 현재 상태 표시 */}
      <div className="px-3 py-3 rounded-md bg-neutral-100/50 border border-neutral-200/50 flex items-start gap-2">
        <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0"></div>
        <div>
          <p className="text-xs font-semibold text-neutral-700">현재 상태</p>
          <p className="text-xs text-neutral-500 mt-0.5">{currentStageName}</p>
        </div>
      </div>
    </div>
  );
}
