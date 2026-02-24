'use client';

import { useState } from 'react';
import { Calendar, Clock, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { confirmCandidateSchedule } from '@/api/actions/schedules';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale/ko';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface CandidateScheduleClientProps {
  candidate: {
    id: string;
    name: string;
    email: string;
  };
  schedule: {
    id: string;
    duration_minutes: number;
    interviewer_ids: string[];
  };
  options: Array<{
    id: string;
    scheduled_at: string;
    status: string;
  }>;
  token: string;
  isConfirmed?: boolean;
}

export function CandidateScheduleClient({
  candidate,
  schedule,
  options,
  token,
  isConfirmed: initialIsConfirmed = false,
}: CandidateScheduleClientProps) {
  const router = useRouter();
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(initialIsConfirmed);
  const [confirmedOption, setConfirmedOption] = useState<{
    id: string;
    scheduled_at: string;
  } | null>(initialIsConfirmed && options.length > 0 ? options[0] : null);

  const handleSelect = async (optionId: string) => {
    setIsSubmitting(true);
    setSelectedOptionId(optionId);

    try {
      const result = await confirmCandidateSchedule(schedule.id, optionId, token);

      if (result.error) {
        toast.error(result.error);
        setIsSubmitting(false);
        setSelectedOptionId(null);
      } else {
        toast.success('면접 일정이 확정되었습니다!');
        // 성공 상태로 변경하고 선택된 옵션 저장
        setIsConfirmed(true);
        const selectedOption = options.find(opt => opt.id === optionId);
        if (selectedOption) {
          setConfirmedOption(selectedOption);
        }
        setIsSubmitting(false);
        // 페이지 새로고침하여 서버에서 확정된 일정 정보를 가져오기
        setTimeout(() => {
          router.refresh();
        }, 500);
      }
    } catch (error) {
      toast.error('일정 확정에 실패했습니다.');
      console.error(error);
      setIsSubmitting(false);
      setSelectedOptionId(null);
    }
  };

  // 일정 확정 완료 화면 (서버에서 이미 확정된 경우 또는 클라이언트에서 방금 확정한 경우)
  if (isConfirmed && confirmedOption) {
    const date = new Date(confirmedOption.scheduled_at);
    const endTime = new Date(date);
    endTime.setMinutes(endTime.getMinutes() + schedule.duration_minutes);

    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                면접 일정이 확정되었습니다
              </h1>
              <p className="text-gray-600">
                안녕하세요, <strong>{candidate.name}</strong>님. 면접 일정이 성공적으로 확정되었습니다.
              </p>
            </div>

            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 mb-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  <span className="font-medium text-gray-900">날짜:</span>
                  <span className="text-gray-700">
                    {format(date, 'yyyy년 MM월 dd일 (EEE)', { locale: ko })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <span className="font-medium text-gray-900">시간:</span>
                  <span className="text-gray-700">
                    {format(date, 'HH:mm')} - {format(endTime, 'HH:mm')}
                  </span>
                </div>
                <div className="text-sm text-gray-600 mt-2">
                  소요 시간: {schedule.duration_minutes}분
                </div>
              </div>
            </div>

            <div className="border-t pt-6">
              <p className="text-sm text-gray-500 text-center">
                구글 캘린더에 일정이 자동으로 추가되었으며, 면접관들에게도 알림이 전송되었습니다.
                <br />
                면접 일정을 확인하시고 준비해 주시기 바랍니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 일정 선택 화면
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            면접 일정 선택
          </h1>
          <p className="text-gray-600 mb-8">
            안녕하세요, <strong>{candidate.name}</strong>님. 아래 일정 중 하나를 선택해주세요.
          </p>

          <div className="space-y-4 mb-8">
            {options.map((option, index) => {
              const date = new Date(option.scheduled_at);
              const endTime = new Date(date);
              endTime.setMinutes(endTime.getMinutes() + schedule.duration_minutes);
              const isSelected = selectedOptionId === option.id;

              return (
                <div
                  key={option.id}
                  className={`border-2 rounded-lg p-6 transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="w-5 h-5 text-gray-500" />
                        <h3 className="text-lg font-semibold text-gray-900">
                          옵션 {index + 1}
                        </h3>
                      </div>
                      <div className="space-y-2 text-gray-700">
                        <p className="flex items-center gap-2">
                          <span className="font-medium">날짜:</span>
                          <span>
                            {format(date, 'yyyy년 MM월 dd일 (EEE)', { locale: ko })}
                          </span>
                        </p>
                        <p className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          <span>
                            {format(date, 'HH:mm')} - {format(endTime, 'HH:mm')}
                          </span>
                        </p>
                        <p className="text-sm text-gray-500">
                          소요 시간: {schedule.duration_minutes}분
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleSelect(option.id)}
                      disabled={isSubmitting}
                      className={`ml-4 ${
                        isSelected ? 'bg-blue-600 hover:bg-blue-700' : ''
                      }`}
                    >
                      {isSubmitting && isSelected ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          처리 중...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          선택하기
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t pt-6">
            <p className="text-sm text-gray-500 text-center">
              일정을 선택하시면 구글 캘린더에 자동으로 추가되며, 면접관들에게도 알림이 전송됩니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
