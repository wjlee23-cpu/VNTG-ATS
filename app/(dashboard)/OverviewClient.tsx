'use client';

import { Users, Clock, Send, CheckCircle2, AlertCircle, FileText, Briefcase, Calendar, ArrowRight, ChevronRight, TrendingUp, UserPlus, CalendarCheck, Award } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { getUserProfile } from '@/api/queries/auth';
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
    interviewers: Array<{ id: string; email: string }>;
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
}

export function OverviewClient({ 
  stats, 
  recentActivity, 
  topCandidates,
  pendingActions,
  todaySchedules,
  positionStatus,
  hiringFunnel,
}: OverviewClientProps) {
  const router = useRouter();
  const [userRole, setUserRole] = useState<'admin' | 'recruiter' | 'interviewer' | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const [scheduleFilter, setScheduleFilter] = useState<'today' | 'week' | 'tomorrow'>('today');

  // 사용자 역할 확인
  useEffect(() => {
    async function loadUserRole() {
      try {
        const result = await getUserProfile();
        if (result.data) {
          setUserRole(result.data.role);
        }
      } catch (error) {
        console.error('사용자 역할 로드 실패:', error);
      }
    }
    loadUserRole();
  }, []);

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
    <div className="h-full overflow-auto bg-gray-50">
      <div className="px-8 py-6">
        {/* Header */}
        <div className="mb-8 gradient-blue-subtle rounded-2xl px-8 py-6 -mx-8 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-2">좋은 오후에요, 김하늘님</h1>
              <p className="text-sm text-muted-foreground">
                오늘 면접 <span className="font-semibold text-brand-main">{todaySummary.interviews}</span>건 · 긴급 액션 <span className="font-semibold text-orange-600">{todaySummary.urgentActions}</span>건
              </p>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* 신규 지원 */}
          <div className="card-modern p-6 bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200/50 animate-slide-up" style={{ animationDelay: '0ms' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-blue">
                <UserPlus className="text-white" size={24} />
              </div>
            </div>
            <div className="text-sm text-blue-700 font-medium mb-1">신규 지원</div>
            <div className="text-3xl font-bold text-blue-900">{stats.newApplications}</div>
          </div>

          {/* 면접 진행 */}
          <div className="card-modern p-6 bg-gradient-to-br from-orange-50 to-orange-100/50 border-orange-200/50 animate-slide-up" style={{ animationDelay: '100ms' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg" style={{ boxShadow: '0 8px 24px rgba(249, 115, 22, 0.15)' }}>
                <Clock className="text-white" size={24} />
              </div>
            </div>
            <div className="text-sm text-orange-700 font-medium mb-1">면접 진행</div>
            <div className="text-3xl font-bold text-orange-900">{stats.interviewsInProgress}</div>
          </div>

          {/* 오퍼 발송 */}
          <div className="card-modern p-6 bg-gradient-to-br from-green-50 to-green-100/50 border-green-200/50 animate-slide-up" style={{ animationDelay: '200ms' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-lg" style={{ boxShadow: '0 8px 24px rgba(34, 197, 94, 0.15)' }}>
                <Send className="text-white" size={24} />
              </div>
            </div>
            <div className="text-sm text-green-700 font-medium mb-1">오퍼 발송</div>
            <div className="text-3xl font-bold text-green-900">{stats.offersSent}</div>
          </div>

          {/* 채용 완료 */}
          <div className="card-modern p-6 bg-gradient-to-br from-purple-50 to-purple-100/50 border-purple-200/50 animate-slide-up" style={{ animationDelay: '300ms' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg" style={{ boxShadow: '0 8px 24px rgba(168, 85, 247, 0.15)' }}>
                <Award className="text-white" size={24} />
              </div>
            </div>
            <div className="text-sm text-purple-700 font-medium mb-1">채용 완료</div>
            <div className="text-3xl font-bold text-purple-900">{stats.hiringCompleted}</div>
          </div>
        </div>

        {!hasData ? (
          <div className="card-modern p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Users className="text-muted-foreground" size={32} />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">데이터가 없습니다</h2>
              <p className="text-muted-foreground mb-6">
                더미 데이터를 생성하여 대시보드를 테스트해보세요.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                {userRole === 'admin' && (
                  <button
                    onClick={handleSeedData}
                    disabled={isSeeding}
                    className="px-6 py-3 gradient-blue text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSeeding ? '생성 중...' : '더미 데이터 생성'}
                  </button>
                )}
                <button
                  onClick={() => router.push('/jobs/create')}
                  className="px-6 py-3 bg-brand-main text-white rounded-xl font-medium hover:bg-brand-dark transition-colors"
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
              <div className="card-modern p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-dark to-brand-main flex items-center justify-center">
                    <AlertCircle className="text-white" size={18} />
                  </div>
                  <h2 className="text-lg font-bold text-foreground">액션 필요</h2>
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
                          className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                          onClick={() => firstItem && router.push(firstItem.link)}
                        >
                          <div className={`w-10 h-10 rounded-lg ${colorClass} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                            <Icon size={20} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-foreground mb-1">{action.title}</div>
                            <div className="text-sm text-muted-foreground truncate">
                              {action.description}
                            </div>
                            {firstItem?.daysOverdue !== undefined && firstItem.daysOverdue > 0 && (
                              <div className="inline-flex items-center gap-1 text-xs font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full mt-1">
                                <AlertCircle size={12} />
                                {firstItem.daysOverdue}일 지연
                              </div>
                            )}
                          </div>
                          <ChevronRight className="text-muted-foreground flex-shrink-0" size={20} />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">액션이 필요한 항목이 없습니다.</p>
                )}
              </div>

              {/* 오늘 일정 */}
              <div className="card-modern p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-dark to-brand-main flex items-center justify-center">
                      <Calendar className="text-white" size={18} />
                    </div>
                    <h2 className="text-lg font-bold text-foreground">오늘 일정 <span className="text-brand-main">{filteredSchedules.length}</span>건</h2>
                  </div>
                  <button
                    onClick={() => router.push('/calendar')}
                    className="text-sm font-medium text-brand-main hover:text-brand-dark flex items-center gap-1 transition-colors"
                  >
                    전체 보기 <ArrowRight size={14} />
                  </button>
                </div>
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => setScheduleFilter('today')}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-all font-medium ${
                      scheduleFilter === 'today'
                        ? 'gradient-blue text-white shadow-blue'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    오늘까지
                  </button>
                  <button
                    onClick={() => setScheduleFilter('week')}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-all font-medium ${
                      scheduleFilter === 'week'
                        ? 'gradient-blue text-white shadow-blue'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    이번 주
                  </button>
                  <button
                    onClick={() => setScheduleFilter('tomorrow')}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-all font-medium ${
                      scheduleFilter === 'tomorrow'
                        ? 'gradient-blue text-white shadow-blue'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
                          className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-all border border-transparent hover:border-gray-200"
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
                              <div className="font-medium text-foreground">
                                {getInterviewTypeText(schedule.interviewType)}
                              </div>
                            </div>
                            <div className="text-sm text-muted-foreground truncate">
                              {schedule.candidateName} · {schedule.position}
                            </div>
                            {schedule.interviewers.length > 0 && (
                              <div className="text-xs text-muted-foreground mt-1">
                                면접관: {schedule.interviewers.map(i => i.email.split('@')[0]).join(', ')}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">일정이 없습니다.</p>
                )}
              </div>
            </div>

            {/* 내 포지션 현황 */}
            <div className="card-modern p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-dark to-brand-main flex items-center justify-center">
                  <Briefcase className="text-white" size={18} />
                </div>
                <h2 className="text-lg font-bold text-foreground">내 포지션 현황 <span className="text-brand-main">{(positionStatus || []).length}</span>개</h2>
              </div>
              {(positionStatus || []).length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">포지션</th>
                        <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">신규</th>
                        <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">서류</th>
                        <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">면접</th>
                        <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">최종</th>
                        <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">오퍼</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">진행률</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(positionStatus || []).map((position) => {
                        const total = position.new + position.document + position.interview + position.final + position.offer;
                        return (
                          <tr key={position.jobPostId} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/jobs/${position.jobPostId}`)}>
                            <td className="py-3 px-4">
                              <div className="font-medium text-foreground">{position.position}</div>
                              <div className="text-xs text-muted-foreground">{position.team} - D+{position.daysSincePost}</div>
                            </td>
                            <td className="text-center py-3 px-4 text-sm">{position.new}</td>
                            <td className="text-center py-3 px-4 text-sm">{position.document}</td>
                            <td className="text-center py-3 px-4 text-sm">{position.interview}</td>
                            <td className="text-center py-3 px-4 text-sm">{position.final}</td>
                            <td className="text-center py-3 px-4 text-sm">{position.offer}</td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2.5 bg-gray-200 rounded-full overflow-hidden">
                                  <div
                                    className="h-full gradient-blue transition-all rounded-full"
                                    style={{ width: `${position.progress}%` }}
                                  />
                                </div>
                                <span className="text-xs font-medium text-muted-foreground w-12 text-right">{position.progress}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">포지션이 없습니다.</p>
              )}
            </div>

            {/* 최근 활동 + 채용 퍼널 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 최근 활동 */}
              <div className="card-modern p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-dark to-brand-main flex items-center justify-center">
                    <Clock className="text-white" size={18} />
                  </div>
                  <h2 className="text-lg font-bold text-foreground">최근 활동</h2>
                </div>
                {(recentActivity || []).length > 0 ? (
                  <div className="space-y-4">
                    {(recentActivity || []).slice(0, 6).map((activity, index) => (
                      <div key={activity.id} className="flex items-start gap-3 relative pl-4">
                        {/* 타임라인 라인 */}
                        {index < (recentActivity || []).slice(0, 6).length - 1 && (
                          <div className="absolute left-[7px] top-5 w-0.5 h-full bg-gradient-to-b from-brand-main to-transparent" />
                        )}
                        <div className="w-3 h-3 rounded-full bg-brand-main border-2 border-white shadow-sm flex-shrink-0 mt-1.5 relative z-10" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground">
                            <span className="font-semibold">{activity.candidate}</span>
                            {' '}{activity.action}{' '}
                            <span className="font-semibold">{activity.job}</span>
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">{activity.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">최근 활동이 없습니다.</p>
                )}
              </div>

              {/* 채용 퍼널 */}
              <div className="card-modern p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-dark to-brand-main flex items-center justify-center">
                      <TrendingUp className="text-white" size={18} />
                    </div>
                    <h2 className="text-lg font-bold text-foreground">채용 퍼널</h2>
                  </div>
                  <select className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white hover:border-brand-main transition-colors">
                    <option>전체 포지션</option>
                  </select>
                </div>
                {(hiringFunnel || []).length > 0 ? (
                  <div className="space-y-4">
                    {(hiringFunnel || []).map((stage, index) => {
                      const maxCount = Math.max(...(hiringFunnel || []).map(s => s.count));
                      const percentage = maxCount > 0 ? (stage.count / maxCount) * 100 : 0;
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
                            <span className="text-sm font-medium text-foreground">{stageName}</span>
                            <span className="text-sm font-semibold text-brand-main">{stage.count}명</span>
                          </div>
                          <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full gradient-blue transition-all rounded-full"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                    <div className="pt-4 border-t border-gray-200 mt-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">전환율</span>
                        <span className="text-sm font-medium text-foreground">
                          {(hiringFunnel || []).length > 0 && (hiringFunnel || [])[0]?.count > 0
                            ? (((hiringFunnel || [])[(hiringFunnel || []).length - 1]?.count || 0) / (hiringFunnel || [])[0].count * 100).toFixed(1)
                            : '0.0'}%
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">데이터가 없습니다.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
