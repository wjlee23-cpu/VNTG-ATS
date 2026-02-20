import { getAnalyticsStats, getApplicationTrends, getHiringFunnel } from '@/api/queries/analytics';
import { AnalyticsClient } from './AnalyticsClient';

export default async function AnalyticsPage() {
  const statsResult = await getAnalyticsStats();
  const trendsResult = await getApplicationTrends(30);
  const funnelResult = await getHiringFunnel();
  
  const stats = statsResult.data || {
    totalApplications: { value: 0, change: 0, isPositive: true },
    avgTimeToHire: { value: 0, change: 0, isPositive: true },
    offerAcceptRate: { value: 0, change: 0, isPositive: true },
    costPerHire: { value: 0, change: 0, isPositive: true },
  };
  
  const trends = trendsResult.data || [];
  const funnel = funnelResult.data || [];

  return (
    <AnalyticsClient 
      stats={stats}
      trends={trends}
      funnel={funnel}
    />
  );
}
