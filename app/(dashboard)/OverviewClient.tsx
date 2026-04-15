'use client';

import {
  Sparkles,
  Info,
  FileEdit,
  AlertCircle,
  FileText,
  Briefcase,
  Calendar,
  Send,
  Users,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { getUserProfile } from '@/api/queries/auth';
import { seedDummyData } from '@/api/actions/seed';
import { toast } from 'sonner';
import { StageLeadTimeCard, type StageLeadTimeRow } from '@/components/dashboard/StageLeadTimeCard';

interface OverviewClientProps {
  stats: {
    newApplications: number;
    interviewsInProgress: number;
    offersSent: number;
    hiringCompleted: number;
  };
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
  aiInsight?: string | null | undefined;
  confirmedHiresCount?: number;
  averageTimeToHireDays?: number | null;
  timeToHireChangeDays?: number | null;
}

const KPI_TRENDS = {
  newApplications: 12,
  interviewsInProgress: 4,
} as const;

const DUMMY_LEAD_STAGES: StageLeadTimeRow[] = [
  { id: 's1', label: '\uC811\uC218 \u2192 \uC11C\uB958\uD1B5\uACFC', days: 3.2 },
  { id: 's2', label: '\uC11C\uB958\uD1B5\uACFC \u2192 \uBA74\uC811', days: 8.5 },
  { id: 's3', label: '\uBA74\uC811 \u2192 \uCC98\uC6B0\uD611\uC758', days: 4.1 },
  { id: 's4', label: '\uCC98\uC6B0\uD611\uC758 \u2192 \uC785\uC0AC', days: 2.7 },
];

export function OverviewClient({
  stats,
  pendingActions,
  todaySchedules,
  positionStatus,
  hiringFunnel,
  aiInsight,
  confirmedHiresCount = 0,
  averageTimeToHireDays = null,
  timeToHireChangeDays = null,
}: OverviewClientProps) {
  const router = useRouter();
  const [userRole, setUserRole] = useState<'admin' | 'recruiter' | 'interviewer' | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const [actionTab, setActionTab] = useState<'tasks' | 'schedules'>('tasks');

  useEffect(() => {
    async function loadUserProfile() {
      try {
        const result = await getUserProfile();
        if (result.data) setUserRole(result.data.role);
      } catch (error) {
        console.error('사용자 프로필 로드 실패:', error);
      }
    }
    loadUserProfile();
  }, []);

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


  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  };

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
        return FileEdit;
      case 'resume_review':
        return Users;
      case 'jd_approval':
        return Briefcase;
      case 'offer_send':
        return Send;
      default:
        return AlertCircle;
    }
  };

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
        return 'text-neutral-600 bg-neutral-100';
    }
  };

  const flatTasks = useMemo(
    () =>
      (pendingActions ?? []).flatMap((action) =>
        (action.items ?? []).map((item) => ({ action, item }))
      ),
    [pendingActions]
  );

  const todaySchedulesOnly = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return (todaySchedules ?? []).filter((s) => {
      const d = new Date(s.scheduledAt);
      return d >= start && d <= end;
    });
  }, [todaySchedules]);

  const resumeReviewWaiting = useMemo(
    () =>
      (pendingActions ?? [])
        .filter((a) => a.type === 'resume_review')
        .reduce((s, a) => s + (a.items?.length ?? 0), 0),
    [pendingActions]
  );

  const funnelRows = useMemo(() => {
    const map = Object.fromEntries((hiringFunnel ?? []).map((s) => [s.stage, s.count]));
    const applied = Number(map['Applied'] ?? 0);
    const screening = Number(map['Screening'] ?? 0);
    const interview = Number(map['Interview'] ?? 0);
    const finalCombined = Number(map['Offer'] ?? 0) + Number(map['Hired'] ?? 0);
    const rows = [
      { key: 'applied', label: '서류 접수', count: applied },
      { key: 'screening', label: '서류 통과', count: screening },
      { key: 'interview', label: '면접 진행', count: interview },
      { key: 'final', label: '오퍼 · 입사', count: finalCombined },
    ];
    const first = rows[0].count;
    return rows.map((row, i) => {
      const prev = i === 0 ? first : rows[i - 1].count;
      const pctFromFirst = first > 0 ? (row.count / first) * 100 : 0;
      const convLabel = i > 0 && prev > 0 ? Math.round((row.count / prev) * 100) : null;
      return { ...row, barWidthPct: Math.min(100, pctFromFirst), convLabel };
    });
  }, [hiringFunnel]);

  const funnelBarColors = ['bg-neutral-800', 'bg-neutral-600', 'bg-neutral-400', 'bg-indigo-500'];

  const finalConversionPct = useMemo(() => {
    const first = funnelRows[0]?.count ?? 0;
    const last = funnelRows[3]?.count ?? 0;
    if (first <= 0) return 0;
    return Math.round((last / first) * 1000) / 10;
  }, [funnelRows]);

  const useRealTth = confirmedHiresCount > 0 && averageTimeToHireDays != null;
  const displayTth = useRealTth ? averageTimeToHireDays! : 18.5;
  const displayTthChange = useRealTth ? timeToHireChangeDays ?? 0 : -1.2;

  const leadStages = DUMMY_LEAD_STAGES;
  const leadTotal = useMemo(() => leadStages.reduce((s, x) => s + x.days, 0), [leadStages]);
  const bottleneckStage = useMemo(
    () => leadStages.reduce((a, b) => (a.days >= b.days ? a : b)),
    [leadStages]
  );
  const leadSummary = `${bottleneckStage.label} 구간에서 가장 오래 걸립니다.`;

  const firstTaskLink = flatTasks[0]?.item.link;

  return (
    <div className="flex-1 overflow-y-auto p-8 lg:p-10 bg-[#F7F7F8] min-h-full">
      <div className="max-w-[1440px] mx-auto space-y-6">
        <div className="relative bg-white rounded-2xl p-8 border border-neutral-200 shadow-sm overflow-hidden">
          <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-indigo-50/50 to-transparent opacity-60" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-100/50 flex items-center justify-center shrink-0 border border-indigo-200/50">
                <Sparkles className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider mb-2">
                  AI Overview
                </div>
                <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900 mb-1">
                  {aiInsight?.trim() ? (
                    aiInsight
                  ) : (
                    <>
                      이번 주 채용 리드타임이 지난주 대비{' '}
                      <span className="text-indigo-600">
                        {useRealTth && displayTthChange !== 0
                          ? `${Math.abs(displayTthChange).toFixed(1)}일 ${displayTthChange < 0 ? '단축' : '증가'}`
                          : '1.2일 단축'}
                      </span>
                      되었습니다.
                    </>
                  )}
                </h1>
                <p className="text-sm text-neutral-500 font-medium">
                  오늘 긴급하게 처리해야 할 서류 검토가 {resumeReviewWaiting}건 대기 중입니다.
                </p>
                {userRole === 'admin' && (
                  <button
                    type="button"
                    onClick={handleSeedData}
                    disabled={isSeeding}
                    className="mt-2 text-xs font-semibold text-neutral-500 hover:text-neutral-900 disabled:opacity-50"
                  >
                    {isSeeding ? '더미 생성 중...' : '더미 채우기'}
                  </button>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => router.push(firstTaskLink || '/candidates')}
              className="flex items-center gap-2 bg-neutral-900 text-white px-5 py-2.5 rounded-lg text-sm font-semibold shadow-md hover:bg-neutral-800 transition-all active:scale-[0.98]"
            >
              긴급 액션 처리하기
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <button
            type="button"
            className="card-hover bg-white rounded-2xl p-6 border border-neutral-200 cursor-pointer text-left"
            onClick={() => router.push('/candidates')}
          >
            <p className="text-xs font-bold text-neutral-400 mb-1 uppercase tracking-wider">신규 지원</p>
            <div className="flex items-baseline gap-3">
              <h2 className="text-3xl font-extrabold text-neutral-900">{stats.newApplications}</h2>
              <span className="text-xs font-bold text-emerald-600">+{KPI_TRENDS.newApplications}%</span>
            </div>
          </button>
          <button
            type="button"
            className="card-hover bg-white rounded-2xl p-6 border border-neutral-200 cursor-pointer text-left"
            onClick={() => router.push('/calendar')}
          >
            <p className="text-xs font-bold text-neutral-400 mb-1 uppercase tracking-wider">면접 진행</p>
            <div className="flex items-baseline gap-3">
              <h2 className="text-3xl font-extrabold text-neutral-900">{stats.interviewsInProgress}</h2>
              <span className="text-xs font-bold text-emerald-600">+{KPI_TRENDS.interviewsInProgress}%</span>
            </div>
          </button>
          <button
            type="button"
            className="card-hover bg-white rounded-2xl p-6 border border-neutral-200 cursor-pointer text-left"
            onClick={() => router.push('/offers')}
          >
            <p className="text-xs font-bold text-neutral-400 mb-1 uppercase tracking-wider">오퍼 발송</p>
            <div className="flex items-baseline gap-3">
              <h2 className="text-3xl font-extrabold text-neutral-900">{stats.offersSent}</h2>
              <span className="text-xs font-bold text-neutral-400">-</span>
            </div>
          </button>
          <button
            type="button"
            className="card-hover bg-white rounded-2xl p-6 border border-neutral-200 cursor-pointer relative overflow-hidden text-left"
            onClick={() => router.push('/analytics')}
          >
            <div className="absolute right-0 top-0 w-16 h-16 bg-gradient-to-bl from-indigo-50 to-transparent rounded-bl-full" />
            <p className="text-xs font-bold text-neutral-400 mb-1 uppercase tracking-wider flex items-center gap-1.5 relative">
              평균 리드타임 <Info className="w-3 h-3" />
            </p>
            <div className="flex items-baseline gap-3 relative">
              <h2 className="text-3xl font-extrabold text-neutral-900">
                {displayTth.toFixed(1)}
                <span className="text-lg text-neutral-500 ml-1">일</span>
              </h2>
              <span
                className={`text-xs font-bold ${displayTthChange <= 0 ? 'text-emerald-600' : 'text-red-500'}`}
              >
                {displayTthChange > 0 ? '+' : ''}
                {displayTthChange.toFixed(1)}일
              </span>
            </div>
          </button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.05)] h-[380px] flex flex-col">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h2 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">내 포지션 파이프라인</h2>
              <button
                type="button"
                onClick={() => router.push('/jobs')}
                className="text-xs font-semibold text-neutral-500 hover:text-neutral-900"
              >
                전체 보기
              </button>
            </div>
            <div className="flex-1 overflow-y-auto pr-2">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-neutral-100">
                    <th className="pb-2 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">포지션</th>
                    <th className="pb-2 text-[10px] font-bold text-neutral-400 uppercase tracking-wider text-center">
                      전체
                    </th>
                    <th className="pb-2 text-[10px] font-bold text-neutral-400 uppercase tracking-wider w-24">진행률</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {(positionStatus ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-sm text-neutral-400">
                        등록된 포지션이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    (positionStatus ?? []).map((position, idx) => {
                      const total =
                        position.new +
                        position.document +
                        position.interview +
                        position.final +
                        position.offer;
                      const barClass = idx % 2 === 0 ? 'bg-neutral-900' : 'bg-emerald-500';
                      return (
                        <tr
                          key={position.jobPostId}
                          className="hover:bg-neutral-50 cursor-pointer transition-colors group"
                          onClick={() => router.push(`/jobs/${position.jobPostId}`)}
                        >
                          <td className="py-3">
                            <p className="text-sm font-bold text-neutral-900 mb-0.5 group-hover:text-indigo-600">
                              {position.position}
                            </p>
                            <p className="text-[10px] text-neutral-400 font-medium">
                              D+{position.daysSincePost} · {position.team}
                            </p>
                          </td>
                          <td className="py-3 text-center text-sm font-semibold text-neutral-700">{total}</td>
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${barClass}`}
                                  style={{ width: `${Math.min(100, Math.max(0, position.progress))}%` }}
                                />
                              </div>
                              <span className="text-xs font-bold text-neutral-500 w-7 text-right">
                                {position.progress}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.05)] h-[380px] flex flex-col">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h2 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">오늘의 액션 및 일정</h2>
              <div className="bg-neutral-100/80 p-0.5 rounded-md flex">
                <button
                  type="button"
                  onClick={() => setActionTab('tasks')}
                  className={`px-2 py-1 text-[10px] rounded shadow-sm ${
                    actionTab === 'tasks'
                      ? 'font-bold bg-white text-neutral-900'
                      : 'font-medium text-neutral-500 hover:text-neutral-900'
                  }`}
                >
                  할 일 ({flatTasks.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActionTab('schedules')}
                  className={`px-2 py-1 text-[10px] rounded ${
                    actionTab === 'schedules'
                      ? 'font-bold bg-white text-neutral-900 shadow-sm'
                      : 'font-medium text-neutral-500 hover:text-neutral-900'
                  }`}
                >
                  일정 ({todaySchedulesOnly.length})
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto pr-2 space-y-2">
              {actionTab === 'tasks' ? (
                flatTasks.length === 0 ? (
                  <p className="text-sm text-neutral-400 text-center py-8">할 일이 없습니다.</p>
                ) : (
                  flatTasks.map(({ action, item }) => {
                    const Icon = getActionIcon(action.type);
                    const colorClass = getActionColor(action.type);
                    const urgent = (item.daysOverdue ?? 0) > 0;
                    return (
                      <button
                        key={`${action.type}-${item.id}`}
                        type="button"
                        onClick={() => router.push(item.link)}
                        className="w-full p-3 bg-[#FCFCFC] border border-neutral-200 rounded-lg hover:border-neutral-400 cursor-pointer transition-colors flex items-center justify-between text-left"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-md ${colorClass} flex items-center justify-center shrink-0`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-xs font-bold text-neutral-900 truncate">{action.title}</h3>
                            <p className="text-[10px] text-neutral-500 truncate">
                              {item.name}
                              {item.position ? ` · ${item.position}` : ''}
                            </p>
                          </div>
                        </div>
                        {urgent && (
                          <span className="text-[10px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded shrink-0">
                            긴급</span>
                        )}
                      </button>
                    );
                  })
                )
              ) : todaySchedulesOnly.length === 0 ? (
                <p className="text-sm text-neutral-400 text-center py-8">오늘 일정이 없습니다.</p>
              ) : (
                todaySchedulesOnly.map((schedule) => (
                  <button
                    key={schedule.id}
                    type="button"
                    onClick={() => router.push(`/candidates/${schedule.candidateId}`)}
                    className="w-full p-3 bg-[#FCFCFC] border border-neutral-200 rounded-lg hover:border-neutral-400 cursor-pointer transition-colors flex items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-xs font-bold text-neutral-900 truncate">
                          {getInterviewTypeText(schedule.interviewType)} · {formatTime(schedule.scheduledAt)}
                        </h3>
                        <p className="text-[10px] text-neutral-500 truncate">
                          {schedule.candidateName} · {schedule.position}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-neutral-500 shrink-0">
                      {schedule.durationMinutes}분
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-neutral-200 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.05)] flex flex-col">
            <div className="flex items-center justify-between mb-8 shrink-0">
              <h2 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">채용 퍼널</h2>
              <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">
                최종 전환율 {finalConversionPct}%
              </span>
            </div>
            <div className="flex-1 space-y-6 flex flex-col justify-center">
              {funnelRows.map((row, i) => (
                <div key={row.key}>
                  <div className="flex justify-between items-end mb-1">
                    <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                      {row.label}
                    </span>
                    <span className="text-sm font-extrabold text-neutral-900">
                      {row.count}{' '}
                      {row.convLabel != null && (
                        <span className="text-[10px] font-medium text-neutral-400 ml-1">{row.convLabel}%</span>
                      )}
                    </span>
                  </div>
                  <div className="h-4 bg-neutral-100 rounded-sm overflow-hidden relative w-full">
                    <div
                      className={`absolute top-0 left-0 h-full rounded-sm ${funnelBarColors[i] ?? 'bg-neutral-800'}`}
                      style={{ width: `${row.barWidthPct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <StageLeadTimeCard stages={leadStages} totalDays={leadTotal} summaryLine={leadSummary} />
        </div>
      </div>
    </div>
  );
}
