'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Mail, Phone, Briefcase, Calendar, Clock, User, CheckCircle2, XCircle, AlertCircle, Clock3 } from 'lucide-react';
import { getStageNameByStageId, RECRUITMENT_STAGES } from '@/constants/stages';

interface Candidate {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: 'pending' | 'in_progress' | 'confirmed' | 'rejected' | 'issue';
  current_stage_id: string;
  token: string;
  parsed_data: {
    match_score?: number;
    skills?: string[];
    experience?: string;
    education?: string;
  } | null;
  created_at: string;
  job_posts?: {
    id: string;
    title: string;
    description: string;
    process_id: string;
    processes?: {
      id: string;
      name: string;
      stages: Array<{
        id: string;
        name: string;
        order: number;
      }>;
    };
  };
}

interface Schedule {
  id: string;
  candidate_id: string;
  stage_id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: 'pending' | 'confirmed' | 'rejected' | 'completed';
  candidate_response: 'accepted' | 'rejected' | 'pending' | null;
  beverage_preference: string | null;
}

interface TimelineEvent {
  id: string;
  type: string;
  content: any;
  created_at: string;
  created_by_user?: {
    id: string;
    email: string;
  };
}

interface CandidateDetailClientProps {
  candidate: Candidate;
  schedules: Schedule[];
  timelineEvents: TimelineEvent[];
}

export function CandidateDetailClient({ candidate, schedules, timelineEvents }: CandidateDetailClientProps) {
  const router = useRouter();

  // 상태별 색상
  const getStatusColor = (status: string) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      in_progress: 'bg-blue-100 text-blue-800',
      confirmed: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      issue: 'bg-orange-100 text-orange-800',
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getStatusText = (status: string) => {
    const texts = {
      pending: '대기중',
      in_progress: '진행중',
      confirmed: '확정',
      rejected: '거절',
      issue: '이슈',
    };
    return texts[status as keyof typeof texts] || status;
  };

  // 현재 단계 찾기 (process의 stage 정보)
  const currentStage = candidate.job_posts?.processes?.stages?.find(
    stage => stage.id === candidate.current_stage_id
  );

  // 매핑된 단계 이름 가져오기 (사용자가 정의한 단계 이름)
  const mappedStageName = getStageNameByStageId(candidate.current_stage_id) || 'New Application';

  return (
    <div className="h-full overflow-auto">
      <div className="px-8 py-6">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft size={18} />
            뒤로가기
          </button>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{candidate.name}</h1>
              <div className="flex items-center gap-4 text-gray-600">
                <div className="flex items-center gap-2">
                  <Mail size={16} />
                  {candidate.email}
                </div>
                {candidate.phone && (
                  <div className="flex items-center gap-2">
                    <Phone size={16} />
                    {candidate.phone}
                  </div>
                )}
              </div>
            </div>
            <span className={`px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(candidate.status)}`}>
              {getStatusText(candidate.status)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Job Post Info */}
            {candidate.job_posts && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Briefcase size={20} />
                  채용 공고
                </h2>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-gray-900">{candidate.job_posts.title}</h3>
                  {candidate.job_posts.description && (
                    <p className="text-gray-600 whitespace-pre-wrap">{candidate.job_posts.description}</p>
                  )}
                </div>
              </div>
            )}

            {/* Match Score & Skills */}
            {candidate.parsed_data && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">매치 정보</h2>
                <div className="space-y-4">
                  {candidate.parsed_data.match_score && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-600">매치 스코어</span>
                        <span className="text-2xl font-bold text-brand-main">
                          {candidate.parsed_data.match_score}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className="bg-brand-main h-3 rounded-full"
                          style={{ width: `${candidate.parsed_data.match_score}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {candidate.parsed_data.skills && candidate.parsed_data.skills.length > 0 && (
                    <div>
                      <span className="text-sm text-gray-600 block mb-2">스킬</span>
                      <div className="flex flex-wrap gap-2">
                        {candidate.parsed_data.skills.map((skill, index) => (
                          <span
                            key={index}
                            className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {candidate.parsed_data.experience && (
                    <div>
                      <span className="text-sm text-gray-600">경력</span>
                      <p className="text-gray-900 font-medium">{candidate.parsed_data.experience}</p>
                    </div>
                  )}
                  {candidate.parsed_data.education && (
                    <div>
                      <span className="text-sm text-gray-600">학력</span>
                      <p className="text-gray-900 font-medium">{candidate.parsed_data.education}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Current Stage */}
            {(currentStage || candidate.current_stage_id) && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">현재 단계</h2>
                <div className="space-y-2">
                  <p className="text-xl font-semibold text-gray-900">{mappedStageName}</p>
                  {candidate.job_posts?.processes?.stages && (
                    <div className="flex items-center gap-2 mt-4">
                      {candidate.job_posts.processes.stages.map((stage, index) => {
                        // 각 stage의 매핑된 이름 가져오기
                        const stageMappedName = getStageNameByStageId(stage.id) || stage.name;
                        const currentStageIndex = candidate.job_posts!.processes!.stages!.findIndex(s => s.id === candidate.current_stage_id);
                        const isCurrentStage = stage.id === candidate.current_stage_id;
                        const isPastStage = currentStageIndex >= 0 && index < currentStageIndex;
                        
                        return (
                          <div key={stage.id} className="flex items-center">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                                isCurrentStage
                                  ? 'bg-brand-main text-white'
                                  : isPastStage
                                  ? 'bg-green-500 text-white'
                                  : 'bg-gray-200 text-gray-600'
                              }`}
                              title={stageMappedName}
                            >
                              {index + 1}
                            </div>
                            {index < candidate.job_posts!.processes!.stages!.length - 1 && (
                              <div
                                className={`h-1 w-12 ${
                                  isPastStage || isCurrentStage
                                    ? 'bg-green-500'
                                    : 'bg-gray-200'
                                }`}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Timeline Events */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">타임라인</h2>
              {timelineEvents.length === 0 ? (
                <p className="text-gray-500 text-sm">타임라인 이벤트가 없습니다.</p>
              ) : (
                <div className="space-y-4">
                  {timelineEvents.map((event) => (
                    <div key={event.id} className="flex gap-4">
                      <div className="flex-shrink-0">
                        <div className="w-2 h-2 rounded-full bg-brand-main mt-2" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-900">
                          {event.content?.message || event.type}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(event.created_at).toLocaleString('ko-KR')}
                          {event.created_by_user && ` • ${event.created_by_user.email}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* Interview Schedules */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Calendar size={20} />
                면접 일정
              </h2>
              {schedules.length === 0 ? (
                <p className="text-gray-500 text-sm">예정된 면접이 없습니다.</p>
              ) : (
                <div className="space-y-3">
                  {schedules.map((schedule) => (
                    <div
                      key={schedule.id}
                      className="p-4 border border-gray-200 rounded-xl"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Clock size={16} className="text-gray-400" />
                          <span className="text-sm font-medium text-gray-900">
                            {new Date(schedule.scheduled_at).toLocaleDateString('ko-KR', {
                              month: 'long',
                              day: 'numeric',
                              weekday: 'short',
                            })}
                          </span>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          schedule.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                          schedule.status === 'rejected' ? 'bg-red-100 text-red-800' :
                          schedule.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {schedule.status === 'confirmed' ? '확정' :
                           schedule.status === 'rejected' ? '거절' :
                           schedule.status === 'completed' ? '완료' : '대기중'}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        {new Date(schedule.scheduled_at).toLocaleTimeString('ko-KR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })} ({schedule.duration_minutes}분)
                      </div>
                      {schedule.beverage_preference && (
                        <div className="text-xs text-gray-500 mt-2">
                          음료: {schedule.beverage_preference}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Info */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">정보</h2>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-gray-600">등록일</span>
                  <p className="text-gray-900 font-medium">
                    {new Date(candidate.created_at).toLocaleDateString('ko-KR')}
                  </p>
                </div>
                <div>
                  <span className="text-gray-600">토큰</span>
                  <p className="text-gray-900 font-mono text-xs break-all">{candidate.token}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
