'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  CalendarDays,
  RefreshCw,
  Loader2,
  Settings,
  Plus,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  Clock,
  User,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { checkInterviewerResponses, checkAllPendingSchedules, sendScheduleOptionsToCandidate, deleteSchedule, cancelSchedule, rescheduleInterview, forceConfirmSchedule } from '@/api/actions/schedules';
import { getAllScheduleProgress } from '@/api/queries/schedules';
import { ManualScheduleEditor } from '@/components/admin/ManualScheduleEditor';
import { AddScheduleOptionModal } from '@/components/admin/AddScheduleOptionModal';
import { ForceConfirmModal } from '@/components/admin/ForceConfirmModal';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { getCandidateById } from '@/api/queries/candidates';
import { getSchedulesByCandidate } from '@/api/queries/schedules';
import { getTimelineEvents } from '@/api/queries/timeline';
import { CandidateDetailClient } from '@/app/(dashboard)/candidates/[id]/CandidateDetailClient';
import { toast } from 'sonner';
import { ScheduleTimelineView } from '@/components/schedules/ScheduleTimelineView';
import { ScheduleFilters } from '@/components/schedules/ScheduleFilters';
import { ScheduleCard } from '@/components/schedules/ScheduleCard';
import { cn } from '@/components/ui/utils';

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
  workflow_status: 'pending_interviewers' | 'pending_candidate' | 'confirmed' | 'cancelled' | 'needs_rescheduling' | null;
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
  const [searchQuery, setSearchQuery] = useState<string>('');
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

  // URL query parameter에서 candidate 값 읽기
  useEffect(() => {
    const candidateId = searchParams.get('candidate');
    const showDetail = searchParams.get('showDetail') === 'true';

    setSelectedCandidateId(candidateId);
    setShowCandidateDetail(showDetail);

    if (candidateId && showDetail) {
      loadCandidateDetail(candidateId);
    } else {
      setCandidateDetail(null);
      setCandidateSchedules([]);
      setTimelineEvents([]);
      setShowCandidateDetail(false);
    }
  }, [searchParams]);

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
      router.push(`/schedules?candidate=${candidateId}`);
    } else {
      router.push('/schedules');
    }
  };

  // 필터링 및 검색된 일정 목록
  const filteredSchedules = useMemo(() => {
    let filtered = schedules;

    // 상태 필터
    if (filterStatus !== 'all') {
      filtered = filtered.filter((schedule) => schedule.workflow_status === filterStatus);
    }

    // 검색 쿼리
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (schedule) =>
          schedule.candidates.name.toLowerCase().includes(query) ||
          schedule.candidates.email.toLowerCase().includes(query) ||
          schedule.candidates.job_posts?.title?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [schedules, filterStatus, searchQuery]);

  // 상태별 통계
  const stats = useMemo(() => {
    return {
      all: schedules.length,
      pending_interviewers: schedules.filter((s) => s.workflow_status === 'pending_interviewers').length,
      pending_candidate: schedules.filter((s) => s.workflow_status === 'pending_candidate').length,
      confirmed: schedules.filter((s) => s.workflow_status === 'confirmed').length,
      cancelled: schedules.filter((s) => s.workflow_status === 'cancelled').length,
      needs_rescheduling: schedules.filter((s) => s.workflow_status === 'needs_rescheduling').length,
    };
  }, [schedules]);

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
            toast.warning(
              result.data.message ||
                '모든 면접관이 수락한 일정이 있습니다. 하지만 이메일 발송에 실패했습니다. 메일 재전송 버튼을 사용해주세요.'
            );
          } else {
            toast.success(
              result.data.message || '모든 면접관이 수락한 일정이 있습니다. 후보자에게 전송되었습니다.'
            );
          }
        } else if (result.data.allDeclined) {
          if (result.data.regenerated) {
            toast.success(
              result.data.message ||
                '모든 일정 옵션이 거절되어 새로운 일정 옵션이 자동으로 생성되었습니다. 날짜 범위를 확장하여 검색했습니다.',
              { duration: 5000 }
            );
          } else {
            toast.error(
              result.data.message ||
                '모든 일정 옵션이 거절되었지만, 새로운 일정을 찾을 수 없습니다. 면접 일정이 취소되었습니다.',
              { duration: 8000 }
            );
          }
        } else {
          toast.info(result.data.message || '아직 모든 면접관이 수락하지 않았습니다.');
        }

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
          const errorMessage = result.data.error || '알 수 없는 오류';
          const isScopeError =
            errorMessage.includes('insufficient authentication scopes') ||
            errorMessage.includes('insufficient') ||
            errorMessage.includes('authentication scopes') ||
            errorMessage.includes('GMAIL_SCOPE_MISSING') ||
            errorMessage.includes('Gmail API 권한');

          if (isScopeError) {
            toast.error(
              `이메일 발송 실패: Gmail API 권한 부족. Google Cloud Console에서 Gmail API 활성화 및 OAuth 동의 화면에 gmail.send 스코프 추가 후, 우측 상단 프로필 메뉴에서 구글 캘린더를 재연동해주세요.`,
              { duration: 12000 }
            );
          } else {
            toast.error(`이메일 발송에 실패했습니다: ${errorMessage}. 워크플로우 상태는 업데이트되었습니다.`);
          }
        } else {
          toast.success(`후보자에게 이메일이 재전송되었습니다. (${result.data.optionsCount}개 옵션)`);
        }

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

        try {
          const latestData = await getAllScheduleProgress();
          if (latestData.data) {
            setSchedules(latestData.data);
          }
        } catch (refreshError) {
          console.error('데이터 새로고침 실패:', refreshError);
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

  // 재조율 핸들러
  const handleReschedule = async (scheduleId: string) => {
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
  };

  // 수동 조율 일정을 Schedule 형태로 변환
  const convertManualScheduleToSchedule = (manual: ManualSchedule): Schedule | null => {
    if (!manual.candidates) return null;

    return {
      id: manual.id,
      candidate_id: manual.candidate_id,
      workflow_status: (manual.workflow_status as any) || null,
      interviewer_ids: manual.interviewer_ids,
      duration_minutes: manual.duration_minutes,
      created_at: manual.scheduled_at,
      candidates: {
        id: manual.candidates.id,
        name: manual.candidates.name,
        email: manual.candidates.email,
        job_posts: manual.candidates.job_posts || null,
      },
      schedule_options: [
        {
          id: manual.id,
          scheduled_at: manual.scheduled_at,
          status: manual.workflow_status || 'pending',
          interviewer_responses: null,
          google_event_id: null,
        },
      ],
      interviewers: [],
    };
  };

  return (
    <div className="h-full overflow-auto bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* 헤더 */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-main to-brand-dark flex items-center justify-center shadow-lg shadow-blue-500/20">
              <CalendarDays className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">면접 일정 관리</h1>
          </div>
          <p className="text-sm sm:text-base text-slate-600 ml-13 sm:ml-14">
            모든 면접 일정의 진행상황을 확인하고 관리할 수 있습니다.
          </p>
        </div>

        {/* 탭 구조 */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="flex justify-between items-center gap-4 flex-wrap">
            {/* 탭 메뉴 */}
            <div className="bg-slate-200/50 p-1 rounded-xl inline-flex gap-1">
              <button
                onClick={() => setActiveTab('management')}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex items-center gap-2',
                  activeTab === 'management'
                    ? 'bg-white shadow-sm text-foreground'
                    : 'text-slate-600 hover:bg-slate-50/50'
                )}
              >
                <CalendarDays className="w-4 h-4" />
                일정 관리
              </button>
              <button
                onClick={() => setActiveTab('manual')}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex items-center gap-2 relative',
                  activeTab === 'manual'
                    ? 'bg-white shadow-sm text-foreground'
                    : 'text-slate-600 hover:bg-slate-50/50'
                )}
              >
                <Settings className="w-4 h-4" />
                수동 조율
                {needsRescheduling.length > 0 && (
                  <span
                    className={cn(
                      'ml-1 px-1.5 py-0.5 rounded-full text-xs font-medium',
                      activeTab === 'manual' ? 'bg-rose-100 text-rose-700' : 'bg-rose-200 text-rose-600'
                    )}
                  >
                    {needsRescheduling.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* 일정 관리 탭 */}
          <TabsContent value="management" className="space-y-6">
            {/* 통계 카드 */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <Card className="card-modern p-4 sm:p-5 border-0 shadow-lg">
                <div className="flex items-start justify-between mb-2">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center flex-shrink-0">
                    <CalendarDays className="w-5 h-5 text-slate-600" />
                  </div>
                  <TrendingUp className="w-4 h-4 text-slate-400" />
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-1">{stats.all}</div>
                <div className="text-xs sm:text-sm text-slate-600">전체</div>
              </Card>

              <Card className="card-modern p-4 sm:p-5 border-0 shadow-lg">
                <div className="flex items-start justify-between mb-2">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-50 to-amber-100 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5 text-amber-600" />
                  </div>
                  <TrendingUp className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-3xl font-bold text-amber-600 mb-1">{stats.pending_interviewers}</div>
                <div className="text-xs sm:text-sm text-slate-600">면접관 대기</div>
              </Card>

              <Card className="card-modern p-4 sm:p-5 border-0 shadow-lg">
                <div className="flex items-start justify-between mb-2">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-blue-600" />
                  </div>
                  <TrendingUp className="w-4 h-4 text-blue-400" />
                </div>
                <div className="text-3xl font-bold text-blue-600 mb-1">{stats.pending_candidate}</div>
                <div className="text-xs sm:text-sm text-slate-600">후보자 대기</div>
              </Card>

              <Card className="card-modern p-4 sm:p-5 border-0 shadow-lg">
                <div className="flex items-start justify-between mb-2">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-50 to-emerald-100 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  </div>
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-3xl font-bold text-emerald-600 mb-1">{stats.confirmed}</div>
                <div className="text-xs sm:text-sm text-slate-600">확정됨</div>
              </Card>

              <Card className="card-modern p-4 sm:p-5 border-0 shadow-lg">
                <div className="flex items-start justify-between mb-2">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-rose-50 to-rose-100 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-5 h-5 text-rose-600" />
                  </div>
                  <TrendingUp className="w-4 h-4 text-rose-400" />
                </div>
                <div className="text-3xl font-bold text-rose-600 mb-1">{stats.needs_rescheduling}</div>
                <div className="text-xs sm:text-sm text-slate-600">재조율 필요</div>
              </Card>
            </div>

            {/* 필터 및 액션 */}
            <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
              <div className="flex-1">
                <ScheduleFilters
                  statusFilter={filterStatus}
                  onStatusFilterChange={setFilterStatus}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                />
              </div>
              <Button
                onClick={handleCheckAll}
                disabled={isCheckingAll || stats.pending_interviewers === 0}
                size="sm"
                className="gradient-blue text-white hover:opacity-90 shadow-lg shadow-blue-500/20 whitespace-nowrap"
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

            {/* 타임라인 뷰 */}
            <ScheduleTimelineView
              schedules={filteredSchedules}
              onCheckResponse={handleCheckResponse}
              onResendEmail={handleResendEmail}
              onDelete={handleDeleteSchedule}
              onCancel={handleCancelSchedule}
              onCandidateClick={handleCandidateClick}
              checkingScheduleId={checkingScheduleId}
              deletingScheduleId={deletingScheduleId}
              cancellingScheduleId={cancellingScheduleId}
              selectedCandidateId={selectedCandidateId}
            />
          </TabsContent>

          {/* 수동 조율 탭 */}
          <TabsContent value="manual" className="space-y-6">
            {/* 수동 조율 통계 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="card-modern p-4 sm:p-5 border-0 shadow-lg">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-rose-50 to-rose-100 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-5 h-5 text-rose-600" />
                  </div>
                  <TrendingUp className="w-4 h-4 text-rose-400" />
                </div>
                <div className="text-3xl font-bold text-rose-600 mb-1">{needsRescheduling.length}</div>
                <div className="text-xs sm:text-sm text-slate-600">재조율 필요</div>
              </Card>

              <Card className="card-modern p-4 sm:p-5 border-0 shadow-lg">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center flex-shrink-0">
                    <Settings className="w-5 h-5 text-slate-600" />
                  </div>
                  <TrendingUp className="w-4 h-4 text-slate-400" />
                </div>
                <div className="text-3xl font-bold text-slate-600 mb-1">{manualSchedules.length}</div>
                <div className="text-xs sm:text-sm text-slate-600">수동 조율 이력</div>
              </Card>

              <Card className="card-modern p-4 sm:p-5 border-0 shadow-lg">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-50 to-emerald-100 flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                  </div>
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-3xl font-bold text-emerald-600 mb-1">{confirmedSchedules.length}</div>
                <div className="text-xs sm:text-sm text-slate-600">확정 일정</div>
              </Card>
            </div>

            {/* 재조율 필요 일정 */}
            {needsRescheduling.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-rose-500" />
                  재조율 필요 ({needsRescheduling.length})
                </h2>
                <div className="space-y-4">
                  {needsRescheduling.map((schedule) => {
                    const converted = convertManualScheduleToSchedule(schedule);
                    if (!converted) return null;
                    return (
                      <ScheduleCard
                        key={schedule.id}
                        schedule={converted}
                        onEdit={() => setEditingScheduleId(schedule.id)}
                        onDelete={handleDeleteSchedule}
                        onCancel={handleCancelSchedule}
                        onCandidateClick={handleCandidateClick}
                        isDeleting={deletingScheduleId === schedule.id}
                        isCancelling={cancellingScheduleId === schedule.id}
                      />
                    );
                  })}
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
                  {manualSchedules.map((schedule) => {
                    const converted = convertManualScheduleToSchedule(schedule);
                    if (!converted) return null;
                    return (
                      <ScheduleCard
                        key={schedule.id}
                        schedule={converted}
                        onEdit={() => setEditingScheduleId(schedule.id)}
                        onDelete={handleDeleteSchedule}
                        onCancel={handleCancelSchedule}
                        onCandidateClick={handleCandidateClick}
                        isDeleting={deletingScheduleId === schedule.id}
                        isCancelling={cancellingScheduleId === schedule.id}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* 확정 일정 */}
            {confirmedSchedules.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-500" />
                  확정 일정 ({confirmedSchedules.length})
                </h2>
                <div className="space-y-4">
                  {confirmedSchedules.map((schedule) => {
                    const converted = convertManualScheduleToSchedule(schedule);
                    if (!converted) return null;
                    return (
                      <ScheduleCard
                        key={schedule.id}
                        schedule={converted}
                        onEdit={() => setEditingScheduleId(schedule.id)}
                        onDelete={handleDeleteSchedule}
                        onCancel={handleCancelSchedule}
                        onCandidateClick={handleCandidateClick}
                        isDeleting={deletingScheduleId === schedule.id}
                        isCancelling={cancellingScheduleId === schedule.id}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* 일정이 없는 경우 */}
            {needsRescheduling.length === 0 && manualSchedules.length === 0 && confirmedSchedules.length === 0 && (
              <Card className="card-modern p-16 sm:p-20 text-center border-0 shadow-lg">
                <CalendarDays className="mx-auto text-slate-300 mb-6" size={64} />
                <p className="text-slate-500 text-base sm:text-lg mb-6">수동 조율이 필요한 일정이 없습니다</p>
                <Button
                  className="gradient-blue text-white hover:opacity-90 shadow-lg shadow-blue-500/20"
                  onClick={() => router.push('/candidates')}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  새 일정 조율하기
                </Button>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* 모달들 */}
        {(() => {
          const allSchedules = [...needsRescheduling, ...manualSchedules, ...confirmedSchedules];
          const editingSchedule = allSchedules.find((s) => s.id === editingScheduleId);
          const addingOptionSchedule = allSchedules.find((s) => s.id === addingOptionScheduleId);
          const forceConfirmSchedule = allSchedules.find((s) => s.id === forceConfirmScheduleId);

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

      {/* 중앙 집중형 모달: Candidate Detail */}
      <Dialog
        open={showCandidateDetail && !!selectedCandidateId}
        onOpenChange={(open) => {
          if (!open) {
            handleCloseDetail();
          }
        }}
      >
        <DialogContent
          className="!w-[95vw] !max-w-5xl !max-h-[90vh] p-0 overflow-hidden rounded-3xl shadow-2xl bg-slate-50/80 backdrop-blur-2xl [&>button]:hidden"
        >
          <DialogTitle className="sr-only">
            {candidateDetail ? `${candidateDetail.name} 상세 정보` : '후보자 상세 정보'}
          </DialogTitle>
          <div className="h-full overflow-hidden">
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
                isSidebar={false}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
