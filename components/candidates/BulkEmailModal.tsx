'use client';

import { Mail, Loader2 } from 'lucide-react';
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

interface BulkEmailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCandidates: Candidate[];
  selectedCount: number;
  subject: string;
  body: string;
  onSubjectChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  isLoading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** 일괄 이메일 발송 모달 */
export function BulkEmailModal({
  open,
  onOpenChange,
  selectedCandidates,
  selectedCount,
  subject,
  body,
  onSubjectChange,
  onBodyChange,
  isLoading,
  onConfirm,
  onCancel,
}: BulkEmailModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-sky-600" />
            일괄 이메일 발송
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <SelectedCandidatesPreview
            candidates={selectedCandidates}
            count={selectedCount}
            label="수신자"
            maxDisplay={6}
            showEmail
          />
          <div>
            <label
              htmlFor="bulk-email-subject"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              제목 <span className="text-red-500">*</span>
            </label>
            <input
              id="bulk-email-subject"
              type="text"
              value={subject}
              onChange={(e) => onSubjectChange(e.target.value)}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#5287FF]/30 focus:border-[#5287FF] transition-all"
              placeholder="이메일 제목을 입력하세요"
            />
          </div>
          <div>
            <label
              htmlFor="bulk-email-body"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              내용 <span className="text-red-500">*</span>
            </label>
            <textarea
              id="bulk-email-body"
              value={body}
              onChange={(e) => onBodyChange(e.target.value)}
              rows={8}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#5287FF]/30 focus:border-[#5287FF] transition-all resize-none"
              placeholder="이메일 내용을 입력하세요"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            취소
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading || !subject || !body}
            className="bg-gradient-to-r from-[#0248FF] to-[#5287FF] hover:from-[#0248FF]/90 hover:to-[#5287FF]/90 text-white"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                발송 중...
              </>
            ) : (
              <>
                <Mail className="w-4 h-4 mr-2" />
                {selectedCount}명에게 발송
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
