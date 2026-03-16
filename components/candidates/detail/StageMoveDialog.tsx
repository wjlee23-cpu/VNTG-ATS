'use client';

import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

interface StageOption {
  id: string;
  name: string;
  order: number;
  isCurrent: boolean;
}

interface StageMoveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableStages: StageOption[];
  isLoadingStages: boolean;
  isMovingStage: boolean;
  onMoveToStage: (stageId: string) => void;
}

/** 전형 단계 이동 선택 다이얼로그 */
export function StageMoveDialog({
  open,
  onOpenChange,
  availableStages,
  isLoadingStages,
  isMovingStage,
  onMoveToStage,
}: StageMoveDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>전형 단계 선택</DialogTitle>
        </DialogHeader>
        <div className="space-y-1 py-2">
          {isLoadingStages ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mr-2" />
              <span className="text-sm text-muted-foreground">단계 목록 로딩 중...</span>
            </div>
          ) : availableStages.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-sm text-muted-foreground">이동 가능한 단계가 없습니다.</p>
            </div>
          ) : (
            availableStages.map((stage) => (
              <button
                key={stage.id}
                onClick={() => onMoveToStage(stage.id)}
                disabled={stage.isCurrent || isMovingStage}
                className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  stage.isCurrent
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'hover:bg-blue-50 hover:text-blue-700 text-slate-700 cursor-pointer'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{stage.name}</span>
                  {stage.isCurrent && (
                    <Badge variant="secondary" className="text-xs ml-2">
                      현재
                    </Badge>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
