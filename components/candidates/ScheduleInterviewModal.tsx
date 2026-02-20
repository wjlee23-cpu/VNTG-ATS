'use client';

import { useState } from 'react';
import { Calendar, Clock, Users } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { createSchedule } from '@/api/actions/schedules';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface ScheduleInterviewModalProps {
  candidateId: string;
  candidateName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ScheduleInterviewModal({
  candidateId,
  candidateName,
  isOpen,
  onClose,
}: ScheduleInterviewModalProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    scheduled_at: '',
    duration_minutes: '60',
    stage_id: 'stage-6', // 기본값: 1st Interview
    interviewer_ids: [] as string[],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('candidate_id', candidateId);
      formDataToSend.append('stage_id', formData.stage_id);
      formDataToSend.append('scheduled_at', formData.scheduled_at);
      formDataToSend.append('duration_minutes', formData.duration_minutes);
      formDataToSend.append('interviewer_ids', JSON.stringify(formData.interviewer_ids));

      const result = await createSchedule(formDataToSend);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('면접 일정이 생성되었습니다.');
        onClose();
        router.refresh();
      }
    } catch (error) {
      toast.error('면접 일정 생성에 실패했습니다.');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Schedule Interview</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              후보자
            </label>
            <p className="text-sm text-gray-900">{candidateName}</p>
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

          <div>
            <label htmlFor="stage_id" className="block text-sm font-medium text-gray-700 mb-1">
              면접 단계
            </label>
            <select
              id="stage_id"
              required
              value={formData.stage_id}
              onChange={(e) => setFormData({ ...formData, stage_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="stage-6">1st Interview</option>
              <option value="stage-8">2nd Interview</option>
              <option value="stage-5">Technical Test</option>
              <option value="stage-4">Competency Assessment</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Users className="w-4 h-4 inline mr-1" />
              면접관 (선택사항)
            </label>
            <p className="text-xs text-gray-500 mb-2">
              면접관 선택 기능은 추후 구현 예정입니다.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              취소
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? '생성 중...' : '일정 생성'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
