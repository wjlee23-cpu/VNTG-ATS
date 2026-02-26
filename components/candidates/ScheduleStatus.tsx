'use client';

import { useState } from 'react';
import { CheckCircle2, XCircle, Clock, AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale/ko';
import { Button } from '@/components/ui/button';
import { checkInterviewerResponses } from '@/api/actions/schedules';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface ScheduleStatusProps {
  schedule: {
    id: string;
    workflow_status: 'pending_interviewers' | 'pending_candidate' | 'confirmed' | 'cancelled' | null;
    interviewer_responses?: Record<string, string> | null;
    interviewer_ids: string[];
  };
  options?: Array<{
    id: string;
    scheduled_at: string;
    status: string;
    interviewer_responses?: Record<string, string> | null;
  }>;
  interviewers?: Array<{
    id: string;
    email: string;
  }>;
}

export function ScheduleStatus({ schedule, options = [], interviewers = [] }: ScheduleStatusProps) {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(false);
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'accepted':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'declined':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'tentative':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'accepted':
        return '수락';
      case 'declined':
        return '거절';
      case 'tentative':
        return '보류';
      default:
        return '대기 중';
    }
  };

  const getWorkflowStatusText = () => {
    switch (schedule.workflow_status) {
      case 'pending_interviewers':
        return '면접관 수락 대기 중';
      case 'pending_candidate':
        return '후보자 선택 대기 중';
      case 'confirmed':
        return '확정됨';
      case 'cancelled':
        return '취소됨';
      default:
        return '상태 불명';
    }
  };

  // 면접관 응답 확인 핸들러
  const handleCheckResponses = async () => {
    setIsChecking(true);
    try {
      const result = await checkInterviewerResponses(schedule.id);
      
      if (result.error) {
        toast.error(result.error);
      } else if (result.data) {
        if (result.data.allAccepted) {
          toast.success(result.data.message || '모든 면접관이 수락한 일정이 있습니다. 후보자에게 전송되었습니다.');
        } else {
          toast.info(result.data.message || '아직 모든 면접관이 수락하지 않았습니다.');
        }
        // 페이지 새로고침하여 최신 상태 반영
        router.refresh();
      }
    } catch (error) {
      console.error('응답 확인 실패:', error);
      toast.error('응답 확인 중 오류가 발생했습니다.');
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="border rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">워크플로우 상태</h3>
        <p className="text-sm text-gray-600">{getWorkflowStatusText()}</p>
      </div>

      {options.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">일정 옵션별 면접관 응답</h3>
          {options.map((option) => {
            const date = new Date(option.scheduled_at);
            const responses = option.interviewer_responses || {};

            return (
              <div key={option.id} className="border rounded-lg p-4">
                <div className="mb-3">
                  <p className="text-sm font-medium text-gray-900">
                    {format(date, 'yyyy년 MM월 dd일 (EEE) HH:mm', { locale: ko })}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    상태: {option.status === 'selected' ? '선택됨' : option.status === 'rejected' ? '거절됨' : '대기 중'}
                  </p>
                </div>
                <div className="space-y-2">
                  {schedule.interviewer_ids.map((interviewerId) => {
                    const interviewer = interviewers.find(inv => inv.id === interviewerId);
                    const response = responses[interviewerId] || 'needsAction';

                    return (
                      <div key={interviewerId} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">
                          {interviewer?.email || interviewerId}
                        </span>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(response)}
                          <span className="text-gray-600">{getStatusText(response)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {schedule.workflow_status === 'pending_interviewers' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start justify-between gap-4">
            <p className="text-sm text-yellow-800 flex-1">
              면접관들이 구글 캘린더에서 일정 초대에 응답할 때까지 대기 중입니다.
            </p>
            <Button
              onClick={handleCheckResponses}
              disabled={isChecking}
              size="sm"
              variant="outline"
              className="flex-shrink-0"
            >
              {isChecking ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  확인 중...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  응답 확인
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {schedule.workflow_status === 'pending_candidate' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            모든 면접관이 수락한 일정이 후보자에게 전송되었습니다. 후보자의 선택을 기다리는 중입니다.
          </p>
        </div>
      )}

      {schedule.workflow_status === 'confirmed' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-800">
            면접 일정이 확정되었습니다. 구글 캘린더에 일정이 추가되었습니다.
          </p>
        </div>
      )}
    </div>
  );
}
