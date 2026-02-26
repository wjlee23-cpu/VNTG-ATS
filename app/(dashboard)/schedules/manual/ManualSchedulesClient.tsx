'use client';

import { useState } from 'react';
import { Calendar, Clock, Users, Edit, Plus, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ManualScheduleEditor } from '@/components/admin/ManualScheduleEditor';
import { AddScheduleOptionModal } from '@/components/admin/AddScheduleOptionModal';
import { ForceConfirmModal } from '@/components/admin/ForceConfirmModal';
import { rescheduleInterview } from '@/api/actions/schedules';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale/ko';

interface Schedule {
  id: string;
  candidate_id: string;
  scheduled_at: string;
  duration_minutes: number;
  workflow_status: string;
  needs_rescheduling: boolean | null;
  rescheduling_reason: string | null;
  manual_override: boolean | null;
  interviewer_ids: string[];
  candidates: {
    id: string;
    name: string;
    email: string;
  } | null;
}

interface ManualSchedulesClientProps {
  needsRescheduling: Schedule[];
  manualSchedules: Schedule[];
  confirmedSchedules: Schedule[];
}

export function ManualSchedulesClient({
  needsRescheduling,
  manualSchedules,
  confirmedSchedules,
}: ManualSchedulesClientProps) {
  const router = useRouter();
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [addingOptionScheduleId, setAddingOptionScheduleId] = useState<string | null>(null);
  const [forceConfirmScheduleId, setForceConfirmScheduleId] = useState<string | null>(null);
  const [forceConfirmOptionId, setForceConfirmOptionId] = useState<string | undefined>(undefined);
  const [reschedulingScheduleId, setReschedulingScheduleId] = useState<string | null>(null);
  const [isRescheduling, setIsRescheduling] = useState(false);

  const getWorkflowStatusBadge = (status: string | null) => {
    switch (status) {
      case 'pending_interviewers':
        return <Badge variant="outline">면접관 대기</Badge>;
      case 'pending_candidate':
        return <Badge variant="outline">후보자 대기</Badge>;
      case 'confirmed':
        return <Badge variant="default">확정</Badge>;
      case 'cancelled':
        return <Badge variant="secondary">취소</Badge>;
      case 'needs_rescheduling':
        return <Badge variant="destructive">재조율 필요</Badge>;
      default:
        return <Badge variant="outline">알 수 없음</Badge>;
    }
  };

  const handleReschedule = async (scheduleId: string) => {
    setIsRescheduling(true);
    try {
      const formData = new FormData();
      formData.append('rescheduling_reason', '관리자 요청');
      formData.append('num_options', '2');

      const result = await rescheduleInterview(scheduleId, formData);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('재조율이 완료되었습니다.');
        router.refresh();
      }
    } catch (error) {
      toast.error('재조율에 실패했습니다.');
      console.error(error);
    } finally {
      setIsRescheduling(false);
      setReschedulingScheduleId(null);
    }
  };

  const renderScheduleCard = (schedule: Schedule, showActions: boolean = true) => {
    const candidate = schedule.candidates;
    if (!candidate) return null;

    const scheduledDate = new Date(schedule.scheduled_at);
    const endTime = new Date(scheduledDate);
    endTime.setMinutes(endTime.getMinutes() + schedule.duration_minutes);

    return (
      <Card key={schedule.id} className="mb-4">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg">{candidate.name}</CardTitle>
              <CardDescription>{candidate.email}</CardDescription>
            </div>
            <div className="flex gap-2">
              {getWorkflowStatusBadge(schedule.workflow_status)}
              {schedule.manual_override && (
                <Badge variant="outline" className="bg-yellow-50">수동 조율</Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-gray-500" />
              <span>
                {format(scheduledDate, 'yyyy년 MM월 dd일 (EEE) HH:mm', { locale: ko })} -{' '}
                {format(endTime, 'HH:mm')}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-gray-500" />
              <span>{schedule.duration_minutes}분</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Users className="w-4 h-4 text-gray-500" />
              <span>면접관 {schedule.interviewer_ids.length}명</span>
            </div>
            {schedule.rescheduling_reason && (
              <div className="flex items-start gap-2 text-sm text-orange-600">
                <AlertTriangle className="w-4 h-4 mt-0.5" />
                <span>재조율 사유: {schedule.rescheduling_reason}</span>
              </div>
            )}
          </div>

          {showActions && (
            <div className="flex gap-2 mt-4 pt-4 border-t">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditingScheduleId(schedule.id)}
              >
                <Edit className="w-4 h-4 mr-1" />
                수정
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAddingOptionScheduleId(schedule.id)}
              >
                <Plus className="w-4 h-4 mr-1" />
                옵션 추가
              </Button>
              {schedule.workflow_status === 'pending_interviewers' || schedule.workflow_status === 'pending_candidate' ? (
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => {
                    setForceConfirmScheduleId(schedule.id);
                    setForceConfirmOptionId(undefined);
                  }}
                >
                  <CheckCircle className="w-4 h-4 mr-1" />
                  강제 확정
                </Button>
              ) : null}
              {schedule.needs_rescheduling && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleReschedule(schedule.id)}
                  disabled={isRescheduling && reschedulingScheduleId === schedule.id}
                >
                  {isRescheduling && reschedulingScheduleId === schedule.id ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      재조율 중...
                    </>
                  ) : (
                    '재조율'
                  )}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const editingSchedule = [...needsRescheduling, ...manualSchedules, ...confirmedSchedules].find(
    s => s.id === editingScheduleId
  );
  const addingOptionSchedule = [...needsRescheduling, ...manualSchedules, ...confirmedSchedules].find(
    s => s.id === addingOptionScheduleId
  );
  const forceConfirmSchedule = [...needsRescheduling, ...manualSchedules, ...confirmedSchedules].find(
    s => s.id === forceConfirmScheduleId
  );

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">수동 일정 조율</h1>
        <p className="text-gray-600 mt-2">
          관리자/리크루터가 면접 일정을 수동으로 조율할 수 있는 대시보드입니다.
        </p>
      </div>

      <Tabs defaultValue="needs-rescheduling" className="space-y-4">
        <TabsList>
          <TabsTrigger value="needs-rescheduling">
            재조율 필요 ({needsRescheduling.length})
          </TabsTrigger>
          <TabsTrigger value="manual">수동 조율 이력 ({manualSchedules.length})</TabsTrigger>
          <TabsTrigger value="confirmed">확정 일정 ({confirmedSchedules.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="needs-rescheduling" className="space-y-4">
          {needsRescheduling.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                재조율이 필요한 일정이 없습니다.
              </CardContent>
            </Card>
          ) : (
            needsRescheduling.map(schedule => renderScheduleCard(schedule))
          )}
        </TabsContent>

        <TabsContent value="manual" className="space-y-4">
          {manualSchedules.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                수동 조율 이력이 없습니다.
              </CardContent>
            </Card>
          ) : (
            manualSchedules.map(schedule => renderScheduleCard(schedule))
          )}
        </TabsContent>

        <TabsContent value="confirmed" className="space-y-4">
          {confirmedSchedules.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                확정된 일정이 없습니다.
              </CardContent>
            </Card>
          ) : (
            confirmedSchedules.map(schedule => renderScheduleCard(schedule))
          )}
        </TabsContent>
      </Tabs>

      {/* 모달들 */}
      {editingSchedule && (
        <ManualScheduleEditor
          scheduleId={editingSchedule.id}
          currentScheduledAt={editingSchedule.scheduled_at}
          currentDurationMinutes={editingSchedule.duration_minutes}
          currentInterviewerIds={editingSchedule.interviewer_ids}
          isOpen={editingScheduleId !== null}
          onClose={() => setEditingScheduleId(null)}
        />
      )}

      {addingOptionSchedule && (
        <AddScheduleOptionModal
          scheduleId={addingOptionSchedule.id}
          currentDurationMinutes={addingOptionSchedule.duration_minutes}
          isOpen={addingOptionScheduleId !== null}
          onClose={() => setAddingOptionScheduleId(null)}
        />
      )}

      {forceConfirmSchedule && (
        <ForceConfirmModal
          scheduleId={forceConfirmSchedule.id}
          optionId={forceConfirmOptionId}
          candidateName={forceConfirmSchedule.candidates?.name || '알 수 없음'}
          isOpen={forceConfirmScheduleId !== null}
          onClose={() => {
            setForceConfirmScheduleId(null);
            setForceConfirmOptionId(undefined);
          }}
        />
      )}
    </div>
  );
}
