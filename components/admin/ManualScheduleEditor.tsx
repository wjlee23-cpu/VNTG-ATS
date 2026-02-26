'use client';

import { useState, useEffect } from 'react';
import { Calendar, Clock, Users, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { updateScheduleWithManualOverride } from '@/api/actions/schedules';
import { getUsers } from '@/api/queries/users';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface ManualScheduleEditorProps {
  scheduleId: string;
  currentScheduledAt: string;
  currentDurationMinutes: number;
  currentInterviewerIds: string[];
  isOpen: boolean;
  onClose: () => void;
}

export function ManualScheduleEditor({
  scheduleId,
  currentScheduledAt,
  currentDurationMinutes,
  currentInterviewerIds,
  isOpen,
  onClose,
}: ManualScheduleEditorProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [users, setUsers] = useState<Array<{ id: string; email: string; role: string }>>([]);
  const [formData, setFormData] = useState({
    scheduled_at: '',
    duration_minutes: currentDurationMinutes.toString(),
    interviewer_ids: currentInterviewerIds,
  });

  // 사용자 목록 로드
  useEffect(() => {
    if (isOpen) {
      loadUsers();
      // 현재 일정 정보로 초기화
      const date = new Date(currentScheduledAt);
      const localDateTime = format(date, "yyyy-MM-dd'T'HH:mm");
      setFormData({
        scheduled_at: localDateTime,
        duration_minutes: currentDurationMinutes.toString(),
        interviewer_ids: currentInterviewerIds,
      });
    }
  }, [isOpen, currentScheduledAt, currentDurationMinutes, currentInterviewerIds]);

  const loadUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const result = await getUsers();
      if (result.data) {
        // 면접관 또는 관리자만 필터링
        setUsers(result.data.filter(u => u.role === 'interviewer' || u.role === 'admin'));
      }
    } catch (error) {
      console.error('사용자 목록 로드 실패:', error);
      toast.error('면접관 목록을 불러올 수 없습니다.');
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('scheduled_at', formData.scheduled_at);
      formDataToSend.append('duration_minutes', formData.duration_minutes);
      formDataToSend.append('interviewer_ids', JSON.stringify(formData.interviewer_ids));

      const result = await updateScheduleWithManualOverride(scheduleId, formDataToSend);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('면접 일정이 수정되었습니다.');
        onClose();
        router.refresh();
      }
    } catch (error) {
      toast.error('면접 일정 수정에 실패했습니다.');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleInterviewer = (userId: string) => {
    setFormData(prev => ({
      ...prev,
      interviewer_ids: prev.interviewer_ids.includes(userId)
        ? prev.interviewer_ids.filter(id => id !== userId)
        : [...prev.interviewer_ids, userId],
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>면접 일정 수동 수정</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
            <p className="text-sm text-yellow-800">
              <strong>⚠️ 주의:</strong> 이 기능은 관리자/리크루터만 사용할 수 있습니다. 
              일정을 수정하면 구글 캘린더 이벤트도 자동으로 업데이트됩니다.
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Users className="w-4 h-4 inline mr-1" />
              면접관 선택 (최소 1명 이상)
            </label>
            {isLoadingUsers ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                <span className="ml-2 text-sm text-gray-500">면접관 목록 로딩 중...</span>
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-md p-3">
                {users.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-2">
                    면접관이 없습니다.
                  </p>
                ) : (
                  users.map((user) => (
                    <label
                      key={user.id}
                      className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={formData.interviewer_ids.includes(user.id)}
                        onChange={() => toggleInterviewer(user.id)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{user.email}</span>
                      {user.role === 'admin' && (
                        <span className="text-xs text-gray-500">(관리자)</span>
                      )}
                    </label>
                  ))
                )}
              </div>
            )}
            {formData.interviewer_ids.length === 0 && (
              <p className="text-xs text-red-500 mt-1">최소 1명의 면접관을 선택해주세요.</p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              취소
            </Button>
            <Button
              type="submit"
              disabled={isLoading || formData.interviewer_ids.length === 0 || isLoadingUsers}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  수정 중...
                </>
              ) : (
                '일정 수정'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
