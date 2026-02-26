'use client';

import { useState } from 'react';
import { Calendar, Clock, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { addManualScheduleOption } from '@/api/actions/schedules';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface AddScheduleOptionModalProps {
  scheduleId: string;
  currentDurationMinutes: number;
  isOpen: boolean;
  onClose: () => void;
}

export function AddScheduleOptionModal({
  scheduleId,
  currentDurationMinutes,
  isOpen,
  onClose,
}: AddScheduleOptionModalProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    scheduled_at: '',
    duration_minutes: currentDurationMinutes.toString(),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('scheduled_at', formData.scheduled_at);
      formDataToSend.append('duration_minutes', formData.duration_minutes);

      const result = await addManualScheduleOption(scheduleId, formDataToSend);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('일정 옵션이 추가되었습니다.');
        onClose();
        router.refresh();
      }
    } catch (error) {
      toast.error('일정 옵션 추가에 실패했습니다.');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>일정 옵션 수동 추가</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <p className="text-sm text-blue-800">
              <strong>ℹ️ 안내:</strong> 관리자가 직접 일정 옵션을 추가합니다. 
              면접관 일정 확인 없이 강제로 옵션이 생성되며, 구글 캘린더에 초대가 전송됩니다.
            </p>
          </div>

          <div>
            <label htmlFor="scheduled_at" className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar className="w-4 h-4 inline mr-1" />
              면접 일시
            </label>
            <input
              id="scheduled_at"
              type="datetime-local"
              required
              value={formData.scheduled_at}
              onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              min={new Date().toISOString().slice(0, 16)}
            />
          </div>

          <div>
            <label htmlFor="duration_minutes" className="block text-sm font-medium text-gray-700 mb-1">
              <Clock className="w-4 h-4 inline mr-1" />
              면접 시간 (분)
            </label>
            <select
              id="duration_minutes"
              required
              value={formData.duration_minutes}
              onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="30">30분</option>
              <option value="60">60분</option>
              <option value="90">90분</option>
              <option value="120">120분</option>
            </select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              취소
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  추가 중...
                </>
              ) : (
                '옵션 추가'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
