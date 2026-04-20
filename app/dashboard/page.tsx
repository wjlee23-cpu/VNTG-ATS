import { getDashboardStats, getRecentActivity, getTopCandidates, getPendingActions, getTodaySchedules, getPositionStatus } from '@/api/queries/dashboard';
import { getHiringFunnel } from '@/api/queries/analytics';
import { OverviewClient } from '@/app/(dashboard)/OverviewClient';
import { ensureUserExists } from '@/api/actions/auth';
import { checkDatabaseData } from '@/api/queries/debug';

export default async function DashboardPage() {
  // 사용자가 users 테이블에 없으면 자동으로 생성
  await ensureUserExists();

  // 디버깅: 데이터베이스에 있는 모든 데이터 확인 (개발 환경에서만)
  if (process.env.NODE_ENV === 'development') {
    try {
      const debugResult = await checkDatabaseData();
      if (debugResult.data) {
        console.log('📊 데이터베이스 데이터 확인:', {
          현재사용자: {
            organizationId: debugResult.data.currentUser.organizationId,
            role: debugResult.data.currentUser.role,
          },
          데이터개수: debugResult.data.counts,
        });
      }
    } catch (error) {
      console.error('데이터 확인 실패:', error);
    }
  }

  // 데이터 조회 (에러 처리 포함)
  // ✅ 체감 속도 개선: 대시보드 쿼리는 서로 의존하지 않으므로 병렬로 요청합니다.
  const [
    statsResult,
    recentActivityResult,
    topCandidatesResult,
    pendingActionsResult,
    todaySchedulesResult,
    positionStatusResult,
    hiringFunnelResult,
  ] = await Promise.all([
    getDashboardStats(),
    getRecentActivity(),
    getTopCandidates(1), // AI 추천용으로 1개만
    getPendingActions(),
    getTodaySchedules(),
    getPositionStatus(),
    getHiringFunnel(),
  ]);

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

  // ✅ 체감 속도 개선: AI 인사이트는 초기 화면 렌더링과 분리합니다.
  // - 서버에서 기다리면 메뉴 이동 체감이 크게 느려집니다.
  // - 클라이언트에서 백그라운드로 로드하여 표시합니다.
  const aiInsight: string | null = null;

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
      aiInsight={aiInsight}
    />
  );
}
