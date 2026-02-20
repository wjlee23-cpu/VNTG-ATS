import { getDashboardStats, getRecentActivity, getTopCandidates } from '@/api/queries/dashboard';
import { OverviewClient } from './OverviewClient';

export default async function OverviewPage() {
  // 데이터 조회 (에러 처리 포함)
  const statsResult = await getDashboardStats();
  const recentActivityResult = await getRecentActivity();
  const topCandidatesResult = await getTopCandidates();

  // 기본값 설정 (에러 발생 시 빈 데이터 사용)
  const stats = statsResult.data || {
    totalCandidates: 0,
    activeJobs: 0,
    interviewsScheduled: 0,
    offersMade: 0,
  };

  const recentActivity = recentActivityResult.data || [];
  const topCandidates = topCandidatesResult.data || [];

  // 에러가 발생한 경우 콘솔에 로그 출력 (개발 환경)
  if (statsResult.error) {
    console.error('대시보드 통계 조회 실패:', statsResult.error);
  }
  if (recentActivityResult.error) {
    console.error('최근 활동 조회 실패:', recentActivityResult.error);
  }
  if (topCandidatesResult.error) {
    console.error('상위 후보자 조회 실패:', topCandidatesResult.error);
  }

  return (
    <OverviewClient 
      stats={stats}
      recentActivity={recentActivity}
      topCandidates={topCandidates}
    />
  );
}
