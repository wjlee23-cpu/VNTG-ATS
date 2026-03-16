'use client';

import { Mail, Archive, Calendar, ArrowRightCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import type { Candidate } from '@/types/candidates';

interface CandidateDetailSidebarProps {
  candidate: Candidate;
  currentStageName: string;
  currentStageId: string;
  canManageCandidate: boolean;
  isMovingStage: boolean;
  onScheduleClick: () => void;
  onMoveStageClick: () => void;
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
  onScheduleClick,
  onMoveStageClick,
  onConfirmHire,
  onEmailClick,
  onArchiveClick,
}: CandidateDetailSidebarProps) {
  const isOfferStage = currentStageName === 'Offer';

  return (
    <div className="md:col-span-4 lg:col-span-3 bg-white p-6 border-b md:border-b-0 md:border-r border-slate-100 flex flex-col min-w-0 overflow-y-auto">
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

        {canManageCandidate && (
          <Button
            onClick={onScheduleClick}
            className="w-full h-12 text-base whitespace-normal break-keep px-4 py-3 bg-gradient-to-r from-[#0248FF] to-[#5287FF] hover:from-[#0248FF]/90 hover:to-[#5287FF]/90 text-white shadow-md hover:shadow-lg transition-all duration-200"
          >
            <Calendar className="size-5 mr-2 flex-shrink-0" />
            <span className="break-words">일정 등록</span>
          </Button>
        )}

        {canManageCandidate &&
          (isOfferStage ? (
            <Button
              onClick={onConfirmHire}
              className="w-full h-12 mt-3 text-base whitespace-normal break-keep px-4 py-3 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white shadow-md hover:shadow-lg transition-all duration-200"
            >
              <CheckCircle2 className="size-5 mr-2 flex-shrink-0" />
              <span className="break-words">입사 확정</span>
            </Button>
          ) : (
            <Button
              onClick={onMoveStageClick}
              disabled={isMovingStage}
              className="w-full h-12 mt-3 text-base whitespace-normal break-keep px-4 py-3 bg-gradient-to-r from-[#0248FF] to-[#5287FF] hover:from-[#0248FF]/90 hover:to-[#5287FF]/90 text-white shadow-md hover:shadow-lg transition-all duration-200"
            >
              <ArrowRightCircle className="size-5 mr-2 flex-shrink-0" />
              <span className="break-words">{isMovingStage ? '이동 중...' : '전형이동'}</span>
            </Button>
          ))}

        {canManageCandidate && (
          <div className="mt-4 space-y-2 min-w-0 w-full">
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
    </div>
  );
}
