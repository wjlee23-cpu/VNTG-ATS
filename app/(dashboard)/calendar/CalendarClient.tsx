'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar as CalendarIcon, Clock, User, Briefcase, CheckCircle2, ChevronLeft, ChevronRight, Video, Users as UsersIcon } from 'lucide-react';

interface Schedule {
  id: string;
  candidate_id: string;
  stage_id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: 'pending' | 'confirmed' | 'rejected' | 'completed';
  candidate_response: 'accepted' | 'rejected' | 'pending' | null;
  beverage_preference: string | null;
  interview_type?: string;
  meeting_platform?: string;
  meeting_link?: string;
  interviewer_ids?: string[];
  interviewers?: Array<{
    id: string;
    email: string;
  }>;
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

  // 날짜 변경 함수
  const changeDate = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
  };

  // 선택된 날짜의 면접 목록
  const selectedDateSchedules = useMemo(() => {
    const dateStr = selectedDate.toISOString().split('T')[0];
    return initialSchedules.filter(schedule => {
      const scheduleDate = new Date(schedule.scheduled_at).toISOString().split('T')[0];
      return scheduleDate === dateStr;
    }).sort((a, b) => 
      new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
    );
  }, [selectedDate, initialSchedules]);

  // 통계 계산
  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todaySchedules = initialSchedules.filter(schedule => {
      const scheduleDate = new Date(schedule.scheduled_at).toISOString().split('T')[0];
      return scheduleDate === todayStr;
    });

    return {
      todayInterviews: todaySchedules.length,
      confirmed: todaySchedules.filter(s => s.status === 'confirmed').length,
      pending: todaySchedules.filter(s => s.status === 'pending').length,
    };
  }, [initialSchedules]);

  // Interview Type 텍스트 변환
  const getInterviewTypeText = (type?: string) => {
    const typeMap: Record<string, string> = {
      technical: 'Technical Interview',
      portfolio: 'Portfolio Review',
      hr_screening: 'HR Screening',
      cultural_fit: 'Cultural Fit',
      final: 'Final Interview',
    };
    return typeMap[type || ''] || 'Interview';
  };

  // Meeting Platform 텍스트 변환
  const getMeetingPlatformText = (platform?: string) => {
    const platformMap: Record<string, string> = {
      google_meet: 'Google Meet',
      zoom: 'Zoom',
      teams: 'Microsoft Teams',
      other: 'Other',
    };
    return platformMap[platform || ''] || 'Not specified';
  };

  // 면접관 이름 목록
  const getInterviewerNames = (schedule: Schedule) => {
    if (schedule.interviewers && schedule.interviewers.length > 0) {
      return schedule.interviewers.map(i => {
        const name = i.email.split('@')[0];
        return name.split('.').map(n => n.charAt(0).toUpperCase() + n.slice(1)).join(' ');
      }).join(', ');
    }
    return 'HR Team';
  };

  // 날짜 포맷팅
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // 시간 포맷팅
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Duration 포맷팅
  const formatDuration = (minutes: number) => {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours} hour ${mins} min` : `${hours} hour`;
    }
    return `${minutes} min`;
  };

  return (
    <div className="h-full overflow-auto bg-[#FAFAFA]">
      <div className="px-8 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Interview Schedule</h1>
            {/* Date Selector */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => changeDate(-1)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft size={20} className="text-gray-600" />
              </button>
              <span className="text-lg font-medium text-gray-900 min-w-[200px] text-center">
                {formatDate(selectedDate)}
              </span>
              <button
                onClick={() => changeDate(1)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronRight size={20} className="text-gray-600" />
              </button>
            </div>
          </div>
          <button
            onClick={() => router.push('/calendar/create')}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <CalendarIcon size={18} />
            Schedule Interview
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="text-3xl font-bold text-blue-600 mb-1">{stats.todayInterviews}</div>
            <div className="text-sm text-gray-600">Today's Interviews</div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="text-3xl font-bold text-green-600 mb-1">{stats.confirmed}</div>
            <div className="text-sm text-gray-600">Confirmed</div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="text-3xl font-bold text-orange-600 mb-1">{stats.pending}</div>
            <div className="text-sm text-gray-600">Pending</div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
            {error}
          </div>
        )}

        {/* Interviews List */}
        {selectedDateSchedules.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <CalendarIcon className="mx-auto text-gray-400 mb-4" size={48} />
            <p className="text-gray-600">선택한 날짜에 예정된 면접이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {selectedDateSchedules.map((schedule) => (
              <div
                key={schedule.id}
                className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg transition-all relative"
              >
                {/* Status Badge */}
                <div className="absolute top-4 right-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    schedule.status === 'confirmed'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-orange-100 text-orange-700'
                  }`}>
                    {schedule.status}
                  </span>
                </div>

                <div className="flex items-start gap-6">
                  {/* Time */}
                  <div className="flex-shrink-0">
                    <div className="text-2xl font-bold text-gray-900">
                      {formatTime(schedule.scheduled_at)}
                    </div>
                    <div className="text-sm text-gray-500">
                      {formatDuration(schedule.duration_minutes)}
                    </div>
                  </div>

                  {/* Candidate Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold">
                        {schedule.candidates?.name?.charAt(0) || '?'}
                      </div>
                      <div>
                        <div className="font-bold text-gray-900">{schedule.candidates?.name || 'Unknown'}</div>
                        <div className="text-sm text-gray-600">{schedule.candidates?.job_posts?.title || 'No position'}</div>
                      </div>
                    </div>

                    <div className="space-y-2 mt-4">
                      {/* Interview Type */}
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <CalendarIcon size={14} className="text-gray-400" />
                        <span>{getInterviewTypeText(schedule.interview_type)}</span>
                      </div>

                      {/* Interviewers */}
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <UsersIcon size={14} className="text-gray-400" />
                        <span>{getInterviewerNames(schedule)}</span>
                      </div>

                      {/* Meeting Platform */}
                      {schedule.meeting_platform && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Video size={14} className="text-gray-400" />
                          <span>{getMeetingPlatformText(schedule.meeting_platform)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex-shrink-0 flex flex-col gap-2">
                    <button
                      onClick={() => router.push(`/calendar/${schedule.id}/reschedule`)}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors text-sm"
                    >
                      Reschedule
                    </button>
                    {schedule.meeting_link && (
                      <a
                        href={schedule.meeting_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors text-sm text-center"
                      >
                        Join Meeting
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
