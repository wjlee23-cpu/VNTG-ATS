'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  X, Mail, Phone, MapPin, Star, FileText, Download, Calendar, 
  Send, Sparkles, Star as StarIcon, ArrowRight, FileIcon, 
  MessageSquare, ArrowRightCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScheduleInterviewModal } from '@/components/candidates/ScheduleInterviewModal';
import { EmailModal } from '@/components/candidates/EmailModal';

interface Candidate {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: 'pending' | 'in_progress' | 'confirmed' | 'rejected' | 'issue';
  current_stage_id: string;
  token: string;
  resume_file_url: string | null;
  parsed_data: {
    match_score?: number;
    skills?: string[];
    experience?: string;
    education?: string;
    location?: string;
    resume_file_name?: string;
    resume_file_size?: number;
    resume_uploaded_at?: string;
  } | null;
  skills: string[] | null;
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
    name?: string;
  };
}

interface CandidateDetailClientProps {
  candidate: Candidate;
  schedules: Schedule[];
  timelineEvents: TimelineEvent[];
}

export function CandidateDetailClient({ candidate, schedules, timelineEvents }: CandidateDetailClientProps) {
  const router = useRouter();
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

  // 타임라인 이벤트 타입별 아이콘 및 색상
  const getTimelineEventIcon = (type: string) => {
    switch (type) {
      case 'scorecard':
        return <StarIcon className="w-5 h-5 text-blue-600" />;
      case 'email':
        return <Mail className="w-5 h-5 text-blue-600" />;
      case 'comment':
        return <FileText className="w-5 h-5 text-green-600" />;
      case 'stage_changed':
        return <ArrowRightCircle className="w-5 h-5 text-orange-600" />;
      case 'schedule_created':
      case 'schedule_confirmed':
        return <Calendar className="w-5 h-5 text-blue-600" />;
      default:
        return <FileText className="w-5 h-5 text-gray-600" />;
    }
  };

  const getTimelineEventColor = (type: string) => {
    switch (type) {
      case 'scorecard':
        return 'text-blue-600';
      case 'email':
        return 'text-blue-600';
      case 'comment':
        return 'text-green-600';
      case 'stage_changed':
        return 'text-orange-600';
      default:
        return 'text-gray-600';
    }
  };

  // 별점 렌더링
  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    );
  };

  // 파일명 추출
  const getFileName = () => {
    if (candidate.resume_file_url) {
      const parts = candidate.resume_file_url.split('/');
      return parts[parts.length - 1] || candidate.parsed_data?.resume_file_name || 'resume.pdf';
    }
    return candidate.parsed_data?.resume_file_name || 'resume.pdf';
  };

  // 파일 크기 포맷팅
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // 날짜 포맷팅
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  // 상대 시간 포맷팅
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '방금 전';
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays < 7) return `${diffDays}일 전`;
    return formatDate(dateString);
  };

  // 타임라인 이벤트 내용 렌더링
  const renderTimelineContent = (event: TimelineEvent) => {
    switch (event.type) {
      case 'scorecard':
        const rating = event.content?.overall_rating || event.content?.rating;
        return (
          <div className="space-y-2">
            <p className="text-sm text-gray-900">{event.content?.notes || event.content?.message || '평가가 작성되었습니다.'}</p>
            {rating && renderStars(rating)}
          </div>
        );
      case 'email':
        return (
          <div className="space-y-1">
            {event.content?.subject && (
              <p className="text-sm font-medium text-gray-900">{event.content.subject}</p>
            )}
            <p className="text-sm text-gray-700">{event.content?.body || event.content?.message || '이메일이 발송되었습니다.'}</p>
            {event.content?.from_email && event.content?.to_email && (
              <p className="text-xs text-gray-500 mt-1">
                From: {event.content.from_email} To: {event.content.to_email}
              </p>
            )}
          </div>
        );
      case 'comment':
        return (
          <p className="text-sm text-gray-900">{event.content?.content || event.content?.message || '코멘트가 작성되었습니다.'}</p>
        );
      case 'stage_changed':
        return (
          <p className="text-sm text-gray-900">
            {event.content?.from_stage || '이전 단계'} → {event.content?.to_stage || event.content?.message || '다음 단계'}
          </p>
        );
      default:
        return (
          <p className="text-sm text-gray-900">{event.content?.message || event.type}</p>
        );
    }
  };

  // 위치 정보 가져오기
  const location = candidate.parsed_data?.location || '';
  
  // 스킬 목록 (parsed_data.skills 또는 candidates.skills 사용)
  const skills = candidate.parsed_data?.skills || candidate.skills || [];

  return (
    <div className="h-full overflow-auto bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* Header with Close Button */}
        <div className="flex items-start justify-between mb-4 sm:mb-6">
          <div className="flex-1 min-w-0">
            {/* Candidate Overview */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6 mb-4 sm:mb-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 truncate">{candidate.name}</h1>
                  {candidate.job_posts?.title && (
                    <p className="text-base sm:text-lg text-gray-600 truncate">{candidate.job_posts.title}</p>
                  )}
                </div>
                <button
                  onClick={() => router.back()}
                  className="flex-shrink-0 p-2 hover:bg-gray-100 rounded-full transition-colors"
                  aria-label="닫기"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 mt-4">
                <Button
                  onClick={() => setIsScheduleModalOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto"
                  size="lg"
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Schedule Interview
                </Button>
                <Button
                  onClick={() => setIsEmailModalOpen(true)}
                  variant="outline"
                  className="border-gray-300 w-full sm:w-auto"
                  size="lg"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Email
                </Button>
              </div>
            </div>

            {/* Match Score */}
            {candidate.parsed_data?.match_score !== undefined && (
              <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6 mb-4 sm:mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-bold text-blue-600 uppercase tracking-wide">Match Score</h2>
                  <Sparkles className="w-4 h-4 text-blue-600 flex-shrink-0" />
                </div>
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-3xl sm:text-4xl font-bold text-blue-600">{candidate.parsed_data.match_score}</span>
                  <span className="text-lg sm:text-xl text-gray-500">/ 100</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${candidate.parsed_data.match_score}%` }}
                  />
                </div>
              </div>
            )}

            {/* Contact */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6 mb-4 sm:mb-6">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4">Contact</h2>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-sm text-gray-900 break-all">{candidate.email}</span>
                </div>
                {candidate.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span className="text-sm text-gray-900 break-all">{candidate.phone}</span>
                  </div>
                )}
                {location && (
                  <div className="flex items-center gap-3">
                    <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span className="text-sm text-gray-900">{location}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Skills */}
            {skills.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6 mb-4 sm:mb-6">
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4">Skills</h2>
                <div className="flex flex-wrap gap-2">
                  {skills.map((skill, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Resume Preview */}
            {candidate.resume_file_url ? (
              <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6 mb-4 sm:mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Resume</h2>
                  <a
                    href={candidate.resume_file_url || '#'}
                    download
                    className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </a>
                </div>
                
                {/* Resume File Info */}
                <div className="flex items-start gap-3 mb-4">
                  <FileIcon className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 break-words">{getFileName()}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatFileSize(candidate.parsed_data?.resume_file_size)} • Uploaded {formatDate(candidate.parsed_data?.resume_uploaded_at || candidate.created_at)}
                    </p>
                  </div>
                </div>

                {/* PDF Preview - 개선된 버전 */}
                <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                  <div className="aspect-[8.5/11] w-full relative min-h-[400px]">
                    {/* object 태그로 PDF 표시 (iframe보다 더 안정적) */}
                    <object
                      data={`${candidate.resume_file_url}#toolbar=0&navpanes=0&scrollbar=0`}
                      type="application/pdf"
                      className="w-full h-full"
                      aria-label="Resume Preview"
                    >
                      {/* Fallback: PDF를 로드할 수 없을 때 표시 */}
                      <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-gray-100">
                        <FileText className="w-12 h-12 text-gray-400 mb-3" />
                        <p className="text-sm text-gray-600 mb-2 text-center">
                          PDF 미리보기를 로드할 수 없습니다.
                        </p>
                        <p className="text-xs text-gray-500 mb-4 text-center">
                          브라우저에서 직접 열어 확인하세요.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(candidate.resume_file_url || '', '_blank')}
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          새 창에서 열기
                        </Button>
                      </div>
                    </object>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 mt-4">
                  <Button
                    variant="outline"
                    className="border-gray-300 w-full sm:w-auto"
                    onClick={() => window.open(candidate.resume_file_url || '', '_blank')}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    View Full Resume
                  </Button>
                </div>
              </div>
            ) : (
              // resume_file_url이 없을 때 표시
              <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6 mb-4 sm:mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Resume</h2>
                </div>
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <FileIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">이력서 파일이 업로드되지 않았습니다.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Activity Timeline */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4 mb-4">
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Activity Timeline</h2>
                <button className="text-sm text-blue-600 hover:text-blue-700 font-medium whitespace-nowrap">
                  + Add Evaluation
                </button>
              </div>
              {timelineEvents.length === 0 ? (
                <p className="text-sm text-gray-500 py-8 text-center">타임라인 이벤트가 없습니다.</p>
              ) : (
                <div className="relative">
                  {/* 타임라인 라인 */}
                  <div className="absolute left-4 sm:left-5 top-0 bottom-0 w-0.5 bg-gray-200" />
                  
                  <div className="space-y-4 sm:space-y-6">
                    {timelineEvents.map((event, index) => (
                      <div key={event.id} className="relative flex gap-3 sm:gap-4">
                        {/* 아이콘 */}
                        <div className="relative z-10 flex-shrink-0">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center">
                            {getTimelineEventIcon(event.type)}
                          </div>
                        </div>
                        
                        {/* 내용 */}
                        <div className="flex-1 pb-4 sm:pb-6 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs sm:text-sm font-medium ${getTimelineEventColor(event.type)} break-words`}>
                              {event.type === 'scorecard' && 'Technical Interview Evaluation'}
                              {event.type === 'email' && event.content?.subject ? event.content.subject : 'Interview Confirmation Sent'}
                              {event.type === 'comment' && 'Internal Note'}
                              {event.type === 'stage_changed' && 'Moved to Technical Interview'}
                              {event.type === 'schedule_created' && 'Interview Scheduled'}
                              {event.type === 'schedule_confirmed' && 'Interview Confirmed'}
                              {event.type === 'system_log' && 'Application Received'}
                              {!['scorecard', 'email', 'comment', 'stage_changed', 'schedule_created', 'schedule_confirmed', 'system_log'].includes(event.type) && event.type}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mb-2 break-words">
                            {event.created_by_user?.name || event.created_by_user?.email || 'System'} • {formatDate(event.created_at)} {new Date(event.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <div className="text-sm text-gray-700 break-words">
                            {renderTimelineContent(event)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Schedule Interview Modal */}
      <ScheduleInterviewModal
        candidateId={candidate.id}
        candidateName={candidate.name}
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
      />

      {/* Email Modal */}
      <EmailModal
        candidateId={candidate.id}
        candidateEmail={candidate.email}
        candidateName={candidate.name}
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
      />
    </div>
  );
}
