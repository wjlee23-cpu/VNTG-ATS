'use client';

import { MoveRight, Check, Loader2 } from 'lucide-react';
import { STAGE_ID_TO_NAME_MAP } from '@/constants/stages';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { SelectedCandidatesPreview } from './SelectedCandidatesPreview';
import { cn } from '@/components/ui/utils';
import type { Candidate } from '@/types/candidates';

interface BulkMoveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCandidates: Candidate[];
  selectedCount: number;
  targetStageId: string;
  onTargetStageChange: (stageId: string) => void;
  isLoading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** 전형 이동 모달 */
export function BulkMoveModal({
  open,
  onOpenChange,
  selectedCandidates,
  selectedCount,
  targetStageId,
  onTargetStageChange,
  isLoading,
  onConfirm,
  onCancel,
}: BulkMoveModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-center gap-2 sm:justify-start">
            <MoveRight className="w-5 h-5 text-violet-600 shrink-0" />
            <span className="truncate">전형 이동</span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <SelectedCandidatesPreview
            candidates={selectedCandidates}
            count={selectedCount}
            label="선택된 후보자"
            maxDisplay={8}
          />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              이동할 전형 단계 <span className="text-red-500">*</span>
            </label>
            <div className="space-y-1.5">
              {Object.entries(STAGE_ID_TO_NAME_MAP).map(
                ([stageId, stageName]) => {
                  const isSelected = targetStageId === stageId;
                  return (
                    <button
                      key={stageId}
                      type="button"
                      onClick={() => onTargetStageChange(stageId)}
                      className={cn(
                        'w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-all border',
                        isSelected
                          ? 'bg-[#5287FF]/10 border-[#5287FF]/30 text-[#5287FF] ring-1 ring-[#5287FF]/20'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300',
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span>{stageName}</span>
                        {isSelected && (
                          <Check className="w-4 h-4 text-[#5287FF]" />
                        )}
                      </div>
                    </button>
                  );
                },
              )}
            </div>
          </div>
        </div>
        <DialogFooter className="w-full flex flex-col gap-2 pt-4 border-t border-slate-100 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
            className="w-full sm:w-auto whitespace-nowrap"
          >
            취소
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading || !targetStageId}
            className="w-full sm:w-auto whitespace-nowrap bg-gradient-to-r from-[#0248FF] to-[#5287FF] hover:from-[#0248FF]/90 hover:to-[#5287FF]/90 text-white"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                이동 중...
              </>
            ) : (
              <>{selectedCount}명 전형 이동</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
