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
    workflow_status:
      | 'pending_interviewers'
      | 'pending_candidate'
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
  const hasActive = !!currentActiveSchedule;
  const isActionLoading =
    !!(scheduleActionLoadingId && currentActiveSchedule && scheduleActionLoadingId === currentActiveSchedule.id);
  const canInteract = canManageCandidate && hasActive && !isActionLoading;

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

          <div className="relative border-l border-neutral-200 ml-2.5 space-y-5">
            <div className="relative pl-5">
              <div className="absolute -left-[5px] top-1 w-[9px] h-[9px] rounded-full bg-neutral-900 ring-4 ring-[#FCFCFC]"></div>
              <p className="text-xs font-medium text-neutral-500">
                {hasActive ? '최적 일정 탐색 완료(또는 진행 중)' : '진행 중인 스케줄 없음'}
              </p>
            </div>

            <div className="relative pl-5">
              <div className="absolute -left-[5px] top-1 w-[9px] h-[9px] rounded-full bg-blue-500 ring-4 ring-blue-50 animate-pulse"></div>
              <p className="text-xs font-bold text-blue-600">
                {(() => {
                  const s = currentActiveSchedule?.workflow_status;
                  switch (s) {
                    case 'pending_interviewers':
                      return '면접관 수락 대기중';
                    case 'pending_candidate':
                      return '후보자 선택 대기중';
                    case 'needs_rescheduling':
                      return '재조율 필요';
                    case 'confirmed':
                      return '확정됨';
                    case 'cancelled':
                      return '취소됨';
                    default:
                      return hasActive ? '진행 중' : '대기 중';
                  }
                })()}
              </p>
              <p className="text-[10px] text-neutral-400 font-medium mt-1 tracking-wide">
                {hasActive ? '상태를 확인하거나 수동 개입할 수 있습니다' : '새 일정을 생성하면 여기에 표시됩니다'}
              </p>
            </div>
          </div>

          {/* 하단 컨트롤 바: 스크롤 시에도 사이드바 내부 하단에 고정되도록 sticky 사용 */}
          <div className="sticky bottom-0 left-0 right-0 p-4 bg-white rounded-xl border border-neutral-100 shadow-[0_-10px_20px_-5px_rgba(0,0,0,0.03)] flex flex-col gap-2.5 z-10">
            <button
              className="w-full flex items-center justify-center gap-2 bg-neutral-900 text-white rounded-lg py-2 px-3 text-xs font-semibold hover:bg-neutral-800 transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => hasActive && onCheckSchedule && onCheckSchedule(currentActiveSchedule!.id)}
              disabled={!canInteract || !onCheckSchedule}
              title={hasActive ? '면접관 응답 상태를 확인합니다.' : '진행 중인 스케줄이 없습니다.'}
            >
              {isActionLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-neutral-300" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 text-neutral-300" />
              )}
              일정 확인 / 수동 개입
            </button>

            <button
              className="w-full flex items-center justify-center gap-1.5 py-1 text-xs font-medium text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => {
                if (!hasActive || !onDeleteSchedule) return;
                if (!confirm('이 면접 일정을 완전 삭제할까요? 이 작업은 되돌릴 수 없습니다.')) return;
                if (!confirm('정말로 삭제하시겠습니까? 연관 일정 옵션/캘린더 블록도 함께 정리될 수 있습니다.')) return;
                onDeleteSchedule(currentActiveSchedule!.id);
              }}
              disabled={!canManageCandidate || !hasActive || isActionLoading || !onDeleteSchedule}
              title={hasActive ? '현재 스케줄링을 완전 삭제합니다.' : '진행 중인 스케줄이 없습니다.'}
            >
              <Trash2 className="w-3.5 h-3.5" />
              현재 스케줄링 완전 삭제
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
