'use client';

import { useState, useEffect } from 'react';
import { Calendar, Clock, Users, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { scheduleInterviewAutomated } from '@/api/actions/schedules';
import { getUsers } from '@/api/queries/users';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { STAGE_ID_TO_NAME_MAP } from '@/constants/stages';

interface ScheduleInterviewAutomatedModalProps {
  candidateId: string;
  candidateName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ScheduleInterviewAutomatedModal({
  candidateId,
  candidateName,
  isOpen,
  onClose,
}: ScheduleInterviewAutomatedModalProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [users, setUsers] = useState<Array<{ id: string; email: string; role: string }>>([]);
  const [formData, setFormData] = useState({
    start_date: '',
    end_date: '',
    duration_minutes: '60',
    stage_id: 'stage-6', // 기본값: 1st Interview
    interviewer_ids: [] as string[],
  });

  // 사용자 목록 로드
  useEffect(() => {
    if (isOpen) {
      loadUsers();
    }
  }, [isOpen]);

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
      formDataToSend.append('candidate_id', candidateId);
      formDataToSend.append('stage_id', formData.stage_id);
      formDataToSend.append('start_date', formData.start_date);
      formDataToSend.append('end_date', formData.end_date);
      formDataToSend.append('duration_minutes', formData.duration_minutes);
      formDataToSend.append('interviewer_ids', JSON.stringify(formData.interviewer_ids));

      const result = await scheduleInterviewAutomated(formDataToSend);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.message || '면접 일정 자동화가 시작되었습니다.');
        onClose();
        router.refresh();
      }
    } catch (error) {
      toast.error('면접 일정 자동화에 실패했습니다.');
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
          <DialogTitle>인터뷰 스케줄링 자동화</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              후보자
            </label>
            <p className="text-sm text-gray-900">{candidateName}</p>
          </div>

          <div>
            <label htmlFor="start_date" className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar className="w-4 h-4 inline mr-1" />
              일정 검색 시작 날짜
            </label>
            <input
              id="start_date"
              type="date"
              required
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          <div>
            <label htmlFor="end_date" className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar className="w-4 h-4 inline mr-1" />
              일정 검색 종료 날짜
            </label>
            <input
              id="end_date"
              type="date"
              required
              value={formData.end_date}
              onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              min={formData.start_date || new Date().toISOString().split('T')[0]}
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
              {Object.entries(STAGE_ID_TO_NAME_MAP).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
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
                    면접관이 없습니다. 먼저 면접관을 등록해주세요.
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

          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <p className="text-sm text-blue-800">
              <strong>자동화 프로세스:</strong>
            </p>
            <ul className="text-xs text-blue-700 mt-1 list-disc list-inside space-y-1">
              <li>면접관들의 구글 캘린더에서 공통 가능 일정 2개를 찾습니다</li>
              <li>구글 캘린더에 block 일정을 생성하고 면접관들에게 초대를 전송합니다</li>
              <li>모든 면접관이 수락하면 후보자에게 일정 옵션을 전송합니다</li>
            </ul>
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
                  처리 중...
                </>
              ) : (
                '자동화 시작'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
