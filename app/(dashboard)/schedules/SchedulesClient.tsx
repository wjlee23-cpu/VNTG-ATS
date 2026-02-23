'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
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
  Mail
} from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale/ko';
import { Button } from '@/components/ui/button';
import { checkInterviewerResponses, checkAllPendingSchedules, sendScheduleOptionsToCandidate } from '@/api/actions/schedules';
import { getAllScheduleProgress } from '@/api/queries/schedules';
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

interface SchedulesClientProps {
  initialSchedules: Schedule[];
}

export function SchedulesClient({ initialSchedules }: SchedulesClientProps) {
  const router = useRouter();
  const [schedules, setSchedules] = useState<Schedule[]>(initialSchedules);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [checkingScheduleId, setCheckingScheduleId] = useState<string | null>(null);
  const [isCheckingAll, setIsCheckingAll] = useState(false);

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
          toast.error(`이메일 발송에 실패했습니다: ${result.data.error || '알 수 없는 오류'}. RESEND_API_KEY 환경 변수를 확인해주세요.`);
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

        {/* 통계 카드 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
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
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
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
            {filteredSchedules.map((schedule) => (
              <div
                key={schedule.id}
                className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col lg:flex-row gap-4">
                  {/* 왼쪽: 후보자 정보 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold flex-shrink-0">
                        {schedule.candidates.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
