'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  X, Mail, Phone, MapPin, Star, FileText, Download, Calendar, 
  Send, Sparkles, Star as StarIcon, ArrowRight, FileIcon, 
  MessageSquare, ArrowRightCircle, Archive, Eye, EyeOff, Plus, Folder,
  CheckCircle2, Settings, ChevronDown, ArrowUp, ArrowDown, RefreshCw,
  ArrowUpRight, ArrowDownLeft, Trash2, Upload, Clock, Users, Loader2, AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { EmailModal } from '@/components/candidates/EmailModal';
import { ArchiveCandidateModal } from '@/components/candidates/ArchiveCandidateModal';
import { StageEvaluationModal } from '@/components/candidates/StageEvaluationModal';
import { CommentModal } from '@/components/candidates/CommentModal';
import { DocumentPreviewModal } from '@/components/candidates/DocumentPreviewModal';
import { MatchScoreSection } from '@/components/candidates/MatchScoreSection';
import { getStageEvaluations } from '@/api/queries/evaluations';
import { getResumeFilesByCandidate } from '@/api/queries/resume-files';
import { getCandidateById } from '@/api/queries/candidates';
import { getTimelineEvents } from '@/api/queries/timeline';
import { STAGE_ID_TO_NAME_MAP } from '@/constants/stages';
import { getUserProfile } from '@/api/queries/auth';
import { skipStage, moveToStage, getAvailableStagesAction } from '@/api/actions/evaluations';
import { syncCandidateEmails } from '@/api/actions/emails';
import { updateCandidate, triggerAIAnalysis } from '@/api/actions/candidates';
import { uploadResumeFile, deleteResumeFile } from '@/api/actions/resume-files';
import { scheduleInterviewAutomated } from '@/api/actions/schedules';
import { getUsers } from '@/api/queries/users';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale/ko';
import { cn } from '@/components/ui/utils';

interface Candidate {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: 'pending' | 'in_progress' | 'confirmed' | 'rejected' | 'issue';
  current_stage_id: string | null;
  token: string;
  resume_file_url: string | null;
  ai_score?: number | null;
  ai_summary?: string | null;
  ai_strengths?: string[] | null;
  ai_weaknesses?: string[] | null;
  ai_analysis_status?: 'pending' | 'processing' | 'completed' | 'failed' | null;
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
  original_name?: string | null; // 원본 파일명 (한글 포함 가능)
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

export function CandidateDetailClient({ candidate: initialCandidate, schedules, timelineEvents, onClose, isSidebar = false }: CandidateDetailClientProps) {
  const router = useRouter();
  // 후보자 데이터를 상태로 관리하여 부분 업데이트 가능하도록 함
  const [candidate, setCandidate] = useState<Candidate>(initialCandidate);
  // View 모드: 'detail' 또는 'scheduling'
  const [viewMode, setViewMode] = useState<'detail' | 'scheduling'>('detail');
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [isEvaluationModalOpen, setIsEvaluationModalOpen] = useState(false);
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  const [isDocumentPreviewOpen, setIsDocumentPreviewOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<ResumeFile | null>(null);
  const [pdfLoadError, setPdfLoadError] = useState<string | null>(null);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [resumeFiles, setResumeFiles] = useState<ResumeFile[]>([]);
  // 타임라인 이벤트를 상태로 관리하여 부분 업데이트 가능하도록 함
  const [timelineEventsState, setTimelineEventsState] = useState<TimelineEvent[]>(timelineEvents);
  const [userRole, setUserRole] = useState<'admin' | 'recruiter' | 'interviewer' | 'hiring_manager'>('recruiter');
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoadingEvaluations, setIsLoadingEvaluations] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [showCompensation, setShowCompensation] = useState(false);
  
  // 스케줄링 폼 상태
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [users, setUsers] = useState<Array<{ id: string; email: string; role: string }>>([]);
  const [scheduleFormData, setScheduleFormData] = useState({
    dateRange: { from: undefined, to: undefined } as { from: Date | undefined, to: Date | undefined },
    duration_minutes: '60',
    stage_id: 'stage-6',
    interviewer_ids: [] as string[],
    num_options: '2',
  });
  const [scheduleWarning, setScheduleWarning] = useState<string | null>(null);

  // current_stage_id가 null이거나 빈 문자열인 경우 기본값 설정 (방어적 코딩)
  const currentStageId = (candidate.current_stage_id && candidate.current_stage_id.trim() !== '') 
    ? candidate.current_stage_id 
    : 'stage-1';
  const [isStagePopoverOpen, setIsStagePopoverOpen] = useState(false);
  const [availableStages, setAvailableStages] = useState<Array<{ id: string; name: string; order: number; isCurrent: boolean }>>([]);
  const [isLoadingStages, setIsLoadingStages] = useState(false);
  // 이메일 확장 상태 관리 (이벤트 ID -> 확장 여부)
  const [expandedEmails, setExpandedEmails] = useState<Set<string>>(new Set());
  // 이메일 동기화 상태
  const [isSyncingEmails, setIsSyncingEmails] = useState(false);
  // 수정 모드 상태
  const [isEditMode, setIsEditMode] = useState(false);
  // 수정 폼 데이터
  const [editFormData, setEditFormData] = useState({
    email: candidate.email,
    phone: candidate.phone || '',
    current_salary: candidate.current_salary || '',
    expected_salary: candidate.expected_salary || '',
  });
  // 파일 업로드 상태
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  // 후보자 데이터 새로고침 상태 (전체 화면 오버레이 방지용)
  const [isRefreshingCandidate, setIsRefreshingCandidate] = useState(false);

  // 후보자 데이터를 부분 업데이트하는 함수 (백그라운드에서 실행, 화면 깜빡임 최소화)
  const refreshCandidateData = async () => {
    setIsRefreshingCandidate(true);
    try {
      const result = await getCandidateById(candidate.id);
      if (result.data) {
        setCandidate(result.data);
      }
    } catch (error) {
      console.error('[CandidateDetailClient] 후보자 데이터 업데이트 실패:', error);
      // 에러가 발생해도 기존 데이터는 유지
    } finally {
      setIsRefreshingCandidate(false);
    }
  };

  // 타임라인 이벤트를 다시 로드하는 함수
  const refreshTimelineEvents = async () => {
    try {
      const result = await getTimelineEvents(candidate.id);
      if (result.data) {
        setTimelineEventsState(result.data);
      }
    } catch (error) {
      console.error('[CandidateDetailClient] 타임라인 이벤트 업데이트 실패:', error);
      // 에러가 발생해도 기존 데이터는 유지
    }
  };

  // 평가 데이터 및 파일 로드
  useEffect(() => {
    if (candidate.id) {
      loadEvaluations();
      loadUserRole();
      loadResumeFiles();
    }
  }, [candidate.id]);

  // 스케줄링 모드로 전환 시 사용자 목록 로드
  useEffect(() => {
    if (viewMode === 'scheduling') {
      loadUsers();
    }
  }, [viewMode]);

  // 사용자 목록 로드
  const loadUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const result = await getUsers();
      if (result.data) {
        setUsers(result.data.filter(u => u.role === 'interviewer' || u.role === 'admin'));
      }
    } catch (error) {
      console.error('사용자 목록 로드 실패:', error);
      toast.error('면접관 목록을 불러올 수 없습니다.');
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // 스케줄링 폼 제출
  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoadingSchedule(true);
    setScheduleWarning(null);

    try {
      // DateRange를 start_date, end_date 문자열로 변환
      const startDateStr = scheduleFormData.dateRange.from 
        ? format(scheduleFormData.dateRange.from, 'yyyy-MM-dd') 
        : '';
      const endDateStr = scheduleFormData.dateRange.to 
        ? format(scheduleFormData.dateRange.to, 'yyyy-MM-dd') 
        : '';

      const formDataToSend = new FormData();
      formDataToSend.append('candidate_id', candidate.id);
      formDataToSend.append('stage_id', scheduleFormData.stage_id);
      formDataToSend.append('start_date', startDateStr);
      formDataToSend.append('end_date', endDateStr);
      formDataToSend.append('duration_minutes', scheduleFormData.duration_minutes);
      formDataToSend.append('interviewer_ids', JSON.stringify(scheduleFormData.interviewer_ids));
      formDataToSend.append('num_options', scheduleFormData.num_options);

      const result = await scheduleInterviewAutomated(formDataToSend);

      if (result.error) {
        // 스마트 대안 UI: 알고리즘이 시간을 못 찾았을 때
        if (result.error.includes('일정을 찾을 수 없습니다') || result.error.includes('공통 가능 일정')) {
          setScheduleWarning(result.error);
        } else {
          toast.error(result.error);
        }
      } else {
        toast.success(result.message || '면접 일정 자동화가 시작되었습니다.');
        setViewMode('detail');
        // 후보자 데이터와 타임라인만 업데이트 (전체 페이지 리로드 방지)
        refreshCandidateData().catch((error) => {
          console.error('[CandidateDetailClient] 후보자 데이터 업데이트 실패:', error);
        });
        refreshTimelineEvents().catch((error) => {
          console.error('[CandidateDetailClient] 타임라인 업데이트 실패:', error);
        });
      }
    } catch (error) {
      toast.error('면접 일정 자동화에 실패했습니다.');
      console.error(error);
    } finally {
      setIsLoadingSchedule(false);
    }
  };

  // 면접관 토글
  const toggleInterviewer = (userId: string) => {
    setScheduleFormData(prev => ({
      ...prev,
      interviewer_ids: prev.interviewer_ids.includes(userId)
        ? prev.interviewer_ids.filter(id => id !== userId)
        : [...prev.interviewer_ids, userId],
    }));
  };

  // 스케줄링 폼 유효성 검사
  const isScheduleFormValid = 
    scheduleFormData.dateRange.from && 
    scheduleFormData.dateRange.to && 
    scheduleFormData.interviewer_ids.length > 0 &&
    !isLoadingUsers;

  // 파일이 로드되면 첫 번째 파일을 기본 선택으로 설정
  useEffect(() => {
    if (resumeFiles.length > 0 && !selectedDocument) {
      setSelectedDocument(resumeFiles[0]);
    }
  }, [resumeFiles]);

  // AI 분석 자동 트리거: 이력서 파일이 있고 분석 상태가 null 또는 pending인 경우
  useEffect(() => {
    // 디버깅: 현재 상태 로그
    console.log('[CandidateDetailClient] AI 분석 트리거 체크:', {
      resumeFilesCount: resumeFiles.length,
      aiAnalysisStatus: candidate.ai_analysis_status,
      jobPostId: candidate.job_post_id,
      candidateId: candidate.id,
    });

    const shouldTriggerAnalysis = 
      resumeFiles.length > 0 && 
      (candidate.ai_analysis_status === null || candidate.ai_analysis_status === 'pending') &&
      candidate.job_post_id;

    if (shouldTriggerAnalysis) {
      console.log('[CandidateDetailClient] AI 분석 트리거 조건 만족 - 분석 시작');
      // AI 분석 시작 (비동기, 에러는 로그만 남김)
      triggerAIAnalysis(candidate.id)
        .then((result) => {
          console.log('[CandidateDetailClient] AI 분석 트리거 성공:', result);
          // 후보자 데이터 부분 업데이트 (ai_analysis_status가 'processing'으로 변경됨)
          refreshCandidateData();
        })
        .catch((err) => {
          console.error('[CandidateDetailClient] AI 분석 시작 실패:', err);
          // 에러가 발생해도 사용자에게는 조용히 처리 (이미 스켈레톤 UI가 표시됨)
        });
    } else {
      console.log('[CandidateDetailClient] AI 분석 트리거 조건 불만족:', {
        hasResumeFiles: resumeFiles.length > 0,
        isPendingOrNull: candidate.ai_analysis_status === null || candidate.ai_analysis_status === 'pending',
        hasJobPostId: !!candidate.job_post_id,
      });
    }
  }, [resumeFiles, candidate.ai_analysis_status, candidate.job_post_id, candidate.id, router]);

  // AI 분석 상태 polling: 분석이 진행 중일 때 주기적으로 상태 확인
  useEffect(() => {
    // 분석이 진행 중이 아니면 polling 중지
    if (candidate.ai_analysis_status !== 'processing') {
      return;
    }

    // 3초마다 상태 확인
    const intervalId = setInterval(async () => {
      try {
        const result = await getCandidateById(candidate.id);
        if (result.data) {
          const updatedCandidate = result.data;
          setCandidate(updatedCandidate);
          
          // 분석이 완료되거나 실패하면 polling 중지
          if (updatedCandidate.ai_analysis_status === 'completed' || 
              updatedCandidate.ai_analysis_status === 'failed') {
            clearInterval(intervalId);
            console.log('[CandidateDetailClient] AI 분석 상태 polling 종료:', updatedCandidate.ai_analysis_status);
          }
        }
      } catch (error) {
        console.error('[CandidateDetailClient] AI 분석 상태 확인 실패:', error);
        // 에러가 발생해도 polling은 계속 (일시적 네트워크 오류일 수 있음)
      }
    }, 3000); // 3초마다 확인

    // cleanup: 컴포넌트 언마운트 시 또는 상태 변경 시 interval 정리
    return () => {
      clearInterval(intervalId);
    };
  }, [candidate.ai_analysis_status, candidate.id]);

  const loadEvaluations = async () => {
    setIsLoadingEvaluations(true);
    try {
      const result = await getStageEvaluations(candidate.id);
      if (result.error) {
        console.error('Failed to load evaluations:', result.error);
        // 에러가 발생해도 빈 배열로 설정하여 UI가 깨지지 않도록 함
        setEvaluations([]);
      } else {
        setEvaluations(result.data || []);
      }
    } catch (error) {
      console.error('Load evaluations error:', error);
      // 에러가 발생해도 빈 배열로 설정
      setEvaluations([]);
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
        return <StarIcon className="w-5 h-5 text-yellow-600" />;
      case 'email':
      case 'email_received':
        return <Mail className="w-5 h-5 text-blue-600" />;
      case 'comment':
      case 'comment_created':
      case 'comment_updated':
        return <FileText className="w-5 h-5 text-slate-600" />;
      case 'stage_changed':
        return <ArrowRightCircle className="w-5 h-5 text-purple-600" />;
      case 'schedule_created':
      case 'schedule_confirmed':
      case 'schedule_regenerated':
        return <Calendar className="w-5 h-5 text-green-600" />;
      case 'interviewer_response':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'position_changed':
        return <ArrowRightCircle className="w-5 h-5 text-indigo-600" />;
      case 'archive':
        return <Archive className="w-5 h-5 text-orange-600" />;
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
        return 'text-yellow-600';
      case 'email':
      case 'email_received':
        return 'text-blue-600';
      case 'comment':
      case 'comment_created':
      case 'comment_updated':
        return 'text-slate-600';
      case 'stage_changed':
        return 'text-purple-600';
      case 'schedule_created':
      case 'schedule_confirmed':
      case 'schedule_regenerated':
        return 'text-green-600';
      case 'interviewer_response':
        return 'text-green-600';
      case 'position_changed':
        return 'text-indigo-600';
      case 'archive':
        return 'text-orange-600';
      case 'stage_evaluation':
        return 'text-yellow-600';
      default:
        return 'text-muted-foreground';
    }
  };

  // 타임라인 이벤트 아이콘 배경색
  const getTimelineEventIconBg = (type: string) => {
    switch (type) {
      case 'scorecard':
      case 'scorecard_created':
        return 'bg-yellow-50 border-yellow-200';
      case 'email':
      case 'email_received':
        return 'bg-blue-50 border-blue-200';
      case 'comment':
      case 'comment_created':
      case 'comment_updated':
        return 'bg-slate-50 border-slate-200';
      case 'stage_changed':
        return 'bg-purple-50 border-purple-200';
      case 'schedule_created':
      case 'schedule_confirmed':
      case 'schedule_regenerated':
        return 'bg-green-50 border-green-200';
      case 'interviewer_response':
        return 'bg-green-50 border-green-200';
      case 'position_changed':
        return 'bg-indigo-50 border-indigo-200';
      case 'archive':
        return 'bg-orange-50 border-orange-200';
      case 'stage_evaluation':
        return 'bg-yellow-50 border-yellow-200';
      default:
        return 'bg-card border-border';
    }
  };

  // 타임라인 이벤트 카드 배경색 및 테두리 색상
  const getTimelineEventCardBg = (type: string) => {
    switch (type) {
      case 'scorecard':
      case 'scorecard_created':
        return 'bg-yellow-50/30 border-yellow-200/50';
      case 'email':
      case 'email_received':
        return 'bg-blue-50/30 border-blue-200/50';
      case 'comment':
      case 'comment_created':
      case 'comment_updated':
        return 'bg-slate-50/30 border-slate-200/50';
      case 'stage_changed':
        return 'bg-purple-50/30 border-purple-200/50';
      case 'schedule_created':
      case 'schedule_confirmed':
      case 'schedule_regenerated':
        return 'bg-green-50/30 border-green-200/50';
      case 'interviewer_response':
        return 'bg-green-50/30 border-green-200/50';
      case 'position_changed':
        return 'bg-indigo-50/30 border-indigo-200/50';
      case 'archive':
        return 'bg-orange-50/30 border-orange-200/50';
      case 'stage_evaluation':
        return 'bg-yellow-50/30 border-yellow-200/50';
      default:
        return 'bg-card border-border';
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

  // 파일명 추출 (원본 파일명 우선 사용)
  const getFileName = (file: ResumeFile | string) => {
    // ResumeFile 객체가 전달된 경우 original_name 우선 사용
    if (typeof file === 'object' && file.original_name) {
      return file.original_name;
    }
    // original_name이 없거나 문자열(fileUrl)이 전달된 경우 URL에서 추출
    const fileUrl = typeof file === 'string' ? file : file.file_url;
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

  // HTML 태그 제거 및 텍스트 정리 헬퍼 함수
  const stripHtml = (html: string | undefined | null): string => {
    if (!html) return '';
    // HTML 태그 제거
    const text = html.replace(/<[^>]*>/g, '');
    // HTML 엔티티 디코딩
    const decoded = text
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    // 연속된 공백 정리
    return decoded.replace(/\s+/g, ' ').trim();
  };

  // 이메일 본문을 읽기 쉽게 포맷팅 (인용문, 줄바꿈 처리)
  const formatEmailBodyForDisplay = (body: string | undefined | null): string => {
    if (!body) return '';
    
    // HTML 태그 제거
    let text = body.replace(/<[^>]*>/g, '');
    
    // HTML 엔티티 디코딩
    text = text
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<p[^>]*>/gi, '');
    
    // 인용문 처리 (> 기호로 시작하는 줄)
    const lines = text.split('\n');
    const formattedLines = lines.map(line => {
      const trimmed = line.trim();
      // 인용문이면 그대로 유지 (나중에 스타일링)
      if (trimmed.startsWith('>')) {
        return trimmed;
      }
      return trimmed;
    });
    
    return formattedLines.join('\n').trim();
  };

  // 이메일 내용 포맷팅 (HTML 처리 및 줄바꿈 처리) - 기존 호환성 유지
  const formatEmailBody = (body: string | undefined | null): string => {
    return formatEmailBodyForDisplay(body);
  };

  // 이메일 본문이 긴지 확인 (200자 이상)
  const isLongEmail = (body: string | undefined | null): boolean => {
    if (!body) return false;
    const text = stripHtml(body);
    return text.length > 200;
  };

  // 타임라인 이벤트 내용 렌더링
  const renderTimelineContent = (event: TimelineEvent) => {
    switch (event.type) {
      case 'scorecard':
        const rating = event.content?.overall_rating || event.content?.rating;
        return (
          <div className="space-y-3">
            <p className="text-sm text-foreground">{event.content?.notes || event.content?.message || '평가가 작성되었습니다.'}</p>
            {rating && renderStars(rating)}
          </div>
        );
      case 'email':
      case 'email_received':
        const emailDirection = event.content?.direction || (event.type === 'email_received' ? 'inbound' : 'outbound');
        const emailBody = formatEmailBody(event.content?.body);
        const emailSubject = event.content?.subject || '제목 없음';
        const isLong = isLongEmail(event.content?.body);
        const isExpanded = expandedEmails.has(event.id);
        
        // 이메일 본문을 줄 단위로 분리
        const emailBodyLines = emailBody.split('\n');
        
        // 긴 이메일의 경우 처음 10줄만 표시 (또는 전체)
        const maxLines = 10;
        const displayLines = isLong && !isExpanded 
          ? emailBodyLines.slice(0, maxLines)
          : emailBodyLines;
        const hasMoreLines = emailBodyLines.length > maxLines;
        
        const toggleEmailExpansion = () => {
          setExpandedEmails(prev => {
            const newSet = new Set(prev);
            if (newSet.has(event.id)) {
              newSet.delete(event.id);
            } else {
              newSet.add(event.id);
            }
            return newSet;
          });
        };
        
        return (
          <div className="space-y-3">
            {/* 이메일 헤더 - 제목과 방향 배지 */}
            <div className="flex items-start gap-3 pb-3 border-b border-border/50">
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-foreground break-words mb-1">{emailSubject}</h4>
                <div className="flex items-center gap-2 mt-1.5">
                  <Badge 
                    variant={emailDirection === 'outbound' ? 'default' : 'secondary'}
                    className="text-xs flex items-center gap-1"
                  >
                    {emailDirection === 'outbound' ? (
                      <ArrowUpRight className="w-3 h-3" />
                    ) : (
                      <ArrowDownLeft className="w-3 h-3" />
                    )}
                    {emailDirection === 'outbound' ? '발신' : '수신'}
                  </Badge>
                  {(event.content?.from_email || event.content?.to_email) && (
                    <span className="text-xs text-muted-foreground">
                      {emailDirection === 'outbound' 
                        ? `To: ${event.content?.to_email || ''}`
                        : `From: ${event.content?.from_email || ''}`
                      }
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            {/* 이메일 본문 */}
            {emailBody && (
              <div className="p-4 bg-muted/30 rounded-lg border border-border/50">
                <div className="space-y-1.5 text-sm text-foreground leading-relaxed">
                  {displayLines.map((line, index) => {
                    const trimmed = line.trim();
                    const isEmpty = trimmed === '';
                    const isQuote = trimmed.startsWith('>');
                    
                    // 빈 줄 처리
                    if (isEmpty) {
                      return <div key={index} className="h-2" />;
                    }
                    
                    // 인용문 처리
                    if (isQuote) {
                      // 여러 개의 > 기호 처리 (중첩 인용문)
                      const quoteLevel = trimmed.match(/^>+/)?.[0].length || 1;
                      const quoteText = trimmed.substring(quoteLevel).trim();
                      return (
                        <div 
                          key={index} 
                          className={`pl-4 border-l-2 border-muted-foreground/30 text-muted-foreground italic ${
                            quoteLevel > 1 ? 'ml-2' : ''
                          }`}
                        >
                          {quoteText || '\u00A0'}
                        </div>
                      );
                    }
                    
                    // 일반 텍스트
                    return (
                      <div key={index} className="break-words">
                        {trimmed}
                      </div>
                    );
                  })}
                  {hasMoreLines && !isExpanded && (
                    <div className="pt-2 text-xs text-muted-foreground italic">
                      ... {emailBodyLines.length - maxLines}줄 더 있음
                    </div>
                  )}
                </div>
                {isLong && (
                  <button
                    onClick={toggleEmailExpansion}
                    className="mt-3 text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1.5 transition-colors duration-200"
                  >
                    {isExpanded ? (
                      <>
                        <ArrowUp className="w-3.5 h-3.5" />
                        접기
                      </>
                    ) : (
                      <>
                        <ArrowDown className="w-3.5 h-3.5" />
                        전체 내용 보기
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      case 'comment':
        return (
          <div className="p-3 bg-primary/5 rounded-lg border border-primary/10">
            <p className="text-sm text-foreground">{event.content?.content || event.content?.message || '코멘트가 작성되었습니다.'}</p>
          </div>
        );
      case 'stage_changed':
        return (
          <div className="space-y-3">
            <p className="text-sm text-foreground">
              {event.content?.from_stage || '이전 단계'} → {event.content?.to_stage || event.content?.message || '다음 단계'}
            </p>
            {(event.content?.from_stage || event.content?.to_stage) && (
              <div className="flex items-center gap-2 flex-wrap">
                {event.content?.from_stage && (
                  <Badge variant="outline" className="text-xs">
                    {event.content.from_stage}
                  </Badge>
                )}
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
                {event.content?.to_stage && (
                  <Badge variant="default" className="text-xs">
                    {event.content.to_stage}
                  </Badge>
                )}
              </div>
            )}
          </div>
        );
      case 'archive':
        return (
          <div className="space-y-2">
            <p className="text-sm text-foreground">{event.content?.message || '후보자가 아카이브되었습니다.'}</p>
            {event.content?.archive_reason && (
              <p className="text-xs text-muted-foreground">사유: {event.content.archive_reason}</p>
            )}
          </div>
        );
      case 'stage_evaluation':
        // stage_id가 있으면 STAGE_ID_TO_NAME_MAP에서 영문 이름을 우선 사용
        const stageName = event.content?.stage_id 
          ? (STAGE_ID_TO_NAME_MAP[event.content.stage_id] || event.content?.stage_name || '전형 평가')
          : (event.content?.stage_name || '전형 평가');
        return (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground">{stageName} 평가</p>
            <p className="text-sm text-foreground">{event.content?.notes || event.content?.message || '평가가 완료되었습니다.'}</p>
            {event.content?.result && (
              <Badge 
                variant={
                  event.content.result === 'pass' ? 'default' :
                  event.content.result === 'fail' ? 'destructive' :
                  'secondary'
                }
                className="text-xs"
              >
                {event.content.result === 'pass' ? '합격' : event.content.result === 'fail' ? '불합격' : '대기중'}
              </Badge>
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
              <div className="mt-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
                <p className="text-xs font-medium text-foreground mb-2">생성된 일정 옵션 ({scheduleOptions.length}개):</p>
                <div className="space-y-2">
                  {scheduleOptions.map((option, index) => {
                    const date = new Date(option.scheduled_at);
                    return (
                      <div key={option.id || index} className="text-xs text-foreground p-2 bg-card rounded border border-border">
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
              <div className="mt-2 p-3 bg-yellow-50/50 rounded-lg border border-yellow-200/50">
                <p className="text-xs text-foreground">
                  <span className="font-medium">날짜 범위 확장:</span> 원본 날짜 범위에 일정이 없어 {retryCount}회 날짜 범위를 확장하여 검색했습니다.
                </p>
                {originalDateRange && (
                  <p className="text-xs text-muted-foreground mt-1">
                    원본 날짜 범위: {new Date(originalDateRange.start).toLocaleDateString('ko-KR')} ~ {new Date(originalDateRange.end).toLocaleDateString('ko-KR')}
                  </p>
                )}
              </div>
            )}
            
            {/* Schedule Management로 이동 버튼 */}
            <div className="mt-3">
              <Button
                onClick={() => router.push(`/schedules?candidate=${candidate.id}`)}
                variant="outline"
                size="sm"
                className="border-border bg-card hover:bg-blue-50 hover:text-blue-700 transition-colors duration-200"
              >
                <Settings className="w-4 h-4 mr-2" />
                일정 조율 관리로 이동
              </Button>
            </div>
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
              <div className="mt-2 p-3 bg-green-50/50 rounded-lg border border-green-200/50">
                <p className="text-xs text-foreground font-medium">모든 면접관이 수락했습니다.</p>
                {optionScheduledAt && (
                  <p className="text-xs text-muted-foreground mt-1">
                    일정: {new Date(optionScheduledAt).toLocaleString('ko-KR')}
                  </p>
                )}
              </div>
            ) : interviewerEmail && response && (
              <div className="mt-2 p-3 bg-muted/50 rounded-lg border border-border">
                <p className="text-xs text-foreground">
                  <span className="font-medium">{interviewerEmail}</span>님이{' '}
                  <Badge 
                    variant={
                      response === 'accepted' ? 'default' : 
                      response === 'declined' ? 'destructive' : 
                      'secondary'
                    }
                    className="text-xs"
                  >
                    {response === 'accepted' ? '수락' : response === 'declined' ? '거절' : '보류'}
                  </Badge>했습니다.
                </p>
                {optionScheduledAt && (
                  <p className="text-xs text-muted-foreground mt-1">
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
              <div className="mt-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
                <div className="flex items-center gap-2 text-xs flex-wrap">
                  <Badge variant="outline" className="text-xs">{previousJobTitle}</Badge>
                  <ArrowRight className="w-4 h-4 text-primary" />
                  <Badge variant="default" className="text-xs">{newJobTitle}</Badge>
                </div>
              </div>
            )}
          </div>
        );
      case 'comment_created':
      case 'comment_updated':
        return (
          <div className="p-3 bg-primary/5 rounded-lg border border-primary/10">
            <p className="text-sm text-foreground">{event.content?.content || event.content?.message || '코멘트가 작성되었습니다.'}</p>
            {event.content?.previous_content && (
              <div className="mt-2 p-2 bg-card rounded border border-border">
                <p className="text-xs text-muted-foreground mb-1">이전 내용:</p>
                <p className="text-xs text-muted-foreground line-through">{event.content.previous_content}</p>
              </div>
            )}
          </div>
        );
      case 'scorecard_created':
        const scorecardRating = event.content?.overall_rating || event.content?.rating;
        return (
          <div className="space-y-3">
            <p className="text-sm text-foreground">{event.content?.message || '면접 평가표가 작성되었습니다.'}</p>
            {scorecardRating && (
              <div className="mt-2">
                {renderStars(scorecardRating)}
                {event.content?.previous_rating && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    이전 평가: {renderStars(event.content.previous_rating)}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      default:
        return (
          <p className="text-sm text-foreground">{event.content?.message || event.type}</p>
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
        // stage_id가 있으면 STAGE_ID_TO_NAME_MAP에서 영문 이름을 우선 사용
        const stageName = event.content?.stage_id 
          ? (STAGE_ID_TO_NAME_MAP[event.content.stage_id] || event.content?.stage_name || '전형 평가')
          : (event.content?.stage_name || '전형 평가');
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

  // 관리자/리크루터 권한 체크
  const canManageCandidate = userRole === 'admin' || userRole === 'recruiter';

  // 전형 이동 관련 상태
  const [isMovingStage, setIsMovingStage] = useState(false);

  // Popover 열릴 때 사용 가능한 단계 목록 로드
  const loadAvailableStages = async () => {
    // 디버깅: 현재 상태 확인
    console.log('loadAvailableStages - candidate:', {
      id: candidate.id,
      current_stage_id: currentStageId,
      job_post_id: candidate.job_posts?.id,
    });

    if (!candidate.job_posts?.id) {
      toast.error('채용 공고 정보를 찾을 수 없습니다.');
      setIsStagePopoverOpen(false);
      return;
    }

    // currentStageId는 이미 기본값이 설정되어 있으므로 항상 유효해야 함
    // 하지만 방어적으로 한 번 더 체크
    if (!currentStageId || currentStageId.trim() === '') {
      console.error('current_stage_id is missing after default value assignment:', {
        original: candidate.current_stage_id,
        computed: currentStageId,
      });
      toast.error('현재 전형 정보를 찾을 수 없습니다. 후보자의 전형 단계가 설정되지 않았습니다.');
      setIsStagePopoverOpen(false);
      return;
    }

    setIsLoadingStages(true);
    try {
      const result = await getAvailableStagesAction(candidate.job_posts.id, currentStageId);
      if (result.error) {
        console.error('getAvailableStagesAction error:', result.error);
        toast.error(result.error || '단계 목록을 불러오는데 실패했습니다.');
        setIsStagePopoverOpen(false);
      } else {
        console.log('Available stages loaded:', result.data);
        setAvailableStages(result.data || []);
      }
    } catch (error) {
      console.error('Load available stages error:', error);
      toast.error('단계 목록을 불러오는데 실패했습니다.');
      setIsStagePopoverOpen(false);
    } finally {
      setIsLoadingStages(false);
    }
  };

  // Popover 열림/닫힘 핸들러
  const handlePopoverOpenChange = (open: boolean) => {
    setIsStagePopoverOpen(open);
    if (open) {
      loadAvailableStages();
    }
  };

  // 특정 단계로 이동 핸들러
  const handleMoveToStage = async (targetStageId: string) => {
    // 디버깅: 현재 상태 확인
    console.log('handleMoveToStage - candidate:', {
      id: candidate.id,
      current_stage_id: currentStageId,
      targetStageId,
      job_post_id: candidate.job_posts?.id,
    });

    if (!currentStageId || currentStageId.trim() === '') {
      console.error('current_stage_id is missing in handleMoveToStage');
      toast.error('현재 전형 정보를 찾을 수 없습니다. 후보자의 전형 단계가 설정되지 않았습니다.');
      return;
    }

    if (!candidate.job_posts?.id) {
      toast.error('채용 공고 정보를 찾을 수 없습니다.');
      return;
    }

    if (currentStageId === targetStageId) {
      toast.error('이미 해당 단계에 있습니다.');
      return;
    }

    const targetStage = availableStages.find(s => s.id === targetStageId);
    if (!targetStage) {
      toast.error('이동할 수 없는 단계입니다.');
      return;
    }

    if (!confirm(`${targetStage.name}로 이동하시겠습니까?`)) {
      return;
    }

    setIsMovingStage(true);
    setIsStagePopoverOpen(false);
    try {
      const result = await moveToStage(candidate.id, targetStageId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`${targetStage.name}로 이동했습니다.`);
        // 후보자 데이터와 타임라인만 업데이트 (전체 페이지 리로드 방지)
        refreshCandidateData().catch((error) => {
          console.error('[CandidateDetailClient] 후보자 데이터 업데이트 실패:', error);
        });
        refreshTimelineEvents().catch((error) => {
          console.error('[CandidateDetailClient] 타임라인 업데이트 실패:', error);
        });
      }
    } catch (error) {
      toast.error('전형 이동 중 오류가 발생했습니다.');
      console.error('Move to stage error:', error);
    } finally {
      setIsMovingStage(false);
    }
  };


  // 문서 선택 핸들러 (인라인 미리보기용)
  const handleDocumentSelect = (file: ResumeFile) => {
    setSelectedDocument(file);
    setPdfLoadError(null); // 파일 변경 시 에러 상태 초기화
  };

  // 인라인 미리보기 렌더링 함수
  const renderInlinePreview = (file: ResumeFile | null) => {
    if (!file) {
      return (
        <div className="w-full h-[calc(100vh-400px)] min-h-[600px] flex flex-col items-center justify-center p-8 bg-muted/30 border border-border rounded-lg">
          <FileIcon className="w-16 h-16 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">파일을 선택하면 미리보기가 표시됩니다.</p>
        </div>
      );
    }

    if (file.file_type === 'pdf') {
      // PDF 로드 에러가 있는 경우 에러 메시지 표시
      if (pdfLoadError) {
        return (
          <div className="w-full h-[calc(100vh-400px)] min-h-[600px] flex flex-col items-center justify-center p-8 bg-muted/30 border border-border rounded-lg">
            <FileIcon className="w-16 h-16 text-destructive mb-4" />
            <p className="text-sm font-medium text-foreground mb-2 text-center">
              PDF 미리보기를 로드할 수 없습니다
            </p>
            <p className="text-xs text-muted-foreground mb-4 text-center max-w-md">
              {pdfLoadError}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPdfLoadError(null);
                }}
              >
                다시 시도
              </Button>
            </div>
          </div>
        );
      }

      return (
        <div className="w-full h-[calc(100vh-400px)] min-h-[700px] border border-border rounded-lg overflow-hidden bg-muted/30 relative">
          <iframe
            src={`${file.file_url}#toolbar=0&navpanes=0&scrollbar=0`}
            className="w-full h-full min-h-[700px]"
            title="PDF Preview"
            onLoad={(e) => {
              // iframe 로드 성공 시 에러 상태 초기화
              const iframe = e.target as HTMLIFrameElement;
              try {
                // iframe의 contentWindow에 접근할 수 있는지 확인 (CORS 문제일 수 있음)
                if (iframe.contentWindow) {
                  setPdfLoadError(null);
                }
              } catch (err) {
                // CORS 문제로 접근할 수 없는 경우는 정상 (다른 도메인)
                // 에러 상태는 유지하지 않음
              }
            }}
            onError={() => {
              // iframe 로드 실패 시 에러 상태 설정
              setPdfLoadError('PDF 파일을 로드할 수 없습니다. 파일이 손상되었거나 접근 권한이 없을 수 있습니다.');
            }}
          />
        </div>
      );
    }

    // DOC, DOCX 파일은 다운로드만 제공
    const fileName = getFileName(file);
    return (
      <div className="w-full h-[calc(100vh-400px)] min-h-[600px] flex flex-col items-center justify-center p-8 bg-muted/30 border border-border rounded-lg">
        <FileIcon className="w-16 h-16 text-muted-foreground mb-4" />
        <p className="text-sm text-foreground mb-2 text-center font-medium">
          {file.file_type.toUpperCase()} 파일은 브라우저에서 미리보기를 지원하지 않습니다.
        </p>
        <p className="text-xs text-muted-foreground mb-6 text-center">
          파일을 다운로드하여 확인해주세요.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const link = document.createElement('a');
            link.href = file.file_url;
            link.download = fileName;
            link.click();
          }}
        >
          <Download className="w-4 h-4 mr-2" />
          다운로드
        </Button>
      </div>
    );
  };

  // 이메일 동기화 핸들러
  const handleSyncEmails = async () => {
    setIsSyncingEmails(true);
    try {
      console.log('[클라이언트] 이메일 동기화 시작:', candidate.id, candidate.email);
      const result = await syncCandidateEmails(candidate.id, 90); // 최근 90일 이메일 동기화
      
      // 디버깅 정보를 브라우저 콘솔에 출력
      console.log('[클라이언트] 이메일 동기화 결과:', result);
      if (result.debug) {
        console.log('[클라이언트] 디버깅 정보:', result.debug);
        console.log('[클라이언트] 시도한 검색 쿼리 수:', result.debug.totalQueriesTried);
        console.log('[클라이언트] 성공한 검색 쿼리 수:', result.debug.successfulQueries);
        if (result.debug.queryResults) {
          console.log('[클라이언트] 검색 쿼리별 결과:');
          result.debug.queryResults.forEach((q: any, i: number) => {
            console.log(`  ${i + 1}. ${q.query} → ${q.count}개`);
          });
        }
      }
      
      if (result.error) {
        console.error('[클라이언트] 이메일 동기화 에러:', result.error);
        toast.error(result.error);
      } else {
        const syncedCount = result.synced || 0;
        if (syncedCount > 0) {
          toast.success(`${syncedCount}개의 이메일을 동기화했습니다.`);
        } else {
          // 디버깅 정보가 있으면 더 자세한 메시지 표시
          if (result.debug) {
            console.warn('[클라이언트] 동기화할 이메일이 없습니다. 디버깅 정보:', result.debug);
            toast.info(`동기화할 이메일이 없습니다. (시도한 검색: ${result.debug.totalQueriesTried}개, 성공: ${result.debug.successfulQueries}개)`, {
              duration: 5000,
            });
          } else {
            toast.info('동기화할 이메일이 없습니다.');
          }
        }
        // 타임라인만 새로고침 (전체 페이지 리로드 방지)
        refreshTimelineEvents().catch((error) => {
          console.error('[CandidateDetailClient] 타임라인 업데이트 실패:', error);
        });
      }
    } catch (error) {
      console.error('[클라이언트] 이메일 동기화 오류:', error);
      const errorMessage = error instanceof Error ? error.message : '이메일 동기화 중 오류가 발생했습니다.';
      
      // Gmail 권한 관련 에러인 경우 특별 처리
      if (errorMessage.includes('Gmail 읽기 권한') || errorMessage.includes('GMAIL_READ_SCOPE_MISSING')) {
        toast.error('Gmail 읽기 권한이 필요합니다. 구글 캘린더를 재연동하여 Gmail 읽기 권한을 승인해주세요.', {
          duration: 5000,
        });
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setIsSyncingEmails(false);
    }
  };

  // 현재 전형 단계 이름 가져오기
  // 1순위: STAGE_ID_TO_NAME_MAP에서 찾기 (영문 이름 우선)
  // 2순위: candidate.job_posts.processes.stages에서 찾기 (fallback)
  // 3순위: currentStageId 그대로 사용
  const getCurrentStageName = (): string => {
    if (!currentStageId) return 'New Application';
    
    // STAGE_ID_TO_NAME_MAP에서 찾기 (영문 이름 우선)
    if (STAGE_ID_TO_NAME_MAP[currentStageId]) {
      return STAGE_ID_TO_NAME_MAP[currentStageId];
    }
    
    // processes.stages 배열에서 현재 단계 찾기 (fallback)
    if (candidate.job_posts?.processes?.stages && Array.isArray(candidate.job_posts.processes.stages)) {
      const stage = candidate.job_posts.processes.stages.find(s => s.id === currentStageId);
      if (stage && stage.name) {
        return stage.name;
      }
    }
    
    // 모두 실패하면 currentStageId 그대로 반환
    return currentStageId;
  };
  
  const currentStageName = getCurrentStageName();

  // 수정 핸들러
  const handleSaveEdit = async () => {
    try {
      const formData = new FormData();
      formData.append('name', candidate.name);
      formData.append('email', editFormData.email);
      formData.append('phone', editFormData.phone);
      if (editFormData.current_salary !== null) {
        formData.append('current_salary', editFormData.current_salary);
      }
      if (editFormData.expected_salary !== null) {
        formData.append('expected_salary', editFormData.expected_salary);
      }

      const result = await updateCandidate(candidate.id, formData);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('후보자 정보가 수정되었습니다.');
        setIsEditMode(false);
        // 후보자 데이터만 업데이트 (전체 페이지 리로드 방지)
        refreshCandidateData().catch((error) => {
          console.error('[CandidateDetailClient] 후보자 데이터 업데이트 실패:', error);
        });
      }
    } catch (error: any) {
      toast.error(error.message || '수정 중 오류가 발생했습니다.');
    }
  };

  const handleCancelEdit = () => {
    setEditFormData({
      email: candidate.email,
      phone: candidate.phone || '',
      current_salary: candidate.current_salary || '',
      expected_salary: candidate.expected_salary || '',
    });
    setIsEditMode(false);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const result = await uploadResumeFile(candidate.id, formData);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('파일이 업로드되었습니다.');
        // 파일 목록을 먼저 즉시 업데이트 (사용자에게 빠른 피드백)
        loadResumeFiles();
        // 후보자 데이터는 백그라운드에서 업데이트 (화면 깜빡임 방지)
        // await 없이 실행하여 화면이 블로킹되지 않도록 함
        refreshCandidateData().catch((error) => {
          console.error('[CandidateDetailClient] 후보자 데이터 업데이트 실패:', error);
        });
      }
    } catch (error: any) {
      toast.error(error.message || '파일 업로드 중 오류가 발생했습니다.');
    } finally {
      setIsUploadingFile(false);
      // input 초기화
      event.target.value = '';
    }
  };

  // 파일 다운로드 핸들러 (모달 없이 바로 다운로드)
  const handleFileDownload = (file: ResumeFile) => {
    const fileName = getFileName(file);
    const link = document.createElement('a');
    link.href = file.file_url;
    link.download = fileName;
    link.click();
  };

  const handleFileDelete = async (fileId: string) => {
    if (!confirm('정말 이 파일을 삭제하시겠습니까?')) return;

    try {
      const result = await deleteResumeFile(fileId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('파일이 삭제되었습니다.');
        // 파일 목록을 먼저 즉시 업데이트 (사용자에게 빠른 피드백)
        loadResumeFiles();
        // 후보자 데이터는 백그라운드에서 업데이트 (AI 분석 상태 초기화 반영)
        // await 없이 실행하여 화면이 블로킹되지 않도록 함
        refreshCandidateData().catch((error) => {
          console.error('[CandidateDetailClient] 후보자 데이터 업데이트 실패:', error);
        });
      }
    } catch (error: any) {
      toast.error(error.message || '파일 삭제 중 오류가 발생했습니다.');
    }
  };

  // 면접 시간 옵션
  const durationOptions = [
    { value: '30', label: '30분' },
    { value: '60', label: '60분' },
    { value: '90', label: '90분' },
    { value: '120', label: '120분' },
  ];

  // 일정 옵션 개수
  const numOptionsList = [1, 2, 3, 4, 5];

  return (
    <>
    {/* 닫기 버튼 - DialogContent 내부 절대 위치 */}
    <button
      onClick={handleClose}
      className="absolute top-4 right-4 z-50 p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-lg hover:bg-white transition-colors text-slate-600 hover:text-slate-900"
      aria-label="닫기"
    >
      <X className="w-5 h-5" />
    </button>

    {/* 완벽한 반응형 Grid 레이아웃: 모바일(세로 스택) → PC(좌우 분할) */}
    <div className="flex flex-col md:grid md:grid-cols-12 h-full max-h-[90vh] overflow-hidden">
      {/* 좌측 프로필 영역 - 모바일: 위쪽, PC: 왼쪽 */}
      <div className="md:col-span-4 lg:col-span-3 bg-white p-6 border-b md:border-b-0 md:border-r border-slate-100 flex flex-col min-w-0 overflow-x-visible">
        {/* 대형 Avatar - 반응형 정렬 */}
        <div className="flex flex-col items-center md:items-start text-center md:text-left mb-6">
          <Avatar className="w-20 h-20 md:w-24 md:h-24 border-2 border-slate-200 shadow-md mb-4">
            <AvatarFallback className="bg-primary/10 text-primary text-3xl md:text-4xl font-bold">
              {candidate.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">{candidate.name}</h1>
          {candidate.job_posts?.title && (
            <p className="text-sm md:text-base text-muted-foreground mb-3">{candidate.job_posts.title}</p>
          )}
          {currentStageId && (
            <Badge 
              variant="secondary" 
              className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200 text-sm font-medium px-3 py-1"
            >
              {currentStageName}
            </Badge>
          )}
        </div>

        {/* 일정 등록 버튼 - 인터뷰, 과제전형, 역량검사, 레퍼런스체크 등 스케줄링 */}
        {canManageCandidate && (
          <Button
            onClick={() => setViewMode('scheduling')}
            className="w-full h-12 text-base whitespace-normal break-keep px-4 py-3 bg-gradient-to-r from-[#0248FF] to-[#5287FF] hover:from-[#0248FF]/90 hover:to-[#5287FF]/90 text-white shadow-md hover:shadow-lg transition-all duration-200"
          >
            <Calendar className="w-5 h-5 mr-2 flex-shrink-0" />
            <span className="break-words">일정 등록</span>
          </Button>
        )}

        {/* 기타 액션 버튼들 */}
        {canManageCandidate && (
          <div className="mt-4 space-y-2 min-w-0 w-full">
            <Button
              onClick={() => setIsEmailModalOpen(true)}
              variant="ghost"
              className="w-full justify-start text-slate-700 hover:bg-slate-100 hover:text-slate-900"
            >
              <Mail className="w-4 h-4 mr-2" />
              Email
            </Button>
            {/* 전형이동 버튼 - Popover로 단계 선택 */}
            <Popover open={isStagePopoverOpen} onOpenChange={handlePopoverOpenChange}>
              <PopoverTrigger asChild className="w-full min-w-0">
                <Button
                  variant="ghost"
                  className="w-full justify-start text-slate-700 hover:bg-slate-100 hover:text-slate-900 min-w-0"
                  disabled={isMovingStage}
                >
                  <ArrowRightCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                  {isMovingStage ? '이동 중...' : '전형이동'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2" align="start">
                {isLoadingStages ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground mr-2" />
                    <span className="text-sm text-muted-foreground">단계 목록 로딩 중...</span>
                  </div>
                ) : availableStages.length === 0 ? (
                  <div className="py-4 text-center">
                    <p className="text-sm text-muted-foreground">이동 가능한 단계가 없습니다.</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground px-2 py-1.5">전형 단계 선택</p>
                    {availableStages.map((stage) => (
                      <button
                        key={stage.id}
                        onClick={() => handleMoveToStage(stage.id)}
                        disabled={stage.isCurrent || isMovingStage}
                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                          stage.isCurrent
                            ? 'bg-muted text-muted-foreground cursor-not-allowed'
                            : 'hover:bg-blue-50 hover:text-blue-700 text-foreground cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>{stage.name}</span>
                          {stage.isCurrent && (
                            <Badge variant="secondary" className="text-xs">
                              현재
                            </Badge>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </PopoverContent>
            </Popover>
            <Button
              onClick={() => setIsArchiveModalOpen(true)}
              variant="ghost"
              className="w-full justify-start text-slate-700 hover:bg-slate-100 hover:text-slate-900"
            >
              <Archive className="w-4 h-4 mr-2" />
              아카이브
            </Button>
          </div>
        )}
      </div>

      {/* 우측 콘텐츠 영역 - 모바일: 아래쪽, PC: 오른쪽 (독립 스크롤) */}
      <div className="md:col-span-8 lg:col-span-9 bg-slate-50 p-6 md:p-8 overflow-y-auto">
        {/* View 전환 애니메이션 */}
        <div className={cn(
          "transition-all duration-300",
          viewMode === 'scheduling' ? "opacity-100 translate-x-0" : viewMode === 'detail' ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4"
        )}>
          {viewMode === 'detail' ? (
            <>
              {/* Detail View - 기존 정보 카드들 */}
              {/* Match Score - 프리미엄 AI 스타일 */}
              <MatchScoreSection 
                candidate={candidate} 
                hasResumeFile={resumeFiles.length > 0}
              />

                {/* Contact - 개별 카드 스타일 */}
                <div className="mb-6 bg-white border border-slate-100 rounded-xl p-6 shadow-sm card-modern">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">Contact</h3>
            {canManageCandidate && (
              <div className="flex gap-2">
                {isEditMode ? (
                  <>
                    <Button
                      onClick={handleSaveEdit}
                      size="sm"
                      className="bg-primary hover:bg-primary/90 text-white"
                    >
                      저장
                    </Button>
                    <Button
                      onClick={handleCancelEdit}
                      size="sm"
                      variant="outline"
                    >
                      취소
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => setIsEditMode(true)}
                    size="sm"
                    variant="outline"
                    className="hover:bg-blue-50 hover:text-blue-700 transition-colors"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    수정
                  </Button>
                )}
              </div>
            )}
          </div>
          <div className="space-y-4">
            {isEditMode ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="edit-email">이메일</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-phone">전화번호</Label>
                  <Input
                    id="edit-phone"
                    type="tel"
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                  />
                </div>
                {canViewCompensation && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="edit-current-salary">현재 연봉</Label>
                      <Input
                        id="edit-current-salary"
                        type="text"
                        value={editFormData.current_salary}
                        onChange={(e) => setEditFormData({ ...editFormData, current_salary: e.target.value })}
                        placeholder="예: 5000만원"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-expected-salary">희망 연봉</Label>
                      <Input
                        id="edit-expected-salary"
                        type="text"
                        value={editFormData.expected_salary}
                        onChange={(e) => setEditFormData({ ...editFormData, expected_salary: e.target.value })}
                        placeholder="예: 6000만원"
                      />
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors duration-200">
                  <Mail className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm text-foreground break-all">{candidate.email}</span>
                </div>
                {candidate.phone && (
                  <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors duration-200">
                    <Phone className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm text-foreground break-all">{candidate.phone}</span>
                  </div>
                )}
              </>
            )}
            {location && (
              <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors duration-200">
                <MapPin className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-foreground">{location}</span>
              </div>
            )}
          </div>
        </div>

                {/* Compensation - 권한이 있는 경우만 표시, 개별 카드 스타일 */}
                {canViewCompensation && (
                  <div className="mb-6 bg-white border border-slate-100 rounded-xl p-6 shadow-sm card-modern">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Compensation</h3>
              {showCompensation && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCompensation(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors duration-200"
                >
                  <EyeOff className="w-4 h-4 mr-2" />
                  Hide
                </Button>
              )}
            </div>
            <div>
              {!showCompensation ? (
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-dashed">
                  <p className="text-sm text-muted-foreground">Click to view sensitive data</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCompensation(true)}
                    className="hover:bg-blue-50 hover:text-blue-700 transition-colors"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-card border border-border rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200">
                    <p className="text-xs text-muted-foreground mb-2 font-medium">Current</p>
                    <p className="text-xl font-semibold text-foreground">
                      {candidate.current_salary || 'N/A'}
                    </p>
                  </div>
                  <div className="p-4 bg-card border border-border rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200">
                    <p className="text-xs text-muted-foreground mb-2 font-medium">Expected</p>
                    <p className="text-xl font-semibold text-foreground">
                      {candidate.expected_salary || 'N/A'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

                {/* Skills - Soft Badge 스타일 (bg-primary/5 text-primary) */}
                {skills.length > 0 && (
                  <div className="mb-6 bg-white border border-slate-100 rounded-xl p-6 shadow-sm card-modern">
                    <h3 className="text-lg font-semibold text-foreground mb-4">Skills</h3>
                    <div className="flex flex-wrap gap-2">
                      {skills.map((skill, index) => (
                        <Badge
                          key={index}
                          className="px-3 py-1.5 text-sm font-medium bg-primary/5 text-primary border-0 hover:bg-primary/10 transition-colors duration-200"
                        >
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Documents - 여러 파일 지원 + 인라인 미리보기 */}
                <Card 
                  id="documents-section" 
                  className="mb-6 shadow-md hover:shadow-lg transition-shadow duration-200 card-modern scroll-mt-6"
                >
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold">Documents</CardTitle>
              <div className="flex items-center gap-2">
                {resumeFiles.length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {resumeFiles.length} files
                  </Badge>
                )}
                {canManageCandidate && (
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={handleFileUpload}
                      disabled={isUploadingFile}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isUploadingFile}
                      className="cursor-pointer hover:bg-blue-50 hover:text-blue-700 transition-colors"
                      asChild
                    >
                      <span>
                        <Upload className="w-4 h-4 mr-2" />
                        {isUploadingFile ? '업로드 중...' : '파일 추가'}
                      </span>
                    </Button>
                  </label>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingFiles ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-sm text-muted-foreground">파일을 불러오는 중...</p>
              </div>
            ) : resumeFiles.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <FileIcon className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground">첨부 파일이 없습니다.</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {/* 파일 목록 (상단 - 가로 스크롤) */}
                <div className="overflow-x-auto pb-2">
                  <div className="flex gap-3 min-w-max">
                    {resumeFiles.map((file) => {
                      const fileName = getFileName(file);
                      const fileSize = file.parsed_data?.file_size;
                      const isSelected = selectedDocument?.id === file.id;
                      return (
                        <div
                          key={file.id}
                          onClick={() => handleDocumentSelect(file)}
                          className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-all duration-200 group whitespace-nowrap ${
                            isSelected
                              ? 'border-primary bg-primary/5 shadow-md'
                              : 'border-border hover:bg-blue-50 hover:shadow-md'
                          }`}
                        >
                          {file.file_type === 'pdf' ? (
                            <FileText className={`w-4 h-4 flex-shrink-0 transition-colors duration-200 ${
                              isSelected ? 'text-primary' : 'text-primary'
                            }`} />
                          ) : (
                            <Folder className={`w-4 h-4 flex-shrink-0 transition-colors duration-200 ${
                              isSelected ? 'text-primary' : 'text-muted-foreground'
                            }`} />
                          )}
                          <div className="flex flex-col min-w-0">
                            <p className={`text-xs font-medium truncate max-w-[200px] transition-colors duration-200 ${
                              isSelected ? 'text-primary font-semibold' : 'text-foreground group-hover:text-primary'
                            }`}>
                              {fileName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {fileSize ? formatFileSize(fileSize) : 'Unknown size'}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleFileDownload(file);
                              }}
                              className="flex-shrink-0 p-1 hover:bg-blue-50 rounded transition-colors duration-200"
                              title="다운로드"
                            >
                              <Download className={`w-4 h-4 transition-colors duration-200 ${
                                isSelected ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'
                              }`} />
                            </button>
                            {canManageCandidate && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleFileDelete(file.id);
                                }}
                                className="flex-shrink-0 p-1 hover:bg-destructive/10 rounded transition-colors duration-200"
                                title="파일 삭제"
                              >
                                <Trash2 className={`w-4 h-4 transition-colors duration-200 ${
                                  isSelected ? 'text-destructive' : 'text-muted-foreground group-hover:text-destructive'
                                }`} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {/* 미리보기 영역 (하단 - 전체 너비) */}
                <div className="w-full">
                  {renderInlinePreview(selectedDocument)}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

                {/* Activity Timeline */}
                <Card className="shadow-md hover:shadow-lg transition-shadow duration-200 card-modern">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <CardTitle className="text-lg font-semibold">Activity Timeline</CardTitle>
                {/* 이메일 동기화 버튼: 관리자/리크루터만 표시 */}
                {canManageCandidate && (
                  <Button
                    onClick={handleSyncEmails}
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 hover:bg-primary/10 transition-all duration-200"
                    disabled={isSyncingEmails}
                    title="이메일 동기화"
                  >
                    {isSyncingEmails ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                    ) : (
                      <RefreshCw className="w-4 h-4 text-primary" />
                    )}
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => setIsCommentModalOpen(true)}
                  variant="outline"
                  size="sm"
                  className="border-blue-500/30 text-blue-600 hover:bg-blue-50 transition-all duration-200"
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Add Comment
                </Button>
                {currentStageId && (
                  <Button
                    onClick={() => setIsEvaluationModalOpen(true)}
                    variant="outline"
                    size="sm"
                    className="border-primary/30 text-primary hover:bg-primary/10 transition-all duration-200"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Evaluation
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {timelineEventsState.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <MessageSquare className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground">타임라인 이벤트가 없습니다.</p>
                </div>
              </div>
            ) : (
              <div className="relative">
                {/* 타임라인 라인 - 개선된 스타일 */}
                <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-muted via-border to-muted" />
                
                <div className="space-y-6">
                  {timelineEventsState.map((event, index) => (
                    <div key={event.id} className="relative flex gap-4 group">
                      {/* 아이콘 - 개선된 스타일 */}
                      <div className="relative z-10 flex-shrink-0 flex items-center justify-center">
                        {/* 코멘트/평가/이메일 같은 사용자 작성 이벤트는 작성자 프로필(아바타)을 표시 */}
                        {(
                          (event.type === 'comment' ||
                            event.type === 'comment_created' ||
                            event.type === 'comment_updated' ||
                            event.type === 'email' ||
                            event.type === 'email_received' ||
                            event.type === 'stage_evaluation' ||
                            event.type === 'scorecard' ||
                            event.type === 'scorecard_created') &&
                          event.created_by_user
                        ) ? (
                          <Avatar className="w-12 h-12 border-2 shadow-sm group-hover:shadow-md group-hover:scale-105 transition-all duration-200">
                            <AvatarImage
                              src={(event.created_by_user as any)?.avatar_url || undefined}
                              alt={(event.created_by_user as any)?.name || (event.created_by_user as any)?.email || 'user'}
                            />
                            <AvatarFallback className="text-xs font-semibold">
                              {(((event.created_by_user as any)?.name || (event.created_by_user as any)?.email || '?') as string)
                                .trim()
                                .slice(0, 1)
                                .toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        ) : (
                          <div className="w-12 h-12 flex items-center justify-center">
                            <div className="w-2 h-2 rounded-full bg-brand-main ring-4 ring-brand-main/20" />
                          </div>
                        )}
                      </div>
                      
                      {/* 내용 - 피드 형태 카드 스타일 */}
                      <div className="flex-1 pb-6 min-w-0">
                        <div className="bg-white border border-slate-100 shadow-sm rounded-lg p-3 hover:shadow-md transition-all duration-200">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className={`text-sm font-semibold ${getTimelineEventColor(event.type)}`}>
                              {getTimelineEventTitle(event)}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {formatRelativeTime(event.created_at)}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mb-3">
                            {/* 'System' 문구는 제거: 작성자 정보가 없으면 날짜만 표시 */}
                            {(event.created_by_user?.name || event.created_by_user?.email)
                              ? (
                                <>
                                  {event.created_by_user?.name || event.created_by_user?.email} • {formatDate(event.created_at)} {new Date(event.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                </>
                              )
                              : (
                                <>
                                  {formatDate(event.created_at)} {new Date(event.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                </>
                              )}
                          </p>
                          <div className="text-sm text-foreground">
                            {renderTimelineContent(event)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
              </>
            ) : (
              <>
                {/* Scheduling View - 스케줄링 폼 */}
                <div className="space-y-6">
                  {/* 뒤로 가기 버튼 */}
                  <Button
                    onClick={() => setViewMode('detail')}
                    variant="ghost"
                    className="mb-4 -ml-3 px-3 py-2 w-fit flex items-center gap-2 hover:bg-yellow-100 hover:text-slate-900 rounded-md transition-colors text-slate-600"
                  >
                    <ArrowRight className="w-4 h-4 rotate-180" />
                    <span>뒤로 가기</span>
                  </Button>

                  <form onSubmit={handleScheduleSubmit} className="space-y-6">
                    {/* 후보자 정보 카드 */}
                    <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm card-modern">
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        후보자
                      </label>
                      <p className="text-base font-medium text-slate-900">{candidate.name}</p>
                    </div>

                    {/* 날짜 선택 카드 - 단일 Date Range Picker */}
                    <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm card-modern space-y-4">
                      <label className="block text-sm font-medium text-slate-700">
                        <Calendar className="w-4 h-4 inline mr-2 text-[#5287FF]" />
                        일정 검색 기간
                      </label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className={cn(
                              "w-full justify-start text-left font-normal px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5287FF] focus:border-transparent bg-white text-sm",
                              !scheduleFormData.dateRange.from && !scheduleFormData.dateRange.to && "text-slate-500",
                              scheduleFormData.dateRange.from && scheduleFormData.dateRange.to && "text-slate-900 font-medium"
                            )}
                          >
                            <Calendar className="mr-2 h-4 w-4 text-slate-500" />
                            {scheduleFormData.dateRange.from && scheduleFormData.dateRange.to ? (
                              // 모두 선택된 경우: "2026년 3월 16일 - 2026년 3월 20일"
                              `${format(scheduleFormData.dateRange.from, 'yyyy년 MM월 dd일', { locale: ko })} - ${format(scheduleFormData.dateRange.to, 'yyyy년 MM월 dd일', { locale: ko })}`
                            ) : scheduleFormData.dateRange.from ? (
                              // 시작일만 선택된 경우: "2026년 3월 16일 - (종료일 선택)"
                              `${format(scheduleFormData.dateRange.from, 'yyyy년 MM월 dd일', { locale: ko })} - (종료일 선택)`
                            ) : (
                              // 선택 안 된 경우: "기간을 선택해주세요"
                              <span>기간을 선택해주세요</span>
                            )}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[calc(100vw-2rem)] max-w-[320px] p-2 bg-white rounded-xl shadow-lg border border-slate-100" align="start">
                          <DateRangePicker
                            selected={scheduleFormData.dateRange}
                            onSelect={(range) => {
                              setScheduleFormData({ 
                                ...scheduleFormData, 
                                dateRange: range
                              });
                            }}
                            numberOfMonths={1}
                            disabled={(date) => {
                              const today = new Date();
                              today.setHours(0, 0, 0, 0);
                              return date < today;
                            }}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* 면접 시간 선택 - Segmented Control */}
                    <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm card-modern space-y-3">
                      <label className="block text-sm font-medium text-slate-700">
                        <Clock className="w-4 h-4 inline mr-2 text-[#5287FF]" />
                        면접 시간
                      </label>
                      <div className="bg-slate-100 p-1 rounded-xl flex gap-1">
                        {durationOptions.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setScheduleFormData({ ...scheduleFormData, duration_minutes: option.value })}
                            className={cn(
                              "flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                              scheduleFormData.duration_minutes === option.value
                                ? "bg-gradient-to-r from-[#0248FF] to-[#5287FF] text-white shadow-md"
                                : "bg-transparent text-slate-700 hover:bg-white/50"
                            )}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 면접 단계 선택 */}
                    <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm card-modern space-y-3">
                      <label htmlFor="stage_id" className="block text-sm font-medium text-slate-700">
                        면접 단계
                      </label>
                      <select
                        id="stage_id"
                        required
                        value={scheduleFormData.stage_id}
                        onChange={(e) => setScheduleFormData({ ...scheduleFormData, stage_id: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5287FF] focus:border-transparent bg-white text-slate-900 text-sm"
                      >
                        {Object.entries(STAGE_ID_TO_NAME_MAP).map(([id, name]) => (
                          <option key={id} value={id}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 일정 옵션 개수 - Segmented Control */}
                    <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm card-modern space-y-3">
                      <label className="block text-sm font-medium text-slate-700">
                        <Calendar className="w-4 h-4 inline mr-2 text-[#5287FF]" />
                        일정 옵션 개수
                      </label>
                      <div className="bg-slate-100 p-1 rounded-xl flex gap-1">
                        {numOptionsList.map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setScheduleFormData({ ...scheduleFormData, num_options: num.toString() })}
                            className={cn(
                              "flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                              scheduleFormData.num_options === num.toString()
                                ? "bg-gradient-to-r from-[#0248FF] to-[#5287FF] text-white shadow-md"
                                : "bg-transparent text-slate-700 hover:bg-white/50"
                            )}
                          >
                            {num}개
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 면접관 선택 - Avatar 토글 UI */}
                    <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm card-modern space-y-3">
                      <label className="block text-sm font-medium text-slate-700">
                        <Users className="w-4 h-4 inline mr-2 text-[#5287FF]" />
                        면접관 선택
                        <span className="text-xs font-normal text-slate-500 ml-2">
                          (최소 1명 이상)
                        </span>
                      </label>
                      {isLoadingUsers ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-5 h-5 animate-spin text-[#5287FF]" />
                          <span className="ml-2 text-sm text-slate-600">면접관 목록 로딩 중...</span>
                        </div>
                      ) : (
                        <>
                          {/* 면접관 선택 - 모바일: 가로 스크롤, PC: 그리드 */}
                          <div className="flex gap-3 overflow-x-auto md:grid md:grid-cols-4 lg:grid-cols-5 md:overflow-x-visible pb-2">
                            {users.length === 0 ? (
                              <p className="text-sm text-slate-500 text-center py-4 w-full">
                                면접관이 없습니다. 먼저 면접관을 등록해주세요.
                              </p>
                            ) : (
                              users.map((user) => {
                                const isSelected = scheduleFormData.interviewer_ids.includes(user.id);
                                return (
                                  <button
                                    key={user.id}
                                    type="button"
                                    onClick={() => toggleInterviewer(user.id)}
                                    className={cn(
                                      "flex flex-col items-center gap-2 p-3 rounded-xl transition-all min-w-[80px] md:min-w-0",
                                      isSelected
                                        ? "bg-blue-50/50 ring-2 ring-[#5287FF] shadow-sm"
                                        : "bg-slate-50 border border-slate-200 hover:bg-blue-50/30 hover:border-slate-300"
                                    )}
                                  >
                                    <Avatar className={cn(
                                      "w-12 h-12 border-2 transition-all",
                                      isSelected ? "border-[#5287FF]" : "border-slate-200"
                                    )}>
                                      <AvatarFallback className={cn(
                                        "text-sm font-medium",
                                        isSelected 
                                          ? "bg-[#5287FF]/10 text-[#5287FF]" 
                                          : "bg-slate-100 text-slate-600"
                                      )}>
                                        {user.email.charAt(0).toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="text-center">
                                      <p className="text-xs font-medium text-slate-700 truncate max-w-[70px]">
                                        {user.email.split('@')[0]}
                                      </p>
                                      {user.role === 'admin' && (
                                        <Badge 
                                          variant="outline" 
                                          className="mt-1 text-[10px] px-1.5 py-0 border-slate-300 text-slate-600"
                                        >
                                          관리자
                                        </Badge>
                                      )}
                                    </div>
                                  </button>
                                );
                              })
                            )}
                          </div>
                          {scheduleFormData.interviewer_ids.length === 0 && (
                            <p className="text-xs text-rose-600 mt-2">
                              최소 1명의 면접관을 선택해주세요.
                            </p>
                          )}
                        </>
                      )}
                    </div>

                    {/* 스마트 대안 UI - Warning Card */}
                    {scheduleWarning && (
                      <div className="bg-amber-50 text-amber-800 rounded-xl p-4 border border-amber-200 card-modern">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <h4 className="font-semibold mb-1">일정을 찾을 수 없습니다</h4>
                            <p className="text-sm">{scheduleWarning}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 제출 버튼 */}
                    <div className="flex gap-3 justify-end pt-4">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setViewMode('detail')} 
                        disabled={isLoadingSchedule}
                        className="px-6"
                      >
                        취소
                      </Button>
                      <Button
                        type="submit"
                        disabled={!isScheduleFormValid || isLoadingSchedule}
                        className={cn(
                          "px-6 transition-all",
                          isScheduleFormValid
                            ? "bg-gradient-to-r from-[#0248FF] to-[#5287FF] text-white hover:opacity-90 shadow-md"
                            : "bg-slate-200 text-slate-400 cursor-not-allowed"
                        )}
                      >
                        {isLoadingSchedule ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            처리 중...
                          </>
                        ) : (
                          '자동화 시작'
                        )}
                      </Button>
                    </div>
                  </form>
                </div>
              </>
          )}
        </div>
      </div>
    </div>

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
        // 아카이브 후 후보자 데이터 업데이트 (전체 페이지 리로드 방지)
        refreshCandidateData().catch((error) => {
          console.error('[CandidateDetailClient] 후보자 데이터 업데이트 실패:', error);
        });
        // onClose 콜백이 있으면 호출 (부모 컴포넌트에서 목록 새로고침)
        if (onClose) {
          onClose();
        }
      }}
    />

    {/* Comment Modal */}
    <CommentModal
      candidateId={candidate.id}
      candidateName={candidate.name}
      isOpen={isCommentModalOpen}
      onClose={() => {
        setIsCommentModalOpen(false);
        // 코멘트 추가 후 타임라인만 새로고침 (전체 페이지 리로드 방지)
        refreshTimelineEvents().catch((error) => {
          console.error('[CandidateDetailClient] 타임라인 업데이트 실패:', error);
        });
      }}
    />

    {/* Evaluation Modal */}
    {candidate.current_stage_id && (
      <StageEvaluationModal
        candidateId={candidate.id}
        candidateName={candidate.name}
        stageId={currentStageId}
        stageName={currentStageName}
        existingEvaluation={userId ? evaluations
          .filter(e => e.stage_id === currentStageId)
          .find(e => e.evaluator_id === userId) : undefined}
        isOpen={isEvaluationModalOpen}
        onClose={() => {
          setIsEvaluationModalOpen(false);
          // 평가 데이터와 타임라인만 새로고침 (전체 페이지 리로드 방지)
          loadEvaluations();
          refreshTimelineEvents().catch((error) => {
            console.error('[CandidateDetailClient] 타임라인 업데이트 실패:', error);
          });
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
    </>
  );
}
