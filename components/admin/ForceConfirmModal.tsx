'use client';

import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { forceConfirmSchedule } from '@/api/actions/schedules';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface ForceConfirmModalProps {
  scheduleId: string;
  optionId?: string;
  candidateName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ForceConfirmModal({
  scheduleId,
  optionId,
  candidateName,
  isOpen,
  onClose,
}: ForceConfirmModalProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async () => {
    setIsLoading(true);

    try {
      const result = await forceConfirmSchedule(scheduleId, optionId);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('면접 일정이 강제 확정되었습니다.');
        onClose();
        router.refresh();
      }
    } catch (error) {
      toast.error('강제 확정에 실패했습니다.');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            강제 확정 확인
          </DialogTitle>
          <DialogDescription>
            면접관/후보자 응답과 관계없이 일정을 강제로 확정합니다.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-sm text-red-800 font-medium mb-2">
              ⚠️ 주의사항
            </p>
            <ul className="text-sm text-red-700 space-y-1 list-disc list-inside">
              <li>면접관과 후보자의 응답을 확인하지 않고 일정을 확정합니다.</li>
              <li>모든 면접관과 후보자에게 확정 안내 메일이 자동으로 전송됩니다.</li>
              <li>구글 캘린더 이벤트가 자동으로 업데이트됩니다.</li>
              <li>이 작업은 되돌릴 수 없습니다.</li>
            </ul>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
            <p className="text-sm text-gray-700">
              <strong>후보자:</strong> {candidateName}
            </p>
            {optionId && (
              <p className="text-sm text-gray-700 mt-1">
                <strong>선택된 옵션 ID:</strong> {optionId}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
            취소
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                확정 중...
              </>
            ) : (
              '강제 확정'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
