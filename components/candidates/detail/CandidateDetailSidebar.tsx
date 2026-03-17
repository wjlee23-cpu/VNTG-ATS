"use client";

// 후보자 상세 좌측 사이드바 컴포넌트
// - 프로필, 현재 전형 단계, 일정 등록/입사 확정/전형 이동, 이메일/아카이브 액션을 제공
import {
  Mail,
  Archive,
  Calendar,
  CheckCircle2,
  Loader2,
  MoveRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Candidate } from "@/types/candidates";

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
  const isOfferStage = currentStageName === "Offer";

  return (
    <div className="md:col-span-4 lg:col-span-3 bg-white p-6 border-b md:border-b-0 md:border-r border-neutral-200 flex flex-col overflow-y-auto min-w-[280px]">
      <div className="flex flex-col items-center md:items-start text-center md:text-left mb-6">
        <Avatar className="w-20 h-20 md:w-24 md:h-24 border-2 border-neutral-200 shadow-md mb-4">
          <AvatarFallback className="bg-neutral-100 text-neutral-900 text-3xl md:text-4xl font-bold">
            {candidate.name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <h1 className="text-2xl md:text-3xl font-bold text-neutral-900 mb-2">
          {candidate.name}
        </h1>
        {candidate.job_posts?.title && (
          <p className="text-sm md:text-base text-neutral-600 mb-3">
            {candidate.job_posts.title}
          </p>
        )}
        {currentStageId && (
          <Badge
            variant="default"
            className="text-sm font-medium px-3 py-1"
          >
            {currentStageName}
          </Badge>
        )}
      </div>

      {/* 상단 주요 액션 버튼들: 일정 등록 / 입사 확정 (DS 2.0: 블랙 Primary) */}
      {canManageCandidate && (
        <Button
          onClick={onScheduleClick}
          className="w-full h-12 text-base px-4 py-3 flex items-center justify-center gap-2"
        >
          <Calendar className="size-5 flex-shrink-0" />
          <span className="whitespace-nowrap flex-shrink-0">일정 등록</span>
        </Button>
      )}

      {canManageCandidate && isOfferStage && (
        <Button
          onClick={onConfirmHire}
          className="w-full h-12 mt-3 text-base px-4 py-3 flex items-center justify-center gap-2"
        >
          <CheckCircle2 className="size-5 flex-shrink-0" />
          <span className="whitespace-nowrap flex-shrink-0">입사 확정</span>
        </Button>
      )}

      {canManageCandidate && (
        <div className="mt-4 space-y-2 w-full">
          {/* 전형 이동 버튼 */}
          {!isOfferStage && (
            <DropdownMenu onOpenChange={(open) => open && onLoadStages()}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  disabled={isMovingStage}
                  className="w-full justify-start"
                >
                  <MoveRight className="w-4 h-4 mr-2 flex-shrink-0" />
                  전형 이동
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="w-[calc(100vw-3rem)] sm:w-[var(--radix-dropdown-menu-trigger-width)] min-w-[200px] max-h-[300px] overflow-y-auto"
              >
                {isLoadingStages ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground mr-2" />
                    <span className="text-sm text-muted-foreground">
                      단계 목록 로딩 중...
                    </span>
                  </div>
                ) : availableStages.length === 0 ? (
                  <div className="py-4 text-center">
                    <p className="text-sm text-muted-foreground">
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
                          ? "opacity-50 cursor-not-allowed"
                          : "cursor-pointer"
                      }
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
          )}

          <Button
            onClick={onEmailClick}
            variant="ghost"
            className="w-full justify-start"
          >
            <Mail className="w-4 h-4 mr-2" />
            Email
          </Button>
          <Button
            onClick={onArchiveClick}
            variant="ghost"
            className="w-full justify-start"
          >
            <Archive className="w-4 h-4 mr-2" />
            아카이브
          </Button>
        </div>
      )}
    </div>
  );
}
