import { getDashboardStats, getRecentActivity, getTopCandidates } from '@/api/queries/dashboard';
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
