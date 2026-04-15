import { getDashboardStats, getPendingActions, getTodaySchedules, getPositionStatus } from '@/api/queries/dashboard';
import { getHiringFunnel, getAnalyticsStats } from '@/api/queries/analytics';
import { getDashboardInsight } from '@/api/actions/dashboard';
import { OverviewClient } from './OverviewClient';

export default async function OverviewPage() {
  // 데이터 조회 (에러 처리 포함)
  const statsResult = await getDashboardStats();
  const analyticsStatsResult = await getAnalyticsStats();
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

  const analyticsStats = analyticsStatsResult.data;
  const pendingActions = pendingActionsResult.data || [];
  const todaySchedules = todaySchedulesResult.data || [];
  const positionStatus = positionStatusResult.data || [];
  const hiringFunnel = hiringFunnelResult.data || [];

  // AI 인사이트 메시지 생성
  console.log('🎯 [OverviewPage] AI 인사이트 생성 시작...');
  let aiInsight: string | null = null;
  try {
    const insightResult = await getDashboardInsight();
    
    console.log('📦 [OverviewPage] getDashboardInsight 결과:');
    console.log('   - hasData:', !!insightResult.data);
    console.log('   - data 타입:', typeof insightResult.data);
    console.log('   - data 값:', insightResult.data);
    console.log('   - data 길이:', insightResult.data?.length || 0);
    console.log('   - hasError:', !!insightResult.error);
    console.log('   - error:', insightResult.error);
    
    if (insightResult.data && insightResult.data.trim().length > 0) {
      // AI 인사이트가 정상적으로 생성된 경우
      aiInsight = insightResult.data;
      console.log('✅ [OverviewPage] AI 인사이트 생성 성공');
      console.log('   - 최종 aiInsight:', aiInsight);
      console.log('   - aiInsight 길이:', aiInsight.length);
    } else if (insightResult.error) {
      // 에러가 발생한 경우
      console.error('❌ [OverviewPage] AI 인사이트 생성 실패');
      console.error('   - 에러 메시지:', insightResult.error);
      console.warn('   - fallback 인사말을 표시합니다.');
      aiInsight = null; // null로 두어 fallback 인사말 표시
    } else {
      // 데이터가 없거나 빈 문자열인 경우
      console.warn('⚠️ [OverviewPage] AI 인사이트 결과가 없습니다.');
      console.warn('   - data:', insightResult.data);
      console.warn('   - data 타입:', typeof insightResult.data);
      console.warn('   - data가 빈 문자열인가?', insightResult.data === '');
      console.warn('   - data가 null인가?', insightResult.data === null);
      console.warn('   - data가 undefined인가?', insightResult.data === undefined);
      console.warn('   - fallback 인사말을 표시합니다.');
      aiInsight = null; // null로 두어 fallback 인사말 표시
    }
  } catch (error) {
    console.error('❌ [OverviewPage] AI 인사이트 생성 중 예외 발생');
    console.error('   - 에러 타입:', error?.constructor?.name || typeof error);
    if (error instanceof Error) {
      console.error('   - 에러 메시지:', error.message);
      console.error('   - 에러 스택:', error.stack);
    } else {
      console.error('   - 알 수 없는 에러:', error);
    }
    console.warn('   - fallback 인사말을 표시합니다.');
    aiInsight = null; // null로 두어 fallback 인사말 표시
  }
  
  console.log('🏁 [OverviewPage] AI 인사이트 처리 완료');
  console.log('   - 최종 aiInsight 값:', aiInsight);
  console.log('   - aiInsight가 null인가?', aiInsight === null);

  // 에러가 발생한 경우 콘솔에 로그 출력 (개발 환경)
  if (statsResult.error) {
    console.error('대시보드 통계 조회 실패:', statsResult.error);
  }
  if (analyticsStatsResult.error) {
    console.error('분석 요약 조회 실패:', analyticsStatsResult.error);
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
      pendingActions={pendingActions}
      todaySchedules={todaySchedules}
      positionStatus={positionStatus}
      hiringFunnel={hiringFunnel}
      aiInsight={aiInsight}
      confirmedHiresCount={analyticsStats?.confirmedHiresCount ?? 0}
      averageTimeToHireDays={analyticsStats?.avgTimeToHire?.value ?? null}
      timeToHireChangeDays={analyticsStats?.avgTimeToHire?.change ?? null}
    />
  );
}
