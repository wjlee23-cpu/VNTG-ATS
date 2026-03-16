'use client';

import { Archive, Loader2 } from 'lucide-react';
import { ARCHIVE_REASONS } from '@/constants/archive-reasons';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { SelectedCandidatesPreview } from './SelectedCandidatesPreview';
import type { Candidate } from '@/types/candidates';

interface BulkArchiveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCandidates: Candidate[];
  selectedCount: number;
  reason: string;
  onReasonChange: (value: string) => void;
  isLoading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** 일괄 아카이브 모달 */
export function BulkArchiveModal({
  open,
  onOpenChange,
  selectedCandidates,
  selectedCount,
  reason,
  onReasonChange,
  isLoading,
  onConfirm,
  onCancel,
}: BulkArchiveModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Archive className="w-5 h-5 text-orange-600" />
            일괄 아카이브
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <SelectedCandidatesPreview
            candidates={selectedCandidates}
            count={selectedCount}
            label="선택된 후보자"
            maxDisplay={8}
          />
          <p className="text-xs text-slate-500">
            아카이브된 후보자는 기본 목록에서 제외되지만, 필터를 통해 조회할 수
            있습니다.
          </p>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              아카이브 사유 <span className="text-red-500">*</span>
            </label>
            <select
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#5287FF]/30 focus:border-[#5287FF] transition-all"
            >
              <option value="">사유를 선택하세요</option>
              {ARCHIVE_REASONS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
            {reason && (
              <p className="mt-1.5 text-xs text-slate-500">
                {ARCHIVE_REASONS.find((r) => r.id === reason)?.description}
              </p>
            )}
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            취소
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading || !reason}
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                처리 중...
              </>
            ) : (
              <>
                <Archive className="w-4 h-4 mr-2" />
                {selectedCount}명 아카이브
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
