'use client';

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { CandidateDetailClient } from '@/app/(dashboard)/candidates/[id]/CandidateDetailClient';
import { CandidateDetailSkeleton } from './CandidateDetailSkeleton';
import type { Candidate } from '@/types/candidates';

interface CandidateDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateId: string | null;
  candidate: Candidate | null;
  schedules: unknown[];
  timelineEvents: unknown[];
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
}

/** 후보자 상세를 모달(다이얼로그)로 띄우는 래퍼 */
export function CandidateDetailDialog({
  open,
  onOpenChange,
  candidateId,
  candidate,
  schedules,
  timelineEvents,
  isLoading,
  error,
  onClose,
}: CandidateDetailDialogProps) {
  const handleOpenChange = (next: boolean) => {
    if (!next) onClose();
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="!w-[95vw] !max-w-5xl !max-h-[90vh] p-0 overflow-hidden rounded-3xl shadow-2xl bg-slate-50/80 backdrop-blur-2xl [&>button]:hidden">
        <DialogTitle className="sr-only">
          {candidate
            ? `${candidate.name} 상세 정보`
            : '후보자 상세 정보'}
        </DialogTitle>
        <div className="h-full overflow-hidden">
          {isLoading ? (
            <CandidateDetailSkeleton />
          ) : error ? (
            <div className="flex items-center justify-center h-full p-8">
              <div className="text-center">
                <p className="text-destructive mb-4">{error}</p>
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors"
                >
                  닫기
                </button>
              </div>
            </div>
          ) : candidate ? (
            <CandidateDetailClient
              candidate={candidate}
              schedules={schedules}
              timelineEvents={timelineEvents}
              onClose={onClose}
              isSidebar={false}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
