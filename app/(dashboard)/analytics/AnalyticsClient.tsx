'use client';

import { TrendingUp, TrendingDown, BarChart3, Users, Clock, DollarSign } from 'lucide-react';

interface AnalyticsClientProps {
  stats: {
    totalApplications: { value: number; change: number; isPositive: boolean };
    avgTimeToHire: { value: number; change: number; isPositive: boolean };
    offerAcceptRate: { value: number; change: number; isPositive: boolean };
    costPerHire: { value: number; change: number; isPositive: boolean };
  };
  trends: Array<{ date: string; count: number }>;
  funnel: Array<{ stage: string; count: number }>;
}

export function AnalyticsClient({ stats, trends, funnel }: AnalyticsClientProps) {
  // 트렌드 아이콘
  const TrendIcon = ({ isPositive }: { isPositive: boolean }) => {
    const Icon = isPositive ? TrendingUp : TrendingDown;
    return <Icon size={14} className={isPositive ? 'text-green-600' : 'text-red-600'} />;
  };

  // 트렌드 포맷팅
  const formatTrend = (change: number, isPositive: boolean) => {
    const sign = change > 0 ? '+' : '';
    return `${sign}${change}${change === Math.abs(change) ? '%' : ''}`;
  };

  return (
    <div className="h-full overflow-auto bg-[#FAFAFA]">
      <div className="px-8 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Analytics & Insights</h1>
          <p className="text-gray-600">Track your recruitment performance and trends.</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Applications */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 relative">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-gray-600">Total Applications</div>
              <div className="flex items-center gap-1 text-xs text-green-600">
                <TrendIcon isPositive={stats.totalApplications.isPositive} />
                <span>{formatTrend(stats.totalApplications.change, stats.totalApplications.isPositive)}</span>
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900">
              {stats.totalApplications.value.toLocaleString()}
            </div>
          </div>

          {/* Avg. Time to Hire */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 relative">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-gray-600">Avg. Time to Hire</div>
              <div className="flex items-center gap-1 text-xs text-green-600">
                <TrendIcon isPositive={stats.avgTimeToHire.isPositive} />
                <span>{formatTrend(stats.avgTimeToHire.change, stats.avgTimeToHire.isPositive)}</span>
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900">
              {stats.avgTimeToHire.value} days
            </div>
          </div>

          {/* Offer Accept Rate */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 relative">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-gray-600">Offer Accept Rate</div>
              <div className="flex items-center gap-1 text-xs text-green-600">
                <TrendIcon isPositive={stats.offerAcceptRate.isPositive} />
                <span>{formatTrend(stats.offerAcceptRate.change, stats.offerAcceptRate.isPositive)}</span>
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900">
              {stats.offerAcceptRate.value}%
            </div>
          </div>

          {/* Cost per Hire */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 relative">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-gray-600">Cost per Hire</div>
              <div className="flex items-center gap-1 text-xs text-green-600">
                <TrendIcon isPositive={stats.costPerHire.isPositive} />
                <span>{formatTrend(stats.costPerHire.change, stats.costPerHire.isPositive)}</span>
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900">
              ${stats.costPerHire.value.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Application Trends */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <BarChart3 size={20} />
              Application Trends
            </h2>
            {trends.length > 0 ? (
              <div className="h-64 flex items-end justify-between gap-2">
                {trends.map((trend, index) => {
                  const maxCount = Math.max(...trends.map(t => t.count), 1);
                  const height = (trend.count / maxCount) * 100;
                  return (
                    <div key={index} className="flex-1 flex flex-col items-center gap-2">
                      <div className="w-full bg-gray-200 rounded-t-lg relative" style={{ height: '200px' }}>
                        <div
                          className="absolute bottom-0 w-full bg-blue-600 rounded-t-lg transition-all"
                          style={{ height: `${height}%` }}
                        />
                      </div>
                      <div className="text-xs text-gray-500 text-center transform -rotate-45 origin-top-left whitespace-nowrap">
                        {new Date(trend.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center">
                <div className="text-center">
                  <BarChart3 size={48} className="mx-auto text-gray-400 mb-4" />
                  <p className="text-sm text-gray-500">No data available</p>
                </div>
              </div>
            )}
          </div>

          {/* Hiring Funnel */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp size={20} />
              Hiring Funnel
            </h2>
            {funnel.length > 0 ? (
              <div className="space-y-4">
                {funnel.map((stage, index) => {
                  const maxCount = Math.max(...funnel.map(s => s.count), 1);
                  const width = (stage.count / maxCount) * 100;
                  return (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 font-medium">{stage.stage}</span>
                        <span className="text-gray-900 font-bold">{stage.count}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className="bg-blue-600 h-3 rounded-full transition-all"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center">
                <div className="text-center">
                  <TrendingUp size={48} className="mx-auto text-gray-400 mb-4" />
                  <p className="text-sm text-gray-500">No data available</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
