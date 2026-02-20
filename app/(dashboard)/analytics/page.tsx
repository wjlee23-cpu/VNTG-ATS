import { getAnalyticsStats, getApplicationTrends, getHiringFunnel } from '@/api/queries/analytics';
import { AnalyticsClient } from './AnalyticsClient';

export default async function AnalyticsPage() {
  const statsResult = await getAnalyticsStats();
  const trendsResult = await getApplicationTrends(30);
  const funnelResult = await getHiringFunnel();
  
  // 에러가 발생한 경우 콘솔에 로그 출력 (개발 환경)
  if (statsResult.error) {
    console.error('분석 통계 조회 실패:', statsResult.error);
  }
  if (trendsResult.error) {
    console.error('지원 추이 조회 실패:', trendsResult.error);
  }
  if (funnelResult.error) {
    console.error('채용 퍼널 조회 실패:', funnelResult.error);
  }
  
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
