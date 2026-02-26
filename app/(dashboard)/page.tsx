import { getDashboardStats, getRecentActivity, getTopCandidates, getPendingActions, getTodaySchedules, getPositionStatus } from '@/api/queries/dashboard';
import { getHiringFunnel } from '@/api/queries/analytics';
import { OverviewClient } from './OverviewClient';

export default async function OverviewPage() {
  // 데이터 조회 (에러 처리 포함)
  const statsResult = await getDashboardStats();
  const recentActivityResult = await getRecentActivity();
  const topCandidatesResult = await getTopCandidates(1); // AI 추천용으로 1개만
  const pendingActionsResult = await getPendingActions();
  const todaySchedulesResult = await getTodaySchedules();
  const positionStatusResult = await getPositionStatus();
  const hiringFunnelResult = await getHiringFunnel();

  // 기본값 설정 (에러 발생 시 빈 데이터 사용)
  const stats = statsResult.data || {
    newApplications: 0,
    interviewsInProgress: 0,
    offersSent: 0,
    hiringCompleted: 0,
  };

  const recentActivity = recentActivityResult.data || [];
  const topCandidates = topCandidatesResult.data || [];
  const pendingActions = pendingActionsResult.data || [];
  const todaySchedules = todaySchedulesResult.data || [];
  const positionStatus = positionStatusResult.data || [];
  const hiringFunnel = hiringFunnelResult.data || [];

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
  if (pendingActionsResult.error) {
    console.error('액션 필요 항목 조회 실패:', pendingActionsResult.error);
  }
  if (todaySchedulesResult.error) {
    console.error('오늘 일정 조회 실패:', todaySchedulesResult.error);
  }
  if (positionStatusResult.error) {
    console.error('포지션 현황 조회 실패:', positionStatusResult.error);
  }
  if (hiringFunnelResult.error) {
    console.error('채용 퍼널 조회 실패:', hiringFunnelResult.error);
  }

  return (
    <OverviewClient 
      stats={stats}
      recentActivity={recentActivity}
      topCandidates={topCandidates}
      pendingActions={pendingActions}
      todaySchedules={todaySchedules}
      positionStatus={positionStatus}
      hiringFunnel={hiringFunnel}
    />
  );
}
