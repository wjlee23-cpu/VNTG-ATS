'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  X, Mail, Phone, MapPin, Star, FileText, Download, Calendar, 
  Send, Sparkles, Star as StarIcon, ArrowRight, FileIcon, 
  MessageSquare, ArrowRightCircle, Archive, Eye, EyeOff, Plus, Folder,
  CheckCircle2, Settings, ChevronDown, ArrowUp, ArrowDown, RefreshCw,
  ArrowUpRight, ArrowDownLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScheduleInterviewAutomatedModal } from '@/components/candidates/ScheduleInterviewAutomatedModal';
import { EmailModal } from '@/components/candidates/EmailModal';
import { ArchiveCandidateModal } from '@/components/candidates/ArchiveCandidateModal';
import { StageEvaluationModal } from '@/components/candidates/StageEvaluationModal';
import { DocumentPreviewModal } from '@/components/candidates/DocumentPreviewModal';
import { getStageEvaluations } from '@/api/queries/evaluations';
import { getResumeFilesByCandidate } from '@/api/queries/resume-files';
import { STAGE_ID_TO_NAME_MAP } from '@/constants/stages';
import { getUserProfile } from '@/api/queries/auth';
import { skipStage, moveToStage, getAvailableStagesAction } from '@/api/actions/evaluations';
import { syncCandidateEmails } from '@/api/actions/emails';
import { toast } from 'sonner';

interface Candidate {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: 'pending' | 'in_progress' | 'confirmed' | 'rejected' | 'issue';
  current_stage_id: string | null;
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

  // 평가 데이터 및 파일 로드
  useEffect(() => {
    if (candidate.id) {
      loadEvaluations();
      loadUserRole();
      loadResumeFiles();
    }
  }, [candidate.id]);

  // 파일이 로드되면 첫 번째 파일을 기본 선택으로 설정
  useEffect(() => {
    if (resumeFiles.length > 0 && !selectedDocument) {
      setSelectedDocument(resumeFiles[0]);
    }
  }, [resumeFiles]);

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
                className="border-border bg-card hover:bg-accent transition-all duration-200"
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

  // Schedule Interview 버튼 표시 조건 (1차 면접 또는 2차 면접 단계에서만)
  const canScheduleInterview = currentStageId === 'stage-6' || currentStageId === 'stage-8';

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
        router.refresh();
      }
    } catch (error) {
      toast.error('전형 이동 중 오류가 발생했습니다.');
      console.error('Move to stage error:', error);
    } finally {
      setIsMovingStage(false);
    }
  };

  // 문서 열기 핸들러 (모달용)
  const handleDocumentClick = (file: ResumeFile) => {
    setSelectedDocument(file);
    setIsDocumentPreviewOpen(true);
  };

  // 문서 선택 핸들러 (인라인 미리보기용)
  const handleDocumentSelect = (file: ResumeFile) => {
    setSelectedDocument(file);
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
      return (
        <div className="w-full h-[calc(100vh-400px)] min-h-[700px] border border-border rounded-lg overflow-hidden bg-muted/30">
          <iframe
            src={`${file.file_url}#toolbar=0&navpanes=0&scrollbar=0`}
            className="w-full h-full min-h-[700px]"
            title="PDF Preview"
          />
        </div>
      );
    }

    // DOC, DOCX 파일은 다운로드만 제공
    const fileName = getFileName(file.file_url);
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
        // 타임라인 새로고침
        router.refresh();
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

  return (
    <>
    <div className={`h-full overflow-auto ${isSidebar ? 'bg-background' : 'bg-gradient-to-b from-gray-50 to-background'}`}>
      <div className={`${isSidebar ? 'px-4 sm:px-6 py-4 sm:py-6' : 'w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8'}`}>
        {/* 헤더 섹션 - 그라데이션 배경 */}
        <div className="relative mb-8 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 pt-6 pb-8 bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 rounded-b-2xl shadow-lg">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {/* 프로필 정보 - 모바일 반응형 */}
              <div className="flex items-center gap-3 sm:gap-4 mb-4">
                <Avatar className="w-16 h-16 sm:w-20 sm:h-20 border-4 border-white/20 shadow-xl flex-shrink-0">
                  <AvatarFallback className="bg-gradient-to-br from-white/20 to-white/10 text-white text-xl sm:text-2xl font-bold">
                    {candidate.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2 drop-shadow-sm break-words">{candidate.name}</h1>
                  {candidate.job_posts?.title && (
                    <p className="text-sm sm:text-base text-slate-200 mb-2 break-words">{candidate.job_posts.title}</p>
                  )}
                  {/* 현재 전형 단계 배지 */}
                  {currentStageId && (
                    <Badge 
                      variant="secondary" 
                      className="bg-white/25 text-white border-white/40 hover:bg-white/35 backdrop-blur-sm text-xs sm:text-sm font-medium px-3 py-1 shadow-sm"
                    >
                      {currentStageName}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="flex-shrink-0 p-2 sm:p-2.5 hover:bg-white/20 rounded-full transition-all duration-200 text-white hover:scale-110 min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="닫기"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action Buttons - 개선된 스타일, 모바일 반응형 */}
        {canManageCandidate && (
          <div className="flex items-center gap-3 mb-8 flex-wrap">
            {/* Schedule Interview 버튼: 관리자/리크루터만, 1차/2차 면접 단계에서만 표시 */}
            {canScheduleInterview && (
              <Button
                onClick={() => setIsScheduleModalOpen(true)}
                className="bg-primary hover:bg-primary/90 text-white shadow-sm hover:shadow-md transition-all duration-200"
                size="default"
              >
                <Calendar className="w-4 h-4 mr-2" />
                Schedule Interview
              </Button>
            )}
            {/* Email 버튼 */}
            <Button
              onClick={() => setIsEmailModalOpen(true)}
              variant="outline"
              className="border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50 shadow-sm hover:shadow-md transition-all duration-200"
              size="default"
            >
              <Mail className="w-4 h-4 mr-2" />
              Email
            </Button>
            {/* 전형 이동 버튼 */}
            <Popover open={isStagePopoverOpen} onOpenChange={handlePopoverOpenChange}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50 shadow-sm hover:shadow-md transition-all duration-200"
                  size="default"
                  disabled={isMovingStage || !currentStageId || !candidate.job_posts?.id}
                >
                  <ArrowRight className="w-4 h-4 mr-2" />
                  {isMovingStage ? '이동 중...' : '전형 이동'}
                  <ChevronDown className="w-4 h-4 ml-2" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0 shadow-xl" align="start">
                <div className="p-2">
                  <div className="px-3 py-2 text-sm font-semibold text-foreground border-b">
                    전형 단계 선택
                  </div>
                  {isLoadingStages ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      로딩 중...
                    </div>
                  ) : !currentStageId ? (
                    <div className="p-4 text-center text-sm text-destructive">
                      현재 전형 정보가 없습니다.
                    </div>
                  ) : availableStages.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      사용 가능한 단계가 없습니다.
                    </div>
                  ) : (
                    <div className="max-h-64 overflow-y-auto">
                      {availableStages.map((stage) => {
                        const isCurrent = stage.isCurrent;
                        const currentIndex = availableStages.findIndex(s => s.isCurrent);
                        const stageIndex = availableStages.findIndex(s => s.id === stage.id);
                        const isForward = stageIndex > currentIndex;
                        const isBackward = stageIndex < currentIndex;

                        return (
                          <button
                            key={stage.id}
                            onClick={() => !isCurrent && handleMoveToStage(stage.id)}
                            disabled={isCurrent}
                            className={`
                              w-full px-3 py-2.5 text-left text-sm transition-all duration-200
                              flex items-center justify-between
                              ${isCurrent
                                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                                : 'hover:bg-primary/5 text-foreground cursor-pointer'
                              }
                              ${!isCurrent && 'border-b border-border last:border-b-0'}
                            `}
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              {isBackward && (
                                <ArrowUp className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                              )}
                              {isForward && (
                                <ArrowDown className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                              )}
                              {!isBackward && !isForward && (
                                <div className="w-3.5 h-3.5 flex-shrink-0" />
                              )}
                              <span className={isCurrent ? 'font-medium' : ''}>
                                {stage.name}
                              </span>
                            </div>
                            {isCurrent && (
                              <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                                (현재)
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
            {/* 아카이브 버튼 */}
            <Button
              onClick={() => setIsArchiveModalOpen(true)}
              variant="outline"
              className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive/50 shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              size="default"
            >
              <Archive className="w-4 h-4 mr-2" />
              아카이브
            </Button>
          </div>
        )}

        {/* Match Score - 그라데이션 카드 */}
        {candidate.parsed_data?.match_score !== undefined && (
          <Card className="mb-6 bg-card border-border shadow-md hover:shadow-lg transition-shadow duration-200">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  Match Score
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-bold text-primary">{candidate.parsed_data.match_score}</span>
                <span className="text-xl text-muted-foreground">/ 100</span>
              </div>
              <Progress 
                value={candidate.parsed_data.match_score} 
                className="h-3 bg-muted"
              />
              {/* AI SUMMARY 박스 */}
              {candidate.ai_summary && (
                <div className="mt-4 p-4 bg-muted/30 rounded-lg border border-border shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">AI SUMMARY</h3>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed">{candidate.ai_summary}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Contact */}
        <Card className="mb-6 shadow-md hover:shadow-lg transition-shadow duration-200">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors duration-200">
              <Mail className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              <span className="text-sm text-foreground break-all">{candidate.email}</span>
            </div>
            {candidate.phone && (
              <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors duration-200">
                <Phone className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-foreground break-all">{candidate.phone}</span>
              </div>
            )}
            {location && (
              <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors duration-200">
                <MapPin className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-foreground">{location}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Compensation - 권한이 있는 경우만 표시 */}
        {canViewCompensation && (
          <Card className="mb-6 shadow-md hover:shadow-lg transition-shadow duration-200">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold">Compensation</CardTitle>
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
            </CardHeader>
            <CardContent>
              {!showCompensation ? (
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-dashed">
                  <p className="text-sm text-muted-foreground">Click to view sensitive data</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCompensation(true)}
                    className="transition-all duration-200"
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
            </CardContent>
          </Card>
        )}

        {/* Skills */}
        {skills.length > 0 && (
          <Card className="mb-6 shadow-md hover:shadow-lg transition-shadow duration-200">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Skills</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {skills.map((skill, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="px-3 py-1.5 text-sm font-medium hover:bg-primary/10 transition-colors duration-200"
                  >
                    {skill}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Documents - 여러 파일 지원 + 인라인 미리보기 */}
        <Card className="mb-6 shadow-md hover:shadow-lg transition-shadow duration-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold">Documents</CardTitle>
              {resumeFiles.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  {resumeFiles.length} files
                </Badge>
              )}
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
                      const fileName = getFileName(file.file_url);
                      const fileSize = file.parsed_data?.file_size;
                      const isSelected = selectedDocument?.id === file.id;
                      return (
                        <div
                          key={file.id}
                          onClick={() => handleDocumentSelect(file)}
                          className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-all duration-200 group whitespace-nowrap ${
                            isSelected
                              ? 'border-primary bg-primary/5 shadow-md'
                              : 'border-border hover:bg-accent/50 hover:shadow-md'
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
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDocumentClick(file);
                            }}
                            className="flex-shrink-0 p-1 hover:bg-accent rounded transition-colors duration-200"
                            title="새 창에서 열기"
                          >
                            <Download className={`w-4 h-4 transition-colors duration-200 ${
                              isSelected ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'
                            }`} />
                          </button>
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
        <Card className="shadow-md hover:shadow-lg transition-shadow duration-200">
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
          </CardHeader>
          <CardContent>
            {timelineEvents.length === 0 ? (
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
                  {timelineEvents.map((event, index) => (
                    <div key={event.id} className="relative flex gap-4 group">
                      {/* 아이콘 - 개선된 스타일 */}
                      <div className="relative z-10 flex-shrink-0">
                        <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center shadow-sm group-hover:shadow-md group-hover:scale-105 transition-all duration-200 ${getTimelineEventIconBg(event.type)}`}>
                          {getTimelineEventIcon(event.type)}
                        </div>
                      </div>
                      
                      {/* 내용 - 카드 스타일 */}
                      <div className="flex-1 pb-6 min-w-0">
                        <div className={`border rounded-lg p-4 shadow-sm hover:shadow-md transition-all duration-200 ${getTimelineEventCardBg(event.type)}`}>
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className={`text-sm font-semibold ${getTimelineEventColor(event.type)}`}>
                              {getTimelineEventTitle(event)}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {formatRelativeTime(event.created_at)}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mb-3">
                            {event.created_by_user?.name || event.created_by_user?.email || 'System'} • {formatDate(event.created_at)} {new Date(event.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
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
        stageId={currentStageId}
        stageName={currentStageName}
        existingEvaluation={userId ? evaluations
          .filter(e => e.stage_id === currentStageId)
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
    </>
  );
}
