'use client';

import { Users, Clock, Send, CheckCircle2, AlertCircle, FileText, Briefcase, Calendar, ArrowRight, ChevronRight, TrendingUp, UserPlus, CalendarCheck, Award, Sparkles, TrendingDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { getUserProfile } from '@/api/queries/auth';
import { getDashboardInsight } from '@/api/actions/dashboard';
import { seedDummyData } from '@/api/actions/seed';
import { toast } from 'sonner';

interface OverviewClientProps {
  stats: {
    newApplications: number;
    interviewsInProgress: number;
    offersSent: number;
    hiringCompleted: number;
  };
  recentActivity: Array<{
    id: string;
    type: string;
    candidate: string;
    action: string;
    job: string;
    time: string;
  }>;
  topCandidates: Array<{
    id: string;
    name: string;
    position: string;
    match: number;
    avatar: string;
  }>;
  pendingActions: Array<{
    type: 'interview_feedback' | 'resume_review' | 'jd_approval' | 'offer_send';
    title: string;
    description: string;
    count: number;
    items: Array<{
      id: string;
      name: string;
      position?: string;
      daysOverdue?: number;
      link: string;
    }>;
  }>;
  todaySchedules: Array<{
    id: string;
    candidateId: string;
    candidateName: string;
    position: string;
    scheduledAt: string;
    durationMinutes: number;
    status: string;
    interviewType?: string;
    meetingPlatform?: string;
    meetingLink?: string;
    interviewers: Array<{ id: string; email: string; name?: string | null; avatar_url?: string | null }>;
  }>;
  positionStatus: Array<{
    jobPostId: string;
    position: string;
    team: string;
    daysSincePost: number;
    new: number;
    document: number;
    interview: number;
    final: number;
    offer: number;
    progress: number;
  }>;
  hiringFunnel: Array<{
    stage: string;
    count: number;
  }>;
  aiInsight?: string | null | undefined;
}

// 트렌드 데이터 타입 (추후 실제 데이터로 교체 가능)
interface TrendData {
  newApplications?: number;
  interviewsInProgress?: number;
  offersSent?: number;
  hiringCompleted?: number;
}

export function OverviewClient({ 
  stats, 
  recentActivity, 
  topCandidates,
  pendingActions,
  todaySchedules,
  positionStatus,
  hiringFunnel,
  aiInsight,
}: OverviewClientProps) {
  const router = useRouter();
  const [userRole, setUserRole] = useState<'admin' | 'recruiter' | 'interviewer' | null>(null);
  const [userName, setUserName] = useState<string>('님');
  const [isSeeding, setIsSeeding] = useState(false);
  const [scheduleFilter, setScheduleFilter] = useState<'today' | 'week' | 'tomorrow'>('today');
  const [aiInsightState, setAiInsightState] = useState<string | null>(aiInsight ?? null);

  // 사용자 프로필 정보 로드 (이름 및 역할)
  useEffect(() => {
    async function loadUserProfile() {
      try {
        const result = await getUserProfile();
        if (result.data) {
          setUserRole(result.data.role);
          setUserName(result.data.displayName || '님');
        }
      } catch (error) {
        console.error('사용자 프로필 로드 실패:', error);
      }
    }
    loadUserProfile();
  }, []);

  // ✅ 체감 속도 개선: AI 인사이트는 화면이 뜬 뒤 백그라운드로 로드합니다.
  useEffect(() => {
    let cancelled = false;
    async function loadInsight() {
      try {
        // 이미 서버에서 내려온 값이 있으면 재호출하지 않습니다.
        if (aiInsightState && aiInsightState.trim().length > 0) return;
        const result = await getDashboardInsight();
        if (cancelled) return;
        if (result.data && result.data.trim().length > 0) {
          setAiInsightState(result.data);
        }
      } catch (error) {
        // 인사이트 실패는 UX 치명도가 낮으므로 조용히 무시합니다.
        console.error('AI 인사이트 로드 실패:', error);
      }
    }
    void loadInsight();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 시간대별 인사말 생성 함수
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return '좋은 아침이에요';
    if (hour < 18) return '좋은 오후에요';
    return '좋은 저녁이에요';
  };

  // 더미 데이터 생성
  const handleSeedData = async () => {
    if (!confirm('더미 데이터를 생성하시겠습니까? (조직, 프로세스, 채용 공고 8개, 후보자 30명, 면접 일정 15개)')) {
      return;
    }

    setIsSeeding(true);
    try {
      const result = await seedDummyData();
      if (result.data) {
        toast.success(
          `더미 데이터 생성 완료!\n- 채용 공고: ${result.data.jobPosts}개\n- 후보자: ${result.data.candidates}명\n- 면접 일정: ${result.data.schedules}개`,
          { duration: 5000 }
        );
        router.refresh();
      } else if (result.error) {
        toast.error(`더미 데이터 생성 실패: ${result.error}`);
      }
    } catch (error) {
      console.error('더미 데이터 생성 중 오류:', error);
      toast.error('더미 데이터 생성 중 오류가 발생했습니다.');
    } finally {
      setIsSeeding(false);
    }
  };

  // 시간 포맷팅
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  };

  // 시간대별 색상 클래스 (오전/오후/저녁)
  const getTimeSlotColor = (dateString: string) => {
    const date = new Date(dateString);
    const hour = date.getHours();
    if (hour < 12) {
      return 'bg-blue-50 border-blue-200 text-blue-700';
    } else if (hour < 18) {
      return 'bg-orange-50 border-orange-200 text-orange-700';
    } else {
      return 'bg-purple-50 border-purple-200 text-purple-700';
    }
  };

  // 면접 타입 한글 변환
  const getInterviewTypeText = (type?: string) => {
    const typeMap: Record<string, string> = {
      technical: '기술면접',
      portfolio: '포트폴리오 리뷰',
      hr_screening: 'HR 스크리닝',
      cultural_fit: '컬처핏 인터뷰',
      final: '최종면접',
    };
    return typeMap[type || ''] || '면접';
  };

  // 액션 타입별 아이콘
  const getActionIcon = (type: string) => {
    switch (type) {
      case 'interview_feedback':
        return FileText;
      case 'resume_review':
        return FileText;
      case 'jd_approval':
        return Briefcase;
      case 'offer_send':
        return Send;
      default:
        return AlertCircle;
    }
  };

  // 액션 타입별 색상
  const getActionColor = (type: string) => {
    switch (type) {
      case 'interview_feedback':
        return 'text-orange-600 bg-orange-50';
      case 'resume_review':
        return 'text-blue-600 bg-blue-50';
      case 'jd_approval':
        return 'text-purple-600 bg-purple-50';
      case 'offer_send':
        return 'text-green-600 bg-green-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  // 트렌드 데이터 (더미 데이터 - 추후 실제 데이터로 교체 가능)
  const trends: TrendData = {
    newApplications: 12,
    interviewsInProgress: -5,
    offersSent: 8,
    hiringCompleted: 15,
  };

  // 진행률 바 색상 결정 함수
  const getProgressBarColor = (progress: number) => {
    if (progress >= 100) {
      return 'bg-gradient-to-r from-emerald-500 to-emerald-600';
    } else if (progress >= 50) {
      return 'bg-gradient-to-r from-blue-500 to-indigo-600';
    } else {
      return 'bg-gradient-to-r from-amber-400 to-orange-500';
    }
  };

  const hasData = stats.newApplications > 0 || stats.interviewsInProgress > 0 || stats.offersSent > 0 || stats.hiringCompleted > 0;

  // 오늘 일정 필터링
  const filteredSchedules = (todaySchedules || []).filter(schedule => {
    const scheduleDate = new Date(schedule.scheduledAt);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);

    if (scheduleFilter === 'today') {
      return scheduleDate >= today && scheduleDate < tomorrow;
    } else if (scheduleFilter === 'tomorrow') {
      return scheduleDate >= tomorrow && scheduleDate < new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000);
    } else {
      return scheduleDate >= today && scheduleDate < weekEnd;
    }
  });

  // 오늘 요약 계산
  const todaySummary = {
    interviews: filteredSchedules.length,
    urgentActions: (pendingActions || []).reduce((sum, action) => {
      const overdueItems = (action.items || []).filter(item => item.daysOverdue && item.daysOverdue > 0);
      return sum + overdueItems.length;
    }, 0),
  };

  return (
    <div className="h-full overflow-auto bg-slate-50">
      <div className="px-4 sm:px-6 lg:px-8 py-6">
        {/* AI 인사이트 히어로 섹션 */}
        <div className="mb-8">
          <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-blue-50 rounded-2xl shadow-sm border border-slate-100 p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-indigo-100/50 flex items-center justify-center">
                <Sparkles className="text-indigo-500" size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-3xl font-bold tracking-tight text-indigo-950 mb-3">
                  {aiInsightState || `${getGreeting()}, ${userName}님`}
                </h1>
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="inline-flex items-center gap-1 bg-blue-50 text-brand-main px-3 py-1 rounded-full text-sm font-medium">
                    오늘 면접 {todaySummary.interviews}건
                  </span>
                  {todaySummary.urgentActions > 0 && (
                    <span className="inline-flex items-center gap-1 bg-orange-50 text-orange-600 px-3 py-1 rounded-full text-sm font-medium">
                      긴급 액션 {todaySummary.urgentActions}건
                    </span>
                  )}
                </div>
                {aiInsightState && (
                  <div className="inline-flex items-center gap-1.5 bg-indigo-100/50 text-indigo-700 px-2.5 py-0.5 rounded-full text-xs font-medium">
                    <Sparkles size={12} className="text-indigo-500" />
                    AI-Powered Insights
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* KPI 요약 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* 신규 지원 */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 hover:-translate-y-1 hover:shadow-md transition-all duration-200 cursor-pointer">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                <UserPlus className="text-teal-600" size={24} />
              </div>
            </div>
            <div className="text-sm text-slate-600 font-medium mb-1">신규 지원</div>
            <div className="text-4xl font-extrabold tracking-tight text-slate-900 mb-2">{stats.newApplications}</div>
            {trends.newApplications !== undefined && (
              <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                trends.newApplications > 0 
                  ? 'text-emerald-600 bg-emerald-50' 
                  : 'text-rose-600 bg-rose-50'
              }`}>
                {trends.newApplications > 0 ? (
                  <TrendingUp size={12} />
                ) : (
                  <TrendingDown size={12} />
                )}
                {trends.newApplications > 0 ? '+' : ''}{trends.newApplications}% vs last week
              </div>
            )}
          </div>

          {/* 면접 진행 */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 hover:-translate-y-1 hover:shadow-md transition-all duration-200 cursor-pointer">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Clock className="text-amber-600" size={24} />
              </div>
            </div>
            <div className="text-sm text-slate-600 font-medium mb-1">면접 진행</div>
            <div className="text-4xl font-extrabold tracking-tight text-slate-900 mb-2">{stats.interviewsInProgress}</div>
            {trends.interviewsInProgress !== undefined && (
              <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                trends.interviewsInProgress > 0 
                  ? 'text-emerald-600 bg-emerald-50' 
                  : 'text-rose-600 bg-rose-50'
              }`}>
                {trends.interviewsInProgress > 0 ? (
                  <TrendingUp size={12} />
                ) : (
                  <TrendingDown size={12} />
                )}
                {trends.interviewsInProgress > 0 ? '+' : ''}{trends.interviewsInProgress}% vs last week
              </div>
            )}
          </div>

          {/* 오퍼 발송 */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 hover:-translate-y-1 hover:shadow-md transition-all duration-200 cursor-pointer">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Send className="text-blue-600" size={24} />
              </div>
            </div>
            <div className="text-sm text-slate-600 font-medium mb-1">오퍼 발송</div>
            <div className="text-4xl font-extrabold tracking-tight text-slate-900 mb-2">{stats.offersSent}</div>
            {trends.offersSent !== undefined && (
              <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                trends.offersSent > 0 
                  ? 'text-emerald-600 bg-emerald-50' 
                  : 'text-rose-600 bg-rose-50'
              }`}>
                {trends.offersSent > 0 ? (
                  <TrendingUp size={12} />
                ) : (
                  <TrendingDown size={12} />
                )}
                {trends.offersSent > 0 ? '+' : ''}{trends.offersSent}% vs last week
              </div>
            )}
          </div>

          {/* 채용 완료 */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 hover:-translate-y-1 hover:shadow-md transition-all duration-200 cursor-pointer">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Award className="text-purple-600" size={24} />
              </div>
            </div>
            <div className="text-sm text-slate-600 font-medium mb-1">채용 완료</div>
            <div className="text-4xl font-extrabold tracking-tight text-slate-900 mb-2">{stats.hiringCompleted}</div>
            {trends.hiringCompleted !== undefined && (
              <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                trends.hiringCompleted > 0 
                  ? 'text-emerald-600 bg-emerald-50' 
                  : 'text-rose-600 bg-rose-50'
              }`}>
                {trends.hiringCompleted > 0 ? (
                  <TrendingUp size={12} />
                ) : (
                  <TrendingDown size={12} />
                )}
                {trends.hiringCompleted > 0 ? '+' : ''}{trends.hiringCompleted}% vs last week
              </div>
            )}
          </div>
        </div>

        {!hasData ? (
          /* 빈 상태 (Empty State) */
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <Users className="text-slate-400" size={32} />
              </div>
              <h2 className="text-xl font-semibold text-slate-900 mb-2">데이터가 없습니다</h2>
              <p className="text-slate-400 mb-6">
                더미 데이터를 생성하여 대시보드를 테스트해보세요.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                {userRole === 'admin' && (
                  <button
                    onClick={handleSeedData}
                    disabled={isSeeding}
                    className="px-6 py-3 bg-brand-main text-white rounded-xl font-medium hover:bg-brand-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSeeding ? '생성 중...' : '더미 데이터 생성'}
                  </button>
                )}
                <button
                  onClick={() => router.push('/jobs/create')}
                  className="px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors"
                >
                  첫 채용 공고 만들기
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* 중앙 섹션: 액션 필요 + 오늘 일정 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 액션 필요 */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-dark to-brand-main flex items-center justify-center">
                    <AlertCircle className="text-white" size={18} />
                  </div>
                  <h2 className="text-lg font-bold text-slate-900">액션 필요</h2>
                </div>
                {(pendingActions || []).length > 0 ? (
                  <div className="space-y-3">
                    {(pendingActions || []).slice(0, 5).map((action, index) => {
                      const Icon = getActionIcon(action.type);
                      const colorClass = getActionColor(action.type);
                      const firstItem = action.items[0];
                      
                      return (
                        <div
                          key={index}
                          className="flex items-start gap-3 p-3 rounded-lg hover:bg-blue-50/50 cursor-pointer transition-colors"
                          onClick={() => firstItem && router.push(firstItem.link)}
                        >
                          <div className={`w-10 h-10 rounded-lg ${colorClass} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                            <Icon size={20} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-slate-900 mb-1">{action.title}</div>
                            <div className="text-sm text-slate-600 truncate">
                              {action.description}
                            </div>
                            {firstItem?.daysOverdue !== undefined && firstItem.daysOverdue > 0 && (
                              <div className="inline-flex items-center gap-1 text-xs font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full mt-1">
                                <AlertCircle size={12} />
                                {firstItem.daysOverdue}일 지연
                              </div>
                            )}
                          </div>
                          <ChevronRight className="text-slate-400 flex-shrink-0" size={20} />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                      <CheckCircle2 className="text-slate-400" size={24} />
                    </div>
                    <p className="text-sm text-slate-400">액션이 필요한 항목이 없습니다.</p>
                  </div>
                )}
              </div>

              {/* 오늘 일정 */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-dark to-brand-main flex items-center justify-center">
                      <Calendar className="text-white" size={18} />
                    </div>
                    <h2 className="text-lg font-bold text-slate-900">오늘 일정 <span className="text-brand-main">{filteredSchedules.length}</span>건</h2>
                  </div>
                  <button
                    onClick={() => router.push('/calendar')}
                    className="text-sm font-medium text-brand-main hover:text-brand-dark flex items-center gap-1 transition-colors"
                  >
                    전체 보기 <ArrowRight size={14} />
                  </button>
                </div>
                {/* Segmented Control 스타일 필터 */}
                <div className="bg-slate-100 p-1 rounded-lg mb-4 flex gap-1">
                  <button
                    onClick={() => setScheduleFilter('today')}
                    className={`flex-1 px-3 py-1.5 text-sm rounded-md transition-all font-medium ${
                      scheduleFilter === 'today'
                        ? 'bg-white text-brand-main shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    오늘까지
                  </button>
                  <button
                    onClick={() => setScheduleFilter('week')}
                    className={`flex-1 px-3 py-1.5 text-sm rounded-md transition-all font-medium ${
                      scheduleFilter === 'week'
                        ? 'bg-white text-brand-main shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    이번 주
                  </button>
                  <button
                    onClick={() => setScheduleFilter('tomorrow')}
                    className={`flex-1 px-3 py-1.5 text-sm rounded-md transition-all font-medium ${
                      scheduleFilter === 'tomorrow'
                        ? 'bg-white text-brand-main shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    내일까지
                  </button>
                </div>
                {filteredSchedules.length > 0 ? (
                  <div className="space-y-3">
                    {filteredSchedules.slice(0, 4).map((schedule) => {
                      const timeSlotColor = getTimeSlotColor(schedule.scheduledAt);
                      return (
                        <div
                          key={schedule.id}
                          className="flex items-start gap-3 p-3 rounded-lg hover:bg-blue-50/50 cursor-pointer transition-all border border-transparent hover:border-slate-200"
                          onClick={() => router.push(`/candidates/${schedule.candidateId}`)}
                        >
                          <div className={`flex-shrink-0 px-3 py-2 rounded-lg border ${timeSlotColor} min-w-[60px] text-center`}>
                            <div className="text-sm font-bold">
                              {formatTime(schedule.scheduledAt)}
                            </div>
                            <div className="text-xs font-medium">
                              {schedule.durationMinutes}분
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <CalendarCheck className="text-brand-main" size={16} />
                              <div className="font-medium text-slate-900">
                                {getInterviewTypeText(schedule.interviewType)}
                              </div>
                            </div>
                            <div className="text-sm text-slate-600 truncate">
                              {schedule.candidateName} · {schedule.position}
                            </div>
                            {schedule.interviewers.length > 0 && (
                              <div className="text-xs text-slate-500 mt-1">
                                면접관:{' '}
                                {schedule.interviewers
                                  .map((i) => {
                                    const trimmed = (i.name || '').trim();
                                    return trimmed.length > 0 ? trimmed : i.email.split('@')[0];
                                  })
                                  .join(', ')}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                      <Calendar className="text-slate-400" size={24} />
                    </div>
                    <p className="text-sm text-slate-400">일정이 없습니다.</p>
                  </div>
                )}
              </div>
            </div>

            {/* 내 포지션 현황 */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-dark to-brand-main flex items-center justify-center">
                  <Briefcase className="text-white" size={18} />
                </div>
                <h2 className="text-lg font-bold text-slate-900">내 포지션 현황 <span className="text-brand-main">{(positionStatus || []).length}</span>개</h2>
              </div>
              {(positionStatus || []).length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">포지션</th>
                        <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">신규</th>
                        <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">서류</th>
                        <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">면접</th>
                        <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">최종</th>
                        <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">오퍼</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">진행률</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(positionStatus || []).map((position) => {
                        const total = position.new + position.document + position.interview + position.final + position.offer;
                        return (
                          <tr key={position.jobPostId} className="border-b border-slate-100 hover:bg-blue-50/50 cursor-pointer transition-colors" onClick={() => router.push(`/jobs/${position.jobPostId}`)}>
                            <td className="py-3 px-4">
                              <div className="font-medium text-slate-900">{position.position}</div>
                              <div className="text-xs text-slate-500">{position.team} - D+{position.daysSincePost}</div>
                            </td>
                            <td className="text-center py-3 px-4 text-sm text-slate-900">{position.new}</td>
                            <td className="text-center py-3 px-4 text-sm text-slate-900">{position.document}</td>
                            <td className="text-center py-3 px-4 text-sm text-slate-900">{position.interview}</td>
                            <td className="text-center py-3 px-4 text-sm text-slate-900">{position.final}</td>
                            <td className="text-center py-3 px-4 text-sm text-slate-900">{position.offer}</td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2.5 bg-slate-200 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full transition-all rounded-full ${getProgressBarColor(position.progress)}`}
                                    style={{ width: `${position.progress}%` }}
                                  />
                                </div>
                                <span className="text-xs font-medium text-slate-600 w-12 text-right">{position.progress}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                    <Briefcase className="text-slate-400" size={24} />
                  </div>
                  <p className="text-sm text-slate-400">포지션이 없습니다.</p>
                </div>
              )}
            </div>

            {/* 최근 활동 + 채용 퍼널 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 최근 활동 */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-dark to-brand-main flex items-center justify-center">
                    <Clock className="text-white" size={18} />
                  </div>
                  <h2 className="text-lg font-bold text-slate-900">최근 활동</h2>
                </div>
                {(recentActivity || []).length > 0 ? (
                  <div className="space-y-4">
                    {(recentActivity || []).slice(0, 6).map((activity, index) => (
                      <div key={activity.id} className="flex items-start gap-3 relative pl-6">
                        {/* 타임라인 수직 연결선 */}
                        {index < (recentActivity || []).slice(0, 6).length - 1 && (
                          <div className="absolute left-[11px] top-6 bottom-0 w-0.5 border-l-2 border-slate-100" />
                        )}
                        {/* 타임라인 노드 */}
                        <div className="w-2 h-2 rounded-full bg-brand-main ring-4 ring-brand-main/20 flex-shrink-0 mt-2 relative z-10" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-900">
                            <span className="font-semibold">{activity.candidate}</span>
                            {' '}{activity.action}{' '}
                            <span className="font-semibold">{activity.job}</span>
                          </p>
                          <p className="text-xs text-slate-500 mt-1">{activity.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                      <Clock className="text-slate-400" size={24} />
                    </div>
                    <p className="text-sm text-slate-400">최근 활동이 없습니다.</p>
                  </div>
                )}
              </div>

              {/* 채용 퍼널 */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-dark to-brand-main flex items-center justify-center">
                      <TrendingUp className="text-white" size={18} />
                    </div>
                    <h2 className="text-lg font-bold text-slate-900">채용 퍼널</h2>
                  </div>
                  <select className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white hover:border-brand-main transition-colors">
                    <option>전체 포지션</option>
                  </select>
                </div>
                {(hiringFunnel || []).length > 0 ? (
                  <div className="space-y-4">
                    {(hiringFunnel || []).map((stage, index) => {
                      const maxCount = Math.max(...(hiringFunnel || []).map(s => s.count));
                      const percentage = maxCount > 0 ? (stage.count / maxCount) * 100 : 0;
                      // 퍼널 효과: 각 단계별로 너비가 점점 좁아지도록 계산
                      // 첫 번째 단계는 100%, 이후 단계는 이전 단계 대비 비율로 축소
                      const funnelWidth = index === 0 
                        ? 100 
                        : (hiringFunnel || [])[index - 1]?.count > 0
                          ? (stage.count / (hiringFunnel || [])[index - 1].count) * 100
                          : 0;
                      // 그라데이션 색상: 단계가 진행될수록 진해짐
                      const gradientClass = index === 0
                        ? 'bg-gradient-to-r from-blue-200 to-blue-300'
                        : index === 1
                        ? 'bg-gradient-to-r from-blue-300 to-blue-400'
                        : index === 2
                        ? 'bg-gradient-to-r from-blue-400 to-blue-500'
                        : index === 3
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600'
                        : 'bg-gradient-to-r from-blue-600 to-indigo-600';
                      
                      const stageNames: Record<string, string> = {
                        'Applied': '서류 접수',
                        'Screening': '서류 통과',
                        'Interview': '면접 진행',
                        'Offer': '최종 합격',
                        'Hired': '채용 완료',
                      };
                      const stageName = stageNames[stage.stage] || stage.stage;
                      
                      return (
                        <div key={index}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-slate-900">{stageName}</span>
                            <span className="text-sm font-semibold text-brand-main">{stage.count}명</span>
                          </div>
                          <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all rounded-full ${gradientClass}`}
                              style={{ width: `${Math.min(funnelWidth, 100)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                    <div className="pt-4 border-t border-slate-200 mt-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">전환율</span>
                        <span className="text-sm font-medium text-slate-900">
                          {(hiringFunnel || []).length > 0 && (hiringFunnel || [])[0]?.count > 0
                            ? (((hiringFunnel || [])[(hiringFunnel || []).length - 1]?.count || 0) / (hiringFunnel || [])[0].count * 100).toFixed(1)
                            : '0.0'}%
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                      <TrendingUp className="text-slate-400" size={24} />
                    </div>
                    <p className="text-sm text-slate-400">데이터가 없습니다.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
