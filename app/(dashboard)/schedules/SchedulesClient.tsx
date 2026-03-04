'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle, 
  RefreshCw, 
  Loader2,
  Filter,
  Calendar as CalendarIcon,
  User,
  Users,
  Mail,
  Trash2,
  RotateCcw,
  Settings,
  Edit,
  Plus,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale/ko';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { checkInterviewerResponses, checkAllPendingSchedules, sendScheduleOptionsToCandidate, deleteSchedule, cancelSchedule, rescheduleInterview, forceConfirmSchedule, addManualScheduleOption, updateScheduleWithManualOverride } from '@/api/actions/schedules';
import { getAllScheduleProgress } from '@/api/queries/schedules';
import { ManualScheduleEditor } from '@/components/admin/ManualScheduleEditor';
import { AddScheduleOptionModal } from '@/components/admin/AddScheduleOptionModal';
import { ForceConfirmModal } from '@/components/admin/ForceConfirmModal';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { getCandidateById } from '@/api/queries/candidates';
import { getSchedulesByCandidate } from '@/api/queries/schedules';
import { getTimelineEvents } from '@/api/queries/timeline';
import { CandidateDetailClient } from '@/app/(dashboard)/candidates/[id]/CandidateDetailClient';
import { toast } from 'sonner';

interface ScheduleOption {
  id: string;
  scheduled_at: string;
  status: string;
  interviewer_responses?: Record<string, string> | null;
  google_event_id?: string | null;
}

interface Interviewer {
  id: string;
  email: string;
}

interface Candidate {
  id: string;
  name: string;
  email: string;
  job_posts?: {
    id: string;
    title: string;
  } | null;
}

interface Schedule {
  id: string;
  candidate_id: string;
  workflow_status: 'pending_interviewers' | 'pending_candidate' | 'confirmed' | 'cancelled' | null;
  interviewer_ids: string[];
  duration_minutes: number;
  created_at: string;
  candidates: Candidate;
  schedule_options?: ScheduleOption[];
  interviewers?: Interviewer[];
}

interface ManualSchedule {
  id: string;
  candidate_id: string;
  scheduled_at: string;
  duration_minutes: number;
  workflow_status: string | null;
  needs_rescheduling: boolean | null;
  rescheduling_reason: string | null;
  manual_override: boolean | null;
  interviewer_ids: string[];
  candidates: {
    id: string;
    name: string;
    email: string;
    job_posts?: {
      id: string;
      title: string;
    } | null;
  } | null;
}

interface SchedulesClientProps {
  initialSchedules: Schedule[];
  needsRescheduling?: ManualSchedule[];
  manualSchedules?: ManualSchedule[];
  confirmedSchedules?: ManualSchedule[];
}

export function SchedulesClient({ 
  initialSchedules,
  needsRescheduling = [],
  manualSchedules = [],
  confirmedSchedules = [],
}: SchedulesClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [schedules, setSchedules] = useState<Schedule[]>(initialSchedules);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [checkingScheduleId, setCheckingScheduleId] = useState<string | null>(null);
  const [isCheckingAll, setIsCheckingAll] = useState(false);
  const [deletingScheduleId, setDeletingScheduleId] = useState<string | null>(null);
  const [cancellingScheduleId, setCancellingScheduleId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('management');
  
  // 수동 조율 관련 상태
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [addingOptionScheduleId, setAddingOptionScheduleId] = useState<string | null>(null);
  const [forceConfirmScheduleId, setForceConfirmScheduleId] = useState<string | null>(null);
  const [forceConfirmOptionId, setForceConfirmOptionId] = useState<string | undefined>(undefined);
  const [reschedulingScheduleId, setReschedulingScheduleId] = useState<string | null>(null);
  const [isRescheduling, setIsRescheduling] = useState(false);

  // Candidate Detail 관련 상태
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [showCandidateDetail, setShowCandidateDetail] = useState<boolean>(false);
  const [candidateDetail, setCandidateDetail] = useState<any>(null);
  const [candidateSchedules, setCandidateSchedules] = useState<any[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<any[]>([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // 일정 카드 refs (자동 스크롤용)
  const scheduleRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // URL query parameter에서 candidate 값 읽기
  useEffect(() => {
    const candidateId = searchParams.get('candidate');
    const showDetail = searchParams.get('showDetail') === 'true';
    
    setSelectedCandidateId(candidateId);
    setShowCandidateDetail(showDetail);
    
    // candidate가 있고 showDetail이 true일 때만 candidate 데이터 로드
    if (candidateId && showDetail) {
      loadCandidateDetail(candidateId);
    } else if (candidateId) {
      // candidate는 있지만 showDetail이 없으면 스크롤만 수행
      setTimeout(() => {
        const schedule = schedules.find(s => s.candidates.id === candidateId);
        if (schedule && scheduleRefs.current[schedule.id]) {
          scheduleRefs.current[schedule.id]?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        }
      }, 100);
    } else {
      // candidate가 없으면 detail 데이터 초기화
      setCandidateDetail(null);
      setCandidateSchedules([]);
      setTimelineEvents([]);
      setShowCandidateDetail(false);
    }
  }, [searchParams, schedules]);

  // Candidate detail 데이터 로드
  const loadCandidateDetail = async (candidateId: string) => {
    setIsLoadingDetail(true);
    setDetailError(null);
    
    try {
      const [candidateResult, schedulesResult, timelineResult] = await Promise.all([
        getCandidateById(candidateId),
        getSchedulesByCandidate(candidateId),
        getTimelineEvents(candidateId),
      ]);

      if (candidateResult.error || !candidateResult.data) {
        setDetailError(candidateResult.error || '후보자를 찾을 수 없습니다.');
        setCandidateDetail(null);
      } else {
        setCandidateDetail(candidateResult.data);
        setCandidateSchedules(schedulesResult.data || []);
        setTimelineEvents(timelineResult.data || []);
        setDetailError(null);
      }
    } catch (err) {
      setDetailError('후보자 정보를 불러오는 중 오류가 발생했습니다.');
      setCandidateDetail(null);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // 후보자 이름 클릭 핸들러
  const handleCandidateClick = (candidateId: string) => {
    router.push(`/schedules?candidate=${candidateId}&showDetail=true`);
  };

  // Detail 패널 닫기
  const handleCloseDetail = () => {
    const candidateId = searchParams.get('candidate');
    if (candidateId) {
      // candidate query parameter는 유지하되 showDetail만 제거
      router.push(`/schedules?candidate=${candidateId}`);
    } else {
      router.push('/schedules');
    }
  };

  // 필터링된 일정 목록
  const filteredSchedules = useMemo(() => {
    if (filterStatus === 'all') {
      return schedules;
    }
    return schedules.filter(schedule => schedule.workflow_status === filterStatus);
  }, [schedules, filterStatus]);

  // 상태별 통계
  const stats = useMemo(() => {
    return {
      all: schedules.length,
      pending_interviewers: schedules.filter(s => s.workflow_status === 'pending_interviewers').length,
      pending_candidate: schedules.filter(s => s.workflow_status === 'pending_candidate').length,
      confirmed: schedules.filter(s => s.workflow_status === 'confirmed').length,
      cancelled: schedules.filter(s => s.workflow_status === 'cancelled').length,
    };
  }, [schedules]);

  // 상태 아이콘
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

  // 상태 텍스트
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

  // 워크플로우 상태 텍스트
  const getWorkflowStatusText = (status: string | null) => {
    switch (status) {
      case 'pending_interviewers':
        return '면접관 수락 대기';
      case 'pending_candidate':
        return '후보자 선택 대기';
      case 'confirmed':
        return '확정됨';
      case 'cancelled':
        return '취소됨';
      default:
        return '상태 불명';
    }
  };

  // 워크플로우 상태 색상
  const getWorkflowStatusColor = (status: string | null) => {
    switch (status) {
      case 'pending_interviewers':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'pending_candidate':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'confirmed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // 개별 일정 응답 확인
  const handleCheckResponse = async (scheduleId: string) => {
    setCheckingScheduleId(scheduleId);
    try {
      const result = await checkInterviewerResponses(scheduleId);
      
      if (result.error) {
        toast.error(result.error);
      } else if (result.data) {
        if (result.data.allAccepted) {
          if (result.data.emailSent === false) {
            toast.warning(result.data.message || '모든 면접관이 수락한 일정이 있습니다. 하지만 이메일 발송에 실패했습니다. 메일 재전송 버튼을 사용해주세요.');
          } else {
            toast.success(result.data.message || '모든 면접관이 수락한 일정이 있습니다. 후보자에게 전송되었습니다.');
          }
        } else if (result.data.allDeclined) {
          // 모든 일정 옵션이 거절된 경우
          if (result.data.regenerated) {
            // 새로운 일정이 자동으로 생성된 경우
            toast.success(
              result.data.message || 
              '모든 일정 옵션이 거절되어 새로운 일정 옵션이 자동으로 생성되었습니다. 날짜 범위를 확장하여 검색했습니다.',
              { duration: 5000 }
            );
          } else {
            // 새로운 일정 생성 실패한 경우
            toast.error(
              result.data.message || 
              '모든 일정 옵션이 거절되었지만, 새로운 일정을 찾을 수 없습니다. 면접 일정이 취소되었습니다.',
              { duration: 8000 }
            );
          }
        } else {
          toast.info(result.data.message || '아직 모든 면접관이 수락하지 않았습니다.');
        }
        
        // 약간의 지연 후 서버에서 최신 데이터 다시 가져오기 (DB 업데이트 반영 시간 고려)
        setTimeout(async () => {
          try {
            const latestData = await getAllScheduleProgress();
            if (latestData.data) {
              setSchedules(latestData.data);
            }
          } catch (refreshError) {
            console.error('데이터 새로고침 실패:', refreshError);
            // 새로고침 실패 시 전체 페이지 새로고침
            window.location.reload();
          }
        }, 1000);
      }
    } catch (error) {
      console.error('응답 확인 실패:', error);
      toast.error(`응답 확인 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    } finally {
      setCheckingScheduleId(null);
    }
  };

  // 후보자에게 메일 재전송
  const handleResendEmail = async (scheduleId: string) => {
    setCheckingScheduleId(scheduleId);
    try {
      const result = await sendScheduleOptionsToCandidate(scheduleId);
      
      if (result.error) {
        toast.error(result.error);
      } else if (result.data) {
        if (result.data.emailSent === false) {
          // Gmail API 스코프 부족 에러인지 확인
          const errorMessage = result.data.error || '알 수 없는 오류';
          const isScopeError = errorMessage.includes('insufficient authentication scopes') || 
                              errorMessage.includes('insufficient') ||
                              errorMessage.includes('authentication scopes') ||
                              errorMessage.includes('GMAIL_SCOPE_MISSING') ||
                              errorMessage.includes('Gmail API 권한');
          
          if (isScopeError) {
            toast.error(
              `이메일 발송 실패: Gmail API 권한 부족. Google Cloud Console에서 Gmail API 활성화 및 OAuth 동의 화면에 gmail.send 스코프 추가 후, 우측 상단 프로필 메뉴에서 구글 캘린더를 재연동해주세요.`,
              { 
                duration: 12000,
              }
            );
          } else {
            toast.error(`이메일 발송에 실패했습니다: ${errorMessage}. 워크플로우 상태는 업데이트되었습니다.`);
          }
        } else {
          toast.success(`후보자에게 이메일이 재전송되었습니다. (${result.data.optionsCount}개 옵션)`);
        }
        
        // 약간의 지연 후 서버에서 최신 데이터 다시 가져오기
        setTimeout(async () => {
          try {
            const latestData = await getAllScheduleProgress();
            if (latestData.data) {
              setSchedules(latestData.data);
            }
          } catch (refreshError) {
            console.error('데이터 새로고침 실패:', refreshError);
            window.location.reload();
          }
        }, 1000);
      }
    } catch (error) {
      console.error('메일 재전송 실패:', error);
      toast.error(`메일 재전송 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    } finally {
      setCheckingScheduleId(null);
    }
  };

  // 면접 일정 삭제
  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!confirm('정말로 이 면접 일정을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      return;
    }

    setDeletingScheduleId(scheduleId);
    try {
      const result = await deleteSchedule(scheduleId);
      
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('면접 일정이 삭제되었습니다.');
        
        // 서버에서 최신 데이터 다시 가져오기
        setTimeout(async () => {
          try {
            const latestData = await getAllScheduleProgress();
            if (latestData.data) {
              setSchedules(latestData.data);
            }
          } catch (refreshError) {
            console.error('데이터 새로고침 실패:', refreshError);
            window.location.reload();
          }
        }, 1000);
      }
    } catch (error) {
      console.error('면접 일정 삭제 실패:', error);
      toast.error(`면접 일정 삭제 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    } finally {
      setDeletingScheduleId(null);
    }
  };

  // 면접 일정 초기화 (취소)
  const handleCancelSchedule = async (scheduleId: string) => {
    if (!confirm('이 면접 일정을 취소하시겠습니까? 구글 캘린더의 이벤트도 삭제됩니다.')) {
      return;
    }

    setCancellingScheduleId(scheduleId);
    try {
      const result = await cancelSchedule(scheduleId);
      
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('면접 일정이 취소되었습니다.');
        
        // 서버에서 최신 데이터 다시 가져오기
        setTimeout(async () => {
          try {
            const latestData = await getAllScheduleProgress();
            if (latestData.data) {
              setSchedules(latestData.data);
            }
          } catch (refreshError) {
            console.error('데이터 새로고침 실패:', refreshError);
            window.location.reload();
          }
        }, 1000);
      }
    } catch (error) {
      console.error('면접 일정 취소 실패:', error);
      toast.error(`면접 일정 취소 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    } finally {
      setCancellingScheduleId(null);
    }
  };

  // 일괄 응답 확인
  const handleCheckAll = async () => {
    setIsCheckingAll(true);
    try {
      const result = await checkAllPendingSchedules();
      
      if (result.error) {
        toast.error(result.error);
      } else if (result.data) {
        toast.success(
          `총 ${result.data.checked}개 일정 확인 완료. ` +
          `${result.data.allAccepted}개 일정이 후보자에게 전송되었고, ` +
          `${result.data.stillPending}개 일정은 계속 대기 중입니다.`
        );
        if (result.data.errors.length > 0) {
          console.error('일부 일정 확인 중 오류:', result.data.errors);
        }
        
        // 서버에서 최신 데이터 다시 가져오기
        try {
          const latestData = await getAllScheduleProgress();
          if (latestData.data) {
            setSchedules(latestData.data);
          }
        } catch (refreshError) {
          console.error('데이터 새로고침 실패:', refreshError);
          // 새로고침 실패 시 전체 페이지 새로고침
          window.location.reload();
        }
      }
    } catch (error) {
      console.error('일괄 응답 확인 실패:', error);
      toast.error('일괄 응답 확인 중 오류가 발생했습니다.');
    } finally {
      setIsCheckingAll(false);
    }
  };

  return (
    <div className="h-full overflow-auto bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* 헤더 */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">면접 일정 관리</h1>
          <p className="text-sm sm:text-base text-gray-600">모든 면접 일정의 진행상황을 확인하고 관리할 수 있습니다.</p>
        </div>

        {/* 탭 구조 */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="management">
              <CalendarIcon className="w-4 h-4 mr-2" />
              일정 관리
            </TabsTrigger>
            <TabsTrigger value="manual">
              <Settings className="w-4 h-4 mr-2" />
              수동 조율
              {needsRescheduling.length > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {needsRescheduling.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* 일정 관리 탭 */}
          <TabsContent value="management" className="space-y-6">
            {/* 통계 카드 */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="text-2xl font-bold text-gray-900 mb-1">{stats.all}</div>
                <div className="text-xs sm:text-sm text-gray-600">전체</div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="text-2xl font-bold text-yellow-600 mb-1">{stats.pending_interviewers}</div>
                <div className="text-xs sm:text-sm text-gray-600">면접관 대기</div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="text-2xl font-bold text-blue-600 mb-1">{stats.pending_candidate}</div>
                <div className="text-xs sm:text-sm text-gray-600">후보자 대기</div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="text-2xl font-bold text-green-600 mb-1">{stats.confirmed}</div>
                <div className="text-xs sm:text-sm text-gray-600">확정됨</div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="text-2xl font-bold text-gray-600 mb-1">{stats.cancelled}</div>
                <div className="text-xs sm:text-sm text-gray-600">취소됨</div>
              </div>
            </div>

            {/* 필터 및 액션 버튼 */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Filter className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-700">필터:</span>
                  <Button
                    variant={filterStatus === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterStatus('all')}
                  >
                    전체
                  </Button>
                  <Button
                    variant={filterStatus === 'pending_interviewers' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterStatus('pending_interviewers')}
                  >
                    면접관 대기
                  </Button>
                  <Button
                    variant={filterStatus === 'pending_candidate' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterStatus('pending_candidate')}
                  >
                    후보자 대기
                  </Button>
                  <Button
                    variant={filterStatus === 'confirmed' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterStatus('confirmed')}
                  >
                    확정됨
                  </Button>
                </div>
                <Button
                  onClick={handleCheckAll}
                  disabled={isCheckingAll || stats.pending_interviewers === 0}
                  size="sm"
                  className="w-full sm:w-auto"
                >
                  {isCheckingAll ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      확인 중...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      일괄 응답 확인
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* 일정 목록 */}
            {filteredSchedules.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                <CalendarIcon className="mx-auto text-gray-400 mb-4" size={48} />
                <p className="text-gray-600">일정이 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredSchedules.map((schedule) => {
                  const isSelectedCandidate = selectedCandidateId === schedule.candidates.id;
                  return (
              <div
                key={schedule.id}
                ref={(el) => {
                  scheduleRefs.current[schedule.id] = el;
                }}
                className={`bg-white rounded-lg border p-4 sm:p-6 hover:shadow-md transition-shadow ${
                  isSelectedCandidate 
                    ? 'border-blue-500 border-2 shadow-lg ring-2 ring-blue-200' 
                    : 'border-gray-200'
                }`}
              >
                <div className="flex flex-col lg:flex-row gap-4">
                  {/* 왼쪽: 후보자 정보 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold flex-shrink-0">
                        {schedule.candidates.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCandidateClick(schedule.candidates.id);
                          }}
                          className="text-base sm:text-lg font-semibold text-gray-900 truncate cursor-pointer hover:text-blue-600 transition-colors"
                        >
                          {schedule.candidates.name}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <Mail className="w-3 h-3" />
                            <span className="truncate">{schedule.candidates.email}</span>
                          </div>
                          {schedule.candidates.job_posts?.title && (
                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                              {schedule.candidates.job_posts.title}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 워크플로우 상태 */}
                    <div className="mb-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getWorkflowStatusColor(schedule.workflow_status)}`}>
                        {getWorkflowStatusText(schedule.workflow_status)}
                      </span>
                    </div>

                    {/* 일정 옵션별 면접관 응답 */}
                    {schedule.schedule_options && schedule.schedule_options.length > 0 && (
                      <div className="space-y-3 mt-4">
                        <h4 className="text-sm font-semibold text-gray-900">일정 옵션별 면접관 응답</h4>
                        {schedule.schedule_options.map((option) => {
                          const date = new Date(option.scheduled_at);
                          const responses = option.interviewer_responses || {};

                          // 면접관 응답 상태에 따라 옵션 상태 결정
                          const getOptionStatus = () => {
                            if (option.status === 'selected') return '선택됨';
                            if (option.status === 'rejected') return '거절됨';
                            if (option.status === 'accepted') return '후보자 선택 대기';
                            
                            // interviewer_responses를 기반으로 상태 판단
                            if (schedule.interviewer_ids && schedule.interviewer_ids.length > 0) {
                              const allAccepted = schedule.interviewer_ids.every((interviewerId: string) => {
                                return responses[interviewerId] === 'accepted';
                              });
                              const allDeclined = schedule.interviewer_ids.every((interviewerId: string) => {
                                return responses[interviewerId] === 'declined';
                              });
                              const hasDeclined = schedule.interviewer_ids.some((interviewerId: string) => {
                                return responses[interviewerId] === 'declined';
                              });
                              const hasAccepted = schedule.interviewer_ids.some((interviewerId: string) => {
                                return responses[interviewerId] === 'accepted';
                              });

                              if (allAccepted) return '후보자 선택 대기';
                              if (allDeclined) return '거절됨';
                              if (hasDeclined && hasAccepted) return '일부 거절';
                              if (hasAccepted) return '일부 수락';
                            }
                            
                            return '대기 중';
                          };

                          return (
                            <div key={option.id} className="border rounded-lg p-3 bg-gray-50">
                              <div className="mb-2">
                                <p className="text-sm font-medium text-gray-900">
                                  {format(date, 'yyyy년 MM월 dd일 (EEE) HH:mm', { locale: ko })}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                  상태: {getOptionStatus()}
                                </p>
                              </div>
                              <div className="space-y-1.5">
                                {schedule.interviewer_ids.map((interviewerId) => {
                                  const interviewer = schedule.interviewers?.find(inv => inv.id === interviewerId);
                                  const response = responses[interviewerId] || 'needsAction';

                                  return (
                                    <div key={interviewerId} className="flex items-center justify-between text-xs sm:text-sm">
                                      <span className="text-gray-700 truncate">
                                        {interviewer?.email || interviewerId}
                                      </span>
                                      <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
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
                  </div>

                  {/* 오른쪽: 액션 버튼 */}
                  <div className="flex flex-col gap-2 lg:min-w-[140px]">
                    {schedule.workflow_status === 'pending_interviewers' && (
                      <Button
                        onClick={() => handleCheckResponse(schedule.id)}
                        disabled={checkingScheduleId === schedule.id}
                        size="sm"
                        variant="outline"
                        className="w-full"
                      >
                        {checkingScheduleId === schedule.id ? (
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
                    )}
                    {schedule.workflow_status === 'pending_candidate' && (
                      <Button
                        onClick={() => handleResendEmail(schedule.id)}
                        disabled={checkingScheduleId === schedule.id}
                        size="sm"
                        variant="outline"
                        className="w-full"
                      >
                        {checkingScheduleId === schedule.id ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            전송 중...
                          </>
                        ) : (
                          <>
                            <Mail className="w-4 h-4 mr-2" />
                            메일 재전송
                          </>
                        )}
                      </Button>
                    )}
                    
                    {/* 삭제 및 초기화 버튼 */}
                    <div className="flex gap-2 mt-2">
                      <Button
                        onClick={() => handleCancelSchedule(schedule.id)}
                        disabled={cancellingScheduleId === schedule.id || deletingScheduleId === schedule.id || schedule.workflow_status === 'cancelled'}
                        size="sm"
                        variant="outline"
                        className="flex-1 text-yellow-600 border-yellow-300 hover:bg-yellow-50"
                        title="초기화 (취소)"
                      >
                        {cancellingScheduleId === schedule.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RotateCcw className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        onClick={() => handleDeleteSchedule(schedule.id)}
                        disabled={deletingScheduleId === schedule.id || cancellingScheduleId === schedule.id}
                        size="sm"
                        variant="outline"
                        className="flex-1 text-red-600 border-red-300 hover:bg-red-50"
                        title="삭제"
                      >
                        {deletingScheduleId === schedule.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                    
                    <div className="text-xs text-gray-500 mt-2">
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        <span>면접관 {schedule.interviewer_ids.length}명</span>
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3" />
                        <span>{schedule.duration_minutes}분</span>
                      </div>
                      <div className="mt-1">
                        생성: {format(new Date(schedule.created_at), 'yyyy.MM.dd HH:mm', { locale: ko })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
                })}
              </div>
            )}
          </TabsContent>

          {/* 수동 조율 탭 */}
          <TabsContent value="manual" className="space-y-6">
            {/* 수동 조율 통계 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600">재조율 필요</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{needsRescheduling.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600">수동 조율 이력</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">{manualSchedules.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600">확정 일정</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{confirmedSchedules.length}</div>
                </CardContent>
              </Card>
            </div>

            {/* 재조율 필요 일정 */}
            {needsRescheduling.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  재조율 필요 ({needsRescheduling.length})
                </h2>
                <div className="space-y-4">
                  {needsRescheduling.map((schedule) => renderManualScheduleCard(schedule, true))}
                </div>
              </div>
            )}

            {/* 수동 조율 이력 */}
            {manualSchedules.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-blue-500" />
                  수동 조율 이력 ({manualSchedules.length})
                </h2>
                <div className="space-y-4">
                  {manualSchedules.map((schedule) => renderManualScheduleCard(schedule, true))}
                </div>
              </div>
            )}

            {/* 확정 일정 (수정 가능) */}
            {confirmedSchedules.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  확정 일정 ({confirmedSchedules.length})
                </h2>
                <div className="space-y-4">
                  {confirmedSchedules.map((schedule) => renderManualScheduleCard(schedule, true))}
                </div>
              </div>
            )}

            {/* 일정이 없는 경우 */}
            {needsRescheduling.length === 0 && manualSchedules.length === 0 && confirmedSchedules.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <Settings className="mx-auto text-gray-400 mb-4" size={48} />
                  <p className="text-gray-600">수동 조율이 필요한 일정이 없습니다.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* 모달들 */}
        {(() => {
          const allSchedules = [...needsRescheduling, ...manualSchedules, ...confirmedSchedules];
          const editingSchedule = allSchedules.find(s => s.id === editingScheduleId);
          const addingOptionSchedule = allSchedules.find(s => s.id === addingOptionScheduleId);
          const forceConfirmSchedule = allSchedules.find(s => s.id === forceConfirmScheduleId);

          return (
            <>
              {editingSchedule && (
                <ManualScheduleEditor
                  scheduleId={editingSchedule.id}
                  currentScheduledAt={editingSchedule.scheduled_at}
                  currentDurationMinutes={editingSchedule.duration_minutes}
                  currentInterviewerIds={editingSchedule.interviewer_ids}
                  isOpen={editingScheduleId !== null}
                  onClose={() => {
                    setEditingScheduleId(null);
                    router.refresh();
                  }}
                />
              )}

              {addingOptionSchedule && (
                <AddScheduleOptionModal
                  scheduleId={addingOptionSchedule.id}
                  currentDurationMinutes={addingOptionSchedule.duration_minutes}
                  isOpen={addingOptionScheduleId !== null}
                  onClose={() => {
                    setAddingOptionScheduleId(null);
                    router.refresh();
                  }}
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
                    router.refresh();
                  }}
                />
              )}
            </>
          );
        })()}
      </div>

      {/* 오른쪽 사이드 패널: Candidate Detail */}
      <Sheet open={showCandidateDetail && !!selectedCandidateId} onOpenChange={(open) => {
        if (!open) {
          handleCloseDetail();
        }
      }}>
        <SheetContent 
          side="right"
          className="!w-full md:!w-[1000px] lg:!w-[1200px] !h-full p-0 overflow-y-auto !max-w-none sm:!max-w-none md:!max-w-none lg:!max-w-none [&>button]:hidden"
        >
          {/* 접근성을 위한 숨겨진 제목 */}
          <SheetTitle className="sr-only">
            {candidateDetail ? `${candidateDetail.name} 상세 정보` : '후보자 상세 정보'}
          </SheetTitle>
          <div className="h-full">
            {isLoadingDetail ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground">로딩 중...</p>
                </div>
              </div>
            ) : detailError ? (
              <div className="flex items-center justify-center h-full p-8">
                <div className="text-center">
                  <p className="text-destructive mb-4">{detailError}</p>
                  <button
                    onClick={handleCloseDetail}
                    className="px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors"
                  >
                    닫기
                  </button>
                </div>
              </div>
            ) : candidateDetail ? (
              <CandidateDetailClient
                candidate={candidateDetail}
                schedules={candidateSchedules}
                timelineEvents={timelineEvents}
                onClose={handleCloseDetail}
                isSidebar={true}
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );

  // 수동 조율 일정 카드 렌더링 함수
  function renderManualScheduleCard(schedule: ManualSchedule, showActions: boolean = true) {
    const candidate = schedule.candidates;
    if (!candidate) return null;

    const scheduledDate = new Date(schedule.scheduled_at);
    const endTime = new Date(scheduledDate);
    endTime.setMinutes(endTime.getMinutes() + schedule.duration_minutes);

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

    return (
      <Card key={schedule.id} className="hover:shadow-md transition-shadow">
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
              <CalendarIcon className="w-4 h-4 text-gray-500" />
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
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
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
              {(schedule.workflow_status === 'pending_interviewers' || schedule.workflow_status === 'pending_candidate') && (
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
              )}
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
  }

  // 재조율 핸들러
  async function handleReschedule(scheduleId: string) {
    setIsRescheduling(true);
    setReschedulingScheduleId(scheduleId);
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
  }
}
