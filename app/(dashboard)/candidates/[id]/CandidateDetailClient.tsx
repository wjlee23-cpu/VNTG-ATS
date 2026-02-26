'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  X, Mail, Phone, MapPin, Star, FileText, Download, Calendar, 
  Send, Sparkles, Star as StarIcon, ArrowRight, FileIcon, 
  MessageSquare, ArrowRightCircle, Archive, Eye, EyeOff, Plus, Folder,
  CheckCircle2, Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScheduleInterviewAutomatedModal } from '@/components/candidates/ScheduleInterviewAutomatedModal';
import { EmailModal } from '@/components/candidates/EmailModal';
import { ArchiveCandidateModal } from '@/components/candidates/ArchiveCandidateModal';
import { StageEvaluationModal } from '@/components/candidates/StageEvaluationModal';
import { DocumentPreviewModal } from '@/components/candidates/DocumentPreviewModal';
import { getStageEvaluations } from '@/api/queries/evaluations';
import { getResumeFilesByCandidate } from '@/api/queries/resume-files';
import { STAGE_ID_TO_NAME_MAP } from '@/constants/stages';
import { getUserProfile } from '@/api/queries/auth';

interface Candidate {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: 'pending' | 'in_progress' | 'confirmed' | 'rejected' | 'issue';
  current_stage_id: string;
  token: string;
  resume_file_url: string | null;
  ai_summary?: string | null;
  current_salary?: string | null;
  expected_salary?: string | null;
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

interface ResumeFile {
  id: string;
  candidate_id: string;
  file_url: string;
  file_type: string;
  parsing_status: string;
  parsed_data?: any;
  created_at: string;
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
  content: {
    message?: string;
    subject?: string;
    body?: string;
    from_email?: string;
    to_email?: string;
    overall_rating?: number;
    rating?: number;
    notes?: string;
    from_stage?: string;
    to_stage?: string;
    previous_status?: string;
    new_status?: string;
    stage_id?: string;
    result?: 'pass' | 'fail' | 'pending';
    stage_name?: string;
    [key: string]: unknown;
  };
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
  onClose?: () => void;
  isSidebar?: boolean;
}

export function CandidateDetailClient({ candidate, schedules, timelineEvents, onClose, isSidebar = false }: CandidateDetailClientProps) {
  const router = useRouter();
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [isEvaluationModalOpen, setIsEvaluationModalOpen] = useState(false);
  const [isDocumentPreviewOpen, setIsDocumentPreviewOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<ResumeFile | null>(null);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [resumeFiles, setResumeFiles] = useState<ResumeFile[]>([]);
  const [userRole, setUserRole] = useState<'admin' | 'recruiter' | 'interviewer' | 'hiring_manager'>('recruiter');
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoadingEvaluations, setIsLoadingEvaluations] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [showCompensation, setShowCompensation] = useState(false);

  // 평가 데이터 및 파일 로드
  useEffect(() => {
    if (candidate.id) {
      loadEvaluations();
      loadUserRole();
      loadResumeFiles();
    }
  }, [candidate.id]);

  const loadEvaluations = async () => {
    setIsLoadingEvaluations(true);
    try {
      const result = await getStageEvaluations(candidate.id);
      if (result.error) {
        console.error('Failed to load evaluations:', result.error);
      } else {
        setEvaluations(result.data || []);
      }
    } catch (error) {
      console.error('Load evaluations error:', error);
    } finally {
      setIsLoadingEvaluations(false);
    }
  };

  const loadResumeFiles = async () => {
    setIsLoadingFiles(true);
    try {
      const result = await getResumeFilesByCandidate(candidate.id);
      if (result.error) {
        console.error('Failed to load resume files:', result.error);
      } else {
        setResumeFiles(result.data || []);
      }
    } catch (error) {
      console.error('Load resume files error:', error);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const loadUserRole = async () => {
    try {
      const profile = await getUserProfile();
      if (profile.data) {
        setUserRole(profile.data.role as 'admin' | 'recruiter' | 'interviewer' | 'hiring_manager');
        setUserId(profile.data.id);
      }
    } catch (error) {
      console.error('Load user role error:', error);
      setUserRole('recruiter');
    }
  };

  // 닫기 핸들러
  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      router.back();
    }
  };

  // 타임라인 이벤트 타입별 아이콘 및 색상
  const getTimelineEventIcon = (type: string) => {
    switch (type) {
      case 'scorecard':
      case 'scorecard_created':
        return <StarIcon className="w-5 h-5 text-primary" />;
      case 'email':
      case 'email_received':
        return <Mail className="w-5 h-5 text-primary" />;
      case 'comment':
      case 'comment_created':
      case 'comment_updated':
        return <FileText className="w-5 h-5 text-primary" />;
      case 'stage_changed':
        return <ArrowRightCircle className="w-5 h-5 text-accent" />;
      case 'schedule_created':
      case 'schedule_confirmed':
      case 'schedule_regenerated':
        return <Calendar className="w-5 h-5 text-primary" />;
      case 'interviewer_response':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'position_changed':
        return <ArrowRightCircle className="w-5 h-5 text-blue-500" />;
      case 'archive':
        return <Archive className="w-5 h-5 text-accent" />;
      case 'stage_evaluation':
        return <StarIcon className="w-5 h-5 text-yellow-500" />;
      default:
        return <FileText className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getTimelineEventColor = (type: string) => {
    switch (type) {
      case 'scorecard':
      case 'scorecard_created':
        return 'text-primary';
      case 'email':
      case 'email_received':
        return 'text-primary';
      case 'comment':
      case 'comment_created':
      case 'comment_updated':
        return 'text-primary';
      case 'stage_changed':
        return 'text-accent';
      case 'schedule_created':
      case 'schedule_confirmed':
      case 'schedule_regenerated':
        return 'text-primary';
      case 'interviewer_response':
        return 'text-green-600';
      case 'position_changed':
        return 'text-blue-600';
      case 'archive':
        return 'text-accent';
      case 'stage_evaluation':
        return 'text-yellow-600';
      default:
        return 'text-muted-foreground';
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
  const getFileName = (fileUrl: string) => {
    const parts = fileUrl.split('/');
    return parts[parts.length - 1] || 'document';
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
            <p className="text-sm text-gray-700">{event.content?.notes || event.content?.message || '평가가 작성되었습니다.'}</p>
            {rating && renderStars(rating)}
          </div>
        );
      case 'email':
        return (
          <div className="space-y-1">
            <p className="text-sm text-gray-700">{event.content?.body || event.content?.message || '이메일이 발송되었습니다.'}</p>
            {event.content?.from_email && event.content?.to_email && (
              <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600 space-y-1">
                <p>From: {event.content.from_email}</p>
                <p>To: {event.content.to_email}</p>
                {event.content?.subject && (
                  <p>Subject: {event.content.subject}</p>
                )}
              </div>
            )}
          </div>
        );
      case 'comment':
        return (
          <div className="p-3 bg-green-50 rounded-lg">
            <p className="text-sm text-gray-700">{event.content?.content || event.content?.message || '코멘트가 작성되었습니다.'}</p>
          </div>
        );
      case 'stage_changed':
        return (
          <div className="space-y-2">
            <p className="text-sm text-gray-700">
              {event.content?.from_stage || '이전 단계'} → {event.content?.to_stage || event.content?.message || '다음 단계'}
            </p>
            {(event.content?.from_stage || event.content?.to_stage) && (
              <div className="flex gap-2">
                {event.content?.from_stage && (
                  <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                    {event.content.from_stage}
                  </span>
                )}
                {event.content?.to_stage && (
                  <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                    {event.content.to_stage}
                  </span>
                )}
              </div>
            )}
          </div>
        );
      case 'archive':
        return (
          <div className="space-y-1">
            <p className="text-sm text-gray-700">{event.content?.message || '후보자가 아카이브되었습니다.'}</p>
            {event.content?.archive_reason && (
              <p className="text-xs text-gray-500">사유: {event.content.archive_reason}</p>
            )}
          </div>
        );
      case 'stage_evaluation':
        const stageName = event.content?.stage_name || STAGE_ID_TO_NAME_MAP[event.content?.stage_id || ''] || '전형 평가';
        return (
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-900">{stageName} 평가</p>
            <p className="text-sm text-gray-700">{event.content?.notes || event.content?.message || '평가가 완료되었습니다.'}</p>
            {event.content?.result && (
              <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${
                event.content.result === 'pass' ? 'bg-green-100 text-green-800' :
                event.content.result === 'fail' ? 'bg-red-100 text-red-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                {event.content.result === 'pass' ? '합격' : event.content.result === 'fail' ? '불합격' : '대기중'}
              </span>
            )}
            {event.content?.rating && renderStars(event.content.rating)}
          </div>
        );
      case 'schedule_created':
      case 'schedule_regenerated':
        const scheduleOptions = event.content?.schedule_options as Array<{ id: string; scheduled_at: string }> | undefined;
        const retryCount = event.content?.retry_count as number | undefined;
        const originalDateRange = event.content?.original_date_range as { start: string; end: string } | undefined;
        
        return (
          <div className="space-y-3">
            <p className="text-sm text-gray-700">{event.content?.message || '면접 일정 자동화가 시작되었습니다.'}</p>
            
            {/* 일정 옵션 목록 */}
            {scheduleOptions && scheduleOptions.length > 0 && (
              <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-xs font-medium text-blue-900 mb-2">생성된 일정 옵션 ({scheduleOptions.length}개):</p>
                <div className="space-y-1">
                  {scheduleOptions.map((option, index) => {
                    const date = new Date(option.scheduled_at);
                    return (
                      <div key={option.id || index} className="text-xs text-blue-800">
                        <span className="font-medium">옵션 {index + 1}:</span>{' '}
                        {date.toLocaleDateString('ko-KR', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          weekday: 'short',
                        })}{' '}
                        {date.toLocaleTimeString('ko-KR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* 재시도 정보 */}
            {retryCount !== undefined && retryCount > 0 && (
              <div className="mt-2 p-2 bg-yellow-50 rounded border border-yellow-100">
                <p className="text-xs text-yellow-800">
                  <span className="font-medium">날짜 범위 확장:</span> 원본 날짜 범위에 일정이 없어 {retryCount}회 날짜 범위를 확장하여 검색했습니다.
                </p>
                {originalDateRange && (
                  <p className="text-xs text-yellow-700 mt-1">
                    원본 날짜 범위: {new Date(originalDateRange.start).toLocaleDateString('ko-KR')} ~ {new Date(originalDateRange.end).toLocaleDateString('ko-KR')}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      case 'interviewer_response':
        const response = event.content?.response as string | undefined;
        const interviewerEmail = event.content?.interviewer_email as string | undefined;
        const optionScheduledAt = event.content?.option_scheduled_at as string | undefined;
        const allAccepted = event.content?.all_accepted as boolean | undefined;
        
        return (
          <div className="space-y-2">
            <p className="text-sm text-gray-700">{event.content?.message || '면접관이 일정에 응답했습니다.'}</p>
            {allAccepted ? (
              <div className="mt-2 p-2 bg-green-50 rounded border border-green-100">
                <p className="text-xs text-green-800 font-medium">모든 면접관이 수락했습니다.</p>
                {optionScheduledAt && (
                  <p className="text-xs text-green-700 mt-1">
                    일정: {new Date(optionScheduledAt).toLocaleString('ko-KR')}
                  </p>
                )}
              </div>
            ) : interviewerEmail && response && (
              <div className="mt-2 p-2 bg-gray-50 rounded border border-gray-100">
                <p className="text-xs text-gray-700">
                  <span className="font-medium">{interviewerEmail}</span>님이{' '}
                  <span className={response === 'accepted' ? 'text-green-600 font-medium' : response === 'declined' ? 'text-red-600 font-medium' : 'text-yellow-600 font-medium'}>
                    {response === 'accepted' ? '수락' : response === 'declined' ? '거절' : '보류'}
                  </span>했습니다.
                </p>
                {optionScheduledAt && (
                  <p className="text-xs text-gray-600 mt-1">
                    일정: {new Date(optionScheduledAt).toLocaleString('ko-KR')}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      case 'position_changed':
        const previousJobTitle = event.content?.previous_job_post_title as string | undefined;
        const newJobTitle = event.content?.new_job_post_title as string | undefined;
        
        return (
          <div className="space-y-2">
            <p className="text-sm text-gray-700">{event.content?.message || '포지션이 변경되었습니다.'}</p>
            {previousJobTitle && newJobTitle && (
              <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-100">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-gray-600">{previousJobTitle}</span>
                  <ArrowRight className="w-3 h-3 text-blue-600" />
                  <span className="text-blue-800 font-medium">{newJobTitle}</span>
                </div>
              </div>
            )}
          </div>
        );
      case 'email_received':
        return (
          <div className="space-y-1">
            <p className="text-sm text-gray-700">{event.content?.message || '이메일을 수신했습니다.'}</p>
            {event.content?.from_email && event.content?.to_email && (
              <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600 space-y-1">
                <p>From: {event.content.from_email}</p>
                <p>To: {event.content.to_email}</p>
                {event.content?.subject && (
                  <p>Subject: {event.content.subject}</p>
                )}
              </div>
            )}
          </div>
        );
      case 'comment_created':
      case 'comment_updated':
        return (
          <div className="p-3 bg-green-50 rounded-lg">
            <p className="text-sm text-gray-700">{event.content?.content || event.content?.message || '코멘트가 작성되었습니다.'}</p>
            {event.content?.previous_content && (
              <div className="mt-2 p-2 bg-white rounded border border-gray-200">
                <p className="text-xs text-gray-500 mb-1">이전 내용:</p>
                <p className="text-xs text-gray-700 line-through">{event.content.previous_content}</p>
              </div>
            )}
          </div>
        );
      case 'scorecard_created':
        const scorecardRating = event.content?.overall_rating || event.content?.rating;
        return (
          <div className="space-y-2">
            <p className="text-sm text-gray-700">{event.content?.message || '면접 평가표가 작성되었습니다.'}</p>
            {scorecardRating && (
              <div className="mt-2">
                {renderStars(scorecardRating)}
                {event.content?.previous_rating && (
                  <div className="mt-2 text-xs text-gray-500">
                    이전 평가: {renderStars(event.content.previous_rating)}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      default:
        return (
          <p className="text-sm text-gray-700">{event.content?.message || event.type}</p>
        );
    }
  };

  // 타임라인 이벤트 제목 렌더링
  const getTimelineEventTitle = (event: TimelineEvent) => {
    switch (event.type) {
      case 'scorecard':
      case 'scorecard_created':
        return '면접 평가표 작성';
      case 'email':
        return event.content?.subject || '이메일 발송';
      case 'email_received':
        return event.content?.subject || '이메일 수신';
      case 'comment':
      case 'comment_created':
        return '코멘트 작성';
      case 'comment_updated':
        return '코멘트 수정';
      case 'stage_changed':
        return '전형 단계 변경';
      case 'schedule_created':
        return '면접 일정 생성';
      case 'schedule_confirmed':
        return '면접 일정 확정';
      case 'schedule_regenerated':
        return '면접 일정 재생성';
      case 'interviewer_response':
        return event.content?.all_accepted ? '모든 면접관 수락' : '면접관 응답';
      case 'position_changed':
        return '포지션 변경';
      case 'system_log':
        return '시스템 로그';
      case 'archive':
        return '아카이브';
      case 'stage_evaluation':
        const stageName = event.content?.stage_name || STAGE_ID_TO_NAME_MAP[event.content?.stage_id || ''] || '전형 평가';
        return `${stageName} 평가`;
      default:
        return event.type;
    }
  };

  // 위치 정보 가져오기
  const location = candidate.parsed_data?.location || '';
  
  // 스킬 목록
  const skills = candidate.parsed_data?.skills || candidate.skills || [];

  // Compensation 권한 체크
  const canViewCompensation = ['admin', 'recruiter', 'hiring_manager'].includes(userRole);

  // 문서 열기 핸들러
  const handleDocumentClick = (file: ResumeFile) => {
    setSelectedDocument(file);
    setIsDocumentPreviewOpen(true);
  };

  return (
    <div className={`h-full overflow-auto ${isSidebar ? 'bg-background' : 'bg-gray-50'}`}>
      <div className={`${isSidebar ? 'px-4 sm:px-6 py-4 sm:py-6' : 'w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8'}`}>
        {/* Header with Close Button */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1 min-w-0">
            {/* Candidate Header - 이미지와 동일한 레이아웃 */}
            <div className="flex items-center gap-4 mb-4">
              {/* 프로필 이미지 */}
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold text-xl flex-shrink-0">
                {candidate.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold text-gray-900 mb-1">{candidate.name}</h1>
                {candidate.job_posts?.title && (
                  <p className="text-base text-gray-600">{candidate.job_posts.title}</p>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="flex-shrink-0 p-2 hover:bg-gray-100 rounded-full transition-colors ml-4"
            aria-label="닫기"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <Button
            onClick={() => setIsScheduleModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
            size="default"
          >
            <Calendar className="w-4 h-4 mr-2" />
            Schedule Interview
          </Button>
          {schedules.length > 0 && (
            <Button
              onClick={() => router.push(`/schedules?candidate=${candidate.id}`)}
              variant="outline"
              className="border-gray-300 bg-white"
              size="default"
            >
              <Settings className="w-4 h-4 mr-2" />
              일정 조율 관리
            </Button>
          )}
          <Button
            onClick={() => setIsEmailModalOpen(true)}
            variant="outline"
            className="border-gray-300 bg-white"
            size="default"
          >
            <Send className="w-4 h-4 mr-2" />
            Email
          </Button>
        </div>

        {/* Match Score - 파란색 배경 카드 */}
        {candidate.parsed_data?.match_score !== undefined && (
          <div className="bg-blue-50 rounded-lg border border-blue-100 p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold text-blue-600 uppercase tracking-wide">Match Score</h2>
                  <Sparkles className="w-4 h-4 text-blue-600 flex-shrink-0" />
                </div>
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-4xl font-bold text-blue-600">{candidate.parsed_data.match_score}</span>
                  <span className="text-xl text-gray-500">/ 100</span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-2 mb-4">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${candidate.parsed_data.match_score}%` }}
                  />
            </div>
            {/* AI SUMMARY 박스 - 같은 카드 안에 */}
            {candidate.ai_summary && (
              <div className="mt-4 p-4 bg-white rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-semibold text-blue-900">AI SUMMARY</h3>
                </div>
                <p className="text-sm text-gray-700">{candidate.ai_summary}</p>
              </div>
            )}
          </div>
        )}

        {/* Contact */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
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

        {/* Compensation - 권한이 있는 경우만 표시 */}
        {canViewCompensation && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Compensation</h2>
                  {showCompensation && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowCompensation(false)}
                      className="text-gray-600 hover:text-gray-900"
                    >
                      <EyeOff className="w-4 h-4 mr-2" />
                      Hide
                    </Button>
                  )}
                </div>
                {!showCompensation ? (
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">Click to view sensitive data</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowCompensation(true)}
                    >
                      View
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-white border border-gray-200 rounded-lg">
                      <p className="text-xs text-gray-500 mb-1">Current</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {candidate.current_salary || 'N/A'}
                      </p>
                    </div>
                    <div className="p-4 bg-white border border-gray-200 rounded-lg">
                      <p className="text-xs text-gray-500 mb-1">Expected</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {candidate.expected_salary || 'N/A'}
                      </p>
                    </div>
            </div>
          )}
        </div>
        )}

        {/* Skills */}
        {skills.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
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

        {/* Documents - 여러 파일 지원 */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Documents</h2>
                {resumeFiles.length > 0 && (
                  <span className="text-xs text-gray-500">{resumeFiles.length} files</span>
                )}
              </div>
              {isLoadingFiles ? (
                <p className="text-sm text-gray-500 py-4 text-center">파일을 불러오는 중...</p>
              ) : resumeFiles.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <FileIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">첨부 파일이 없습니다.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {resumeFiles.map((file) => {
                    const fileName = getFileName(file.file_url);
                    const fileSize = file.parsed_data?.file_size;
                    return (
                      <div
                        key={file.id}
                        onClick={() => handleDocumentClick(file)}
                        className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        {file.file_type === 'pdf' ? (
                          <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        ) : (
                          <Folder className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 break-words">{fileName}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {fileSize ? formatFileSize(fileSize) : 'Unknown size'} • {formatDate(file.created_at)}
                          </p>
                        </div>
                        <Download className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
                      </div>
                    );
                  })}
            </div>
          )}
        </div>

        {/* Activity Timeline */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Activity Timeline</h2>
                {candidate.current_stage_id && (
                  <Button
                    onClick={() => setIsEvaluationModalOpen(true)}
                    variant="outline"
                    size="sm"
                    className="border-blue-300 text-blue-700 hover:bg-blue-50"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Evaluation
                  </Button>
                )}
              </div>
              {timelineEvents.length === 0 ? (
                <p className="text-sm text-gray-500 py-8 text-center">타임라인 이벤트가 없습니다.</p>
              ) : (
                <div className="relative">
                  {/* 타임라인 라인 */}
                  <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200" />
                  
                  <div className="space-y-6">
                    {timelineEvents.map((event) => (
                      <div key={event.id} className="relative flex gap-4">
                        {/* 아이콘 */}
                        <div className="relative z-10 flex-shrink-0">
                          <div className="w-10 h-10 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center">
                            {getTimelineEventIcon(event.type)}
                          </div>
                        </div>
                        
                        {/* 내용 */}
                        <div className="flex-1 pb-6 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-sm font-medium ${getTimelineEventColor(event.type)}`}>
                              {getTimelineEventTitle(event)}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mb-2">
                            {event.created_by_user?.name || event.created_by_user?.email || 'System'} • {formatDate(event.created_at)} {new Date(event.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} • {formatRelativeTime(event.created_at)}
                          </p>
                          <div className="text-sm text-gray-700">
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

      {/* Schedule Interview Automated Modal */}
      <ScheduleInterviewAutomatedModal
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

      {/* Archive Modal */}
      <ArchiveCandidateModal
        candidateId={candidate.id}
        candidateName={candidate.name}
        isOpen={isArchiveModalOpen}
        onClose={() => {
          setIsArchiveModalOpen(false);
          router.refresh();
        }}
      />

      {/* Evaluation Modal */}
      {candidate.current_stage_id && (
        <StageEvaluationModal
          candidateId={candidate.id}
          candidateName={candidate.name}
          stageId={candidate.current_stage_id}
          stageName={STAGE_ID_TO_NAME_MAP[candidate.current_stage_id] || candidate.current_stage_id}
          existingEvaluation={userId ? evaluations
            .filter(e => e.stage_id === candidate.current_stage_id)
            .find(e => e.evaluator_id === userId) : undefined}
          isOpen={isEvaluationModalOpen}
          onClose={() => {
            setIsEvaluationModalOpen(false);
            loadEvaluations();
            router.refresh();
          }}
        />
      )}

      {/* Document Preview Modal */}
      <DocumentPreviewModal
        file={selectedDocument ? {
          id: selectedDocument.id,
          file_url: selectedDocument.file_url,
          file_type: selectedDocument.file_type,
        } : null}
        isOpen={isDocumentPreviewOpen}
        onClose={() => {
          setIsDocumentPreviewOpen(false);
          setSelectedDocument(null);
        }}
      />
    </div>
  );
}
