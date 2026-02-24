'use client';

import { TrendingUp, Users, Briefcase, CheckCircle2, Clock, Sparkles, ArrowUpRight, ArrowDownRight, Database } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { getUserProfile } from '@/api/queries/auth';
import { seedDummyData } from '@/api/actions/seed';
import { toast } from 'sonner';

interface OverviewClientProps {
  stats: {
    totalCandidates: number;
    activeJobs: number;
    interviewsScheduled: number;
    offersMade: number;
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
}

export function OverviewClient({ stats, recentActivity, topCandidates }: OverviewClientProps) {
  const router = useRouter();
  const [userRole, setUserRole] = useState<'admin' | 'recruiter' | 'interviewer' | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);

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

  const statsData = [
    {
      label: 'Total Candidates',
      value: stats.totalCandidates.toString(),
      change: '+0%',
      trend: 'up' as const,
      icon: Users,
      color: 'blue'
    },
    {
      label: 'Active Jobs',
      value: stats.activeJobs.toString(),
      change: '+0',
      trend: 'up' as const,
      icon: Briefcase,
      color: 'blue'
    },
    {
      label: 'Interviews Scheduled',
      value: stats.interviewsScheduled.toString(),
      change: '+0%',
      trend: 'up' as const,
      icon: Clock,
      color: 'orange'
    },
    {
      label: 'Offers Made',
      value: stats.offersMade.toString(),
      change: '+0',
      trend: 'up' as const,
      icon: CheckCircle2,
      color: 'green'
    },
  ];

  const hasData = stats.totalCandidates > 0 || stats.activeJobs > 0;

  return (
    <div className="h-full overflow-auto">
      <div className="px-8 py-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Good morning! 👋</h1>
          <p className="text-muted-foreground">Here's what's happening with your recruitment today.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statsData.map((stat) => {
            const Icon = stat.icon;
            const colorClasses = {
              blue: 'from-brand-dark to-brand-main shadow-blue',
              orange: 'from-accent/80 to-accent shadow-accent/20',
              green: 'from-primary/80 to-primary shadow-primary/20',
            };
            return (
              <div
                key={stat.label}
                className="card-modern p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colorClasses[stat.color as keyof typeof colorClasses]} flex items-center justify-center shadow-lg`}>
                    <Icon className="text-white" size={24} />
                  </div>
                  {stat.value !== '0' && (
                    <div className={`flex items-center gap-1 text-sm font-medium ${stat.trend === 'up' ? 'text-primary' : 'text-destructive'}`}>
                      {stat.trend === 'up' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                      {stat.change}
                    </div>
                  )}
                </div>
                <div className="text-3xl font-bold text-foreground mb-1">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            );
          })}
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
                    <Database size={18} />
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* AI Insights */}
            <div className="lg:col-span-2">
              <div className="bg-gradient-to-br from-brand-dark to-brand-main rounded-2xl p-6 text-white shadow-2xl shadow-brand-main/20">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles size={24} />
                  <h2 className="text-xl font-bold">AI Insights</h2>
                </div>
                <div className="space-y-4">
                  {topCandidates.length > 0 && (
                    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                          <TrendingUp size={20} />
                        </div>
                        <div>
                          <h3 className="font-semibold mb-1">High Match Candidates</h3>
                          <p className="text-white/80 text-sm">
                            You have {topCandidates.length} candidate{topCandidates.length > 1 ? 's' : ''} with 90%+ match scores waiting for review
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  {stats.interviewsScheduled > 0 && (
                    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                          <Clock size={20} />
                        </div>
                        <div>
                          <h3 className="font-semibold mb-1">Pending Interviews</h3>
                          <p className="text-white/80 text-sm">
                            {stats.interviewsScheduled} candidate{stats.interviewsScheduled > 1 ? 's are' : ' is'} waiting for interview scheduling confirmation
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Activity */}
              <div className="card-modern p-6 mt-6">
                <h2 className="text-lg font-bold text-foreground mb-4">Recent Activity</h2>
                {recentActivity.length > 0 ? (
                  <div className="space-y-4">
                    {recentActivity.map((activity) => (
                      <div key={activity.id} className="flex items-center gap-4 group">
                        <div className="w-2 h-2 rounded-full bg-brand-main" />
                        <div className="flex-1">
                          <p className="text-sm text-foreground">
                            <span className="font-semibold">{activity.candidate}</span>
                            {' '}{activity.action}{' '}
                            <span className="font-semibold">{activity.job}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">{activity.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">최근 활동이 없습니다.</p>
                )}
              </div>
            </div>

            {/* Top Candidates */}
            <div className="card-modern p-6">
              <h2 className="text-lg font-bold text-foreground mb-4">Top Matches</h2>
              {topCandidates.length > 0 ? (
                <div className="space-y-4">
                  {topCandidates.map((candidate, index) => (
                    <div 
                      key={candidate.id} 
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted transition-all cursor-pointer"
                      onClick={() => router.push(`/candidates/${candidate.id}`)}
                    >
                      <div className="relative">
                        <img
                          src={candidate.avatar}
                          alt={candidate.name}
                          className="w-12 h-12 rounded-full"
                        />
                        <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-brand-main text-white text-xs font-bold flex items-center justify-center border-2 border-white">
                          {index + 1}
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-foreground">{candidate.name}</div>
                        <div className="text-xs text-muted-foreground">{candidate.position}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-primary">{candidate.match}</div>
                        <div className="text-xs text-muted-foreground">match</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">매치된 후보자가 없습니다.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
