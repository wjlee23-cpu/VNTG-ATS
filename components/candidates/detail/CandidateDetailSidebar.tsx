'use client';

// 후보자 상세 좌측 사이드바 컴포넌트
// - 프로필, 현재 전형 단계, 일정 등록/입사 확정/전형 이동, 이메일/아카이브 액션을 제공
import { Mail, Archive, Calendar, CheckCircle2, Loader2, ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
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

interface CandidateDetailSidebarProps {
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
}

/** 후보자 상세 좌측: 프로필, 단계 배지, 일정 등록/전형이동/입사확정, Email/아카이브 버튼 */
export function CandidateDetailSidebar({
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
}: CandidateDetailSidebarProps) {
  // Offer 단계 여부 체크 (입사 확정 버튼 노출 여부 결정)
  const isOfferStage = currentStageName === 'Offer';

  return (
    <div className="md:col-span-4 lg:col-span-3 bg-white p-6 border-b md:border-b-0 md:border-r border-slate-100 flex flex-col overflow-y-auto">
      <div className="flex flex-col items-center md:items-start text-center md:text-left mb-6">
        <Avatar className="w-20 h-20 md:w-24 md:h-24 border-2 border-slate-200 shadow-md mb-4">
          <AvatarFallback className="bg-primary/10 text-primary text-3xl md:text-4xl font-bold">
            {candidate.name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">{candidate.name}</h1>
        {candidate.job_posts?.title && (
          <p className="text-sm md:text-base text-muted-foreground mb-3">{candidate.job_posts.title}</p>
        )}
        {currentStageId && (
          <Badge
            variant="secondary"
            className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200 text-sm font-medium px-3 py-1"
          >
            {currentStageName}
          </Badge>
        )}
      </div>

      {/* 상단 주요 액션 버튼들: 일정 등록 / 입사 확정 */}
      {canManageCandidate && (
        <Button
          onClick={onScheduleClick}
          className="w-full h-12 text-base px-4 py-3 bg-gradient-to-r from-[#0248FF] to-[#5287FF] hover:from-[#0248FF]/90 hover:to-[#5287FF]/90 text-white shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
        >
          <Calendar className="size-5 flex-shrink-0" />
          <span className="break-words">일정 등록</span>
        </Button>
      )}

      {canManageCandidate && isOfferStage && (
        <Button
          onClick={onConfirmHire}
          className="w-full h-12 mt-3 text-base px-4 py-3 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
        >
          <CheckCircle2 className="size-5 flex-shrink-0" />
          <span className="break-words">입사 확정</span>
        </Button>
      )}

      {canManageCandidate && (
        <div className="mt-4 space-y-2 w-full">
          <Button
            onClick={onEmailClick}
            variant="ghost"
            className="w-full justify-start text-slate-700 hover:bg-slate-100 hover:text-slate-900"
          >
            <Mail className="w-4 h-4 mr-2" />
            Email
          </Button>
          <Button
            onClick={onArchiveClick}
            variant="ghost"
            className="w-full justify-start text-slate-700 hover:bg-slate-100 hover:text-slate-900"
          >
            <Archive className="w-4 h-4 mr-2" />
            아카이브
          </Button>
        </div>
      )}

      {/* 전형 이동 버튼: 사이드바 하단에 고정되는 아이콘+텍스트 버튼 */}
      {canManageCandidate && !isOfferStage && (
        <div className="mt-auto pt-4">
          <DropdownMenu onOpenChange={(open) => open && onLoadStages()}>
            <DropdownMenuTrigger asChild>
              {/* Shadcn Button과 정렬 규칙을 맞춘 커스텀 버튼 */}
              <button
                type="button"
                disabled={isMovingStage}
                className="w-full h-11 px-4 rounded-lg border-2 border-blue-200 bg-white text-blue-700 hover:bg-blue-50 hover:border-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium text-sm flex items-center justify-center gap-2"
              >
                <ArrowRightLeft className="w-4 h-4 flex-shrink-0" />
                <span className="break-words">전형 이동</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-[calc(100vw-3rem)] sm:w-[var(--radix-dropdown-menu-trigger-width)] min-w-[200px] max-h-[300px] overflow-y-auto"
            >
              {isLoadingStages ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground mr-2" />
                  <span className="text-sm text-muted-foreground">단계 목록 로딩 중...</span>
                </div>
              ) : availableStages.length === 0 ? (
                <div className="py-4 text-center">
                  <p className="text-sm text-muted-foreground">이동 가능한 단계가 없습니다.</p>
                </div>
              ) : (
                availableStages.map((stage) => (
                  <DropdownMenuItem
                    key={stage.id}
                    onClick={() => onMoveToStage(stage.id)}
                    disabled={stage.isCurrent || isMovingStage}
                    className={stage.isCurrent ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span>{stage.name}</span>
                      {stage.isCurrent && (
                        <Badge variant="secondary" className="text-xs ml-2">
                          현재
                        </Badge>
                      )}
                    </div>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}
