'use client';

import { useState } from 'react';
import { Archive, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { archiveCandidate } from '@/api/actions/candidates-archive';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ARCHIVE_REASONS } from '@/constants/archive-reasons';

interface ArchiveCandidateModalProps {
  candidateId: string;
  candidateName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ArchiveCandidateModal({
  candidateId,
  candidateName,
  isOpen,
  onClose,
}: ArchiveCandidateModalProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedReason) {
      toast.error('아카이브 사유를 선택해주세요.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await archiveCandidate(candidateId, selectedReason);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('후보자가 아카이브되었습니다.');
        setSelectedReason('');
        onClose();
        router.refresh();
      }
    } catch (error) {
      toast.error('아카이브 처리 중 오류가 발생했습니다.');
      console.error('Archive error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Archive className="w-5 h-5 text-orange-600" />
            후보자 아카이브
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <p className="text-sm text-gray-600 mb-3">
              <span className="font-semibold">{candidateName}</span>님을 아카이브하시겠습니까?
            </p>
            <p className="text-xs text-gray-500 mb-4">
              아카이브된 후보자는 기본 목록에서 제외되지만, 필터를 통해 조회할 수 있습니다.
            </p>
          </div>

          <div>
            <label htmlFor="archive-reason" className="block text-sm font-medium text-gray-700 mb-2">
              아카이브 사유 <span className="text-red-500">*</span>
            </label>
            <select
              id="archive-reason"
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">사유를 선택하세요</option>
              {ARCHIVE_REASONS.map((reason) => (
                <option key={reason.id} value={reason.id}>
                  {reason.label}
                </option>
              ))}
            </select>
            {selectedReason && (
              <p className="mt-1 text-xs text-gray-500">
                {ARCHIVE_REASONS.find(r => r.id === selectedReason)?.description}
              </p>
            )}
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="w-full sm:w-auto"
            >
              취소
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={isLoading || !selectedReason}
              className="w-full sm:w-auto"
            >
              {isLoading ? '처리 중...' : '아카이브'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
