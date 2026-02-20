'use client';

import { BarChart3, Users, Briefcase, CheckCircle2, Clock, TrendingUp } from 'lucide-react';

interface AnalyticsClientProps {
  stats: {
    totalCandidates: number;
    activeJobs: number;
    interviewsScheduled: number;
    offersMade: number;
  };
  candidateStats: {
    total: number;
    byStatus: Record<string, number>;
    byStage: Record<string, number>;
  };
}

export function AnalyticsClient({ stats, candidateStats }: AnalyticsClientProps) {
  return (
    <div className="h-full overflow-auto">
      <div className="px-8 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Analytics</h1>
          <p className="text-gray-600">채용 데이터를 분석하고 인사이트를 확인하세요.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <Users className="text-white" size={24} />
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">{stats.totalCandidates}</div>
            <div className="text-sm text-gray-600">Total Candidates</div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                <Briefcase className="text-white" size={24} />
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">{stats.activeJobs}</div>
            <div className="text-sm text-gray-600">Active Jobs</div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                <Clock className="text-white" size={24} />
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">{stats.interviewsScheduled}</div>
            <div className="text-sm text-gray-600">Interviews Scheduled</div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                <CheckCircle2 className="text-white" size={24} />
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">{stats.offersMade}</div>
            <div className="text-sm text-gray-600">Offers Made</div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Status Distribution */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <BarChart3 size={20} />
              후보자 상태 분포
            </h2>
            <div className="space-y-3">
              {candidateStats.byStatus && Object.keys(candidateStats.byStatus).length > 0 ? (
                Object.entries(candidateStats.byStatus).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 capitalize">{status}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-brand-main h-2 rounded-full"
                          style={{
                            width: `${candidateStats.total > 0 ? (count / candidateStats.total) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-gray-900 w-12 text-right">{count}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">데이터가 없습니다.</p>
              )}
            </div>
          </div>

          {/* Stage Distribution */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp size={20} />
              단계별 분포
            </h2>
            <div className="space-y-3">
              {candidateStats.byStage && Object.keys(candidateStats.byStage).length > 0 ? (
                Object.entries(candidateStats.byStage).map(([stage, count]) => (
                  <div key={stage} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">{stage}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-brand-main h-2 rounded-full"
                          style={{
                            width: `${candidateStats.total > 0 ? (count / candidateStats.total) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-gray-900 w-12 text-right">{count}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">데이터가 없습니다.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
