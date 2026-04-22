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
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Candidate } from '@/types/candidates';
import { STAGE_ID_TO_NAME_MAP } from '@/constants/stages';
import { SchedulingStatusWidget } from '@/components/candidates/detail/SchedulingStatusWidget';

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
    scheduled_at?: string | null;
    duration_minutes?: number | null;
    interviewers?: Array<{
      id: string;
      email: string;
      name: string | null;
      avatar_url: string | null;
    }> | null;
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

  return (
    <div className="w-[280px] h-full min-h-0 overflow-y-auto bg-[#FCFCFC] border-r border-neutral-200 p-7 flex flex-col justify-between shrink-0 overscroll-contain">
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

        <SchedulingStatusWidget
          currentActiveSchedule={currentActiveSchedule}
          currentStageId={currentStageId}
          currentStageName={currentStageName}
          stages={candidate.job_posts?.processes?.stages ?? []}
          canManageCandidate={canManageCandidate}
          onCheckSchedule={onCheckSchedule}
          onDeleteSchedule={onDeleteSchedule}
          scheduleActionLoadingId={scheduleActionLoadingId}
        />
      </div>
    </div>
  );
}
