import { getDashboardStats } from '@/api/queries/dashboard';
import { getCandidateStats } from '@/api/queries/candidates';
import { AnalyticsClient } from './AnalyticsClient';

export default async function AnalyticsPage() {
  const statsResult = await getDashboardStats();
  const candidateStatsResult = await getCandidateStats();
  
  const stats = statsResult.data || {
    totalCandidates: 0,
    activeJobs: 0,
    interviewsScheduled: 0,
    offersMade: 0,
  };
  
  const candidateStats = candidateStatsResult.data || {
    total: 0,
    byStatus: {},
    byStage: {},
  };

  return (
    <AnalyticsClient 
      stats={stats}
      candidateStats={candidateStats}
    />
  );
}
