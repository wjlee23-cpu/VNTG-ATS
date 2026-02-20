'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar as CalendarIcon, Clock, User, Briefcase, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

interface Schedule {
  id: string;
  candidate_id: string;
  stage_id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: 'pending' | 'confirmed' | 'rejected' | 'completed';
  candidate_response: 'accepted' | 'rejected' | 'pending' | null;
  beverage_preference: string | null;
  candidates?: {
    id: string;
    name: string;
    email: string;
    job_posts?: {
      id: string;
      title: string;
    };
  };
}

interface CalendarClientProps {
  initialSchedules: Schedule[];
  error?: string;
}

export function CalendarClient({ initialSchedules, error }: CalendarClientProps) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(new Date());

  // 날짜별로 일정 그룹화
  const schedulesByDate = initialSchedules.reduce((acc, schedule) => {
    const date = new Date(schedule.scheduled_at).toDateString();
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(schedule);
    return acc;
  }, {} as Record<string, Schedule[]>);

  // 상태별 색상
  const getStatusColor = (status: string) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      confirmed: 'bg-blue-100 text-blue-800 border-blue-200',
      rejected: 'bg-red-100 text-red-800 border-red-200',
      completed: 'bg-green-100 text-green-800 border-green-200',
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  // 상태 아이콘
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle2 size={16} />;
      case 'rejected':
        return <XCircle size={16} />;
      case 'completed':
        return <CheckCircle2 size={16} />;
      default:
        return <AlertCircle size={16} />;
    }
  };

  // 상태 텍스트
  const getStatusText = (status: string) => {
    const texts = {
      pending: '대기중',
      confirmed: '확정',
      rejected: '거절',
      completed: '완료',
    };
    return texts[status as keyof typeof texts] || status;
  };

  // 선택된 날짜의 일정
  const selectedDateSchedules = schedulesByDate[selectedDate.toDateString()] || [];

  return (
    <div className="h-full overflow-auto">
      <div className="px-8 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Calendar</h1>
          <p className="text-gray-600">면접 일정을 확인하고 관리하세요.</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar View */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-gray-900">면접 일정</h2>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <CalendarIcon size={18} />
                  {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })}
                </div>
              </div>

              {Object.keys(schedulesByDate).length === 0 ? (
                <div className="text-center py-12">
                  <CalendarIcon className="mx-auto text-gray-400 mb-4" size={48} />
                  <p className="text-gray-600">이번 달 예정된 면접 일정이 없습니다.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(schedulesByDate)
                    .sort(([dateA], [dateB]) => new Date(dateA).getTime() - new Date(dateB).getTime())
                    .map(([date, schedules]) => (
                      <div
                        key={date}
                        onClick={() => setSelectedDate(new Date(date))}
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          selectedDate.toDateString() === date
                            ? 'border-brand-main bg-brand-main/5'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-semibold text-gray-900">
                            {new Date(date).toLocaleDateString('ko-KR', {
                              month: 'long',
                              day: 'numeric',
                              weekday: 'short',
                            })}
                          </div>
                          <span className="text-sm text-gray-500">{schedules.length}건</span>
                        </div>
                        <div className="space-y-2">
                          {schedules.slice(0, 3).map((schedule) => (
                            <div
                              key={schedule.id}
                              className="flex items-center gap-2 text-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/candidates/${schedule.candidate_id}`);
                              }}
                            >
                              <Clock size={14} className="text-gray-400" />
                              <span className="text-gray-700">
                                {new Date(schedule.scheduled_at).toLocaleTimeString('ko-KR', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                              <span className="text-gray-600">
                                - {schedule.candidates?.name || '알 수 없음'}
                              </span>
                            </div>
                          ))}
                          {schedules.length > 3 && (
                            <div className="text-xs text-gray-500">
                              +{schedules.length - 3}건 더 보기
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* Selected Date Details */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              {selectedDate.toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long',
              })}
            </h2>

            {selectedDateSchedules.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 text-sm">선택한 날짜에 예정된 면접이 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedDateSchedules.map((schedule) => (
                  <div
                    key={schedule.id}
                    onClick={() => router.push(`/candidates/${schedule.candidate_id}`)}
                    className={`p-4 rounded-xl border-2 cursor-pointer hover:shadow-md transition-all ${getStatusColor(schedule.status)}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(schedule.status)}
                        <span className="font-semibold text-sm">
                          {getStatusText(schedule.status)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs">
                        <Clock size={12} />
                        {new Date(schedule.scheduled_at).toLocaleTimeString('ko-KR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        <span className="ml-1">({schedule.duration_minutes}분)</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <User size={14} />
                        <span className="font-medium">{schedule.candidates?.name || '알 수 없음'}</span>
                      </div>
                      {schedule.candidates?.job_posts && (
                        <div className="flex items-center gap-2 text-sm">
                          <Briefcase size={14} />
                          <span>{schedule.candidates.job_posts.title}</span>
                        </div>
                      )}
                      {schedule.beverage_preference && (
                        <div className="text-xs text-gray-600 mt-2">
                          음료: {schedule.beverage_preference}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
