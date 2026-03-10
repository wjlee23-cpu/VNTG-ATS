'use server';

import { generateDashboardInsight } from '@/lib/ai/gemini';
import { getDashboardStats, getTodaySchedules, getPendingActions, getPositionStatus, getRecentActivity } from '@/api/queries/dashboard';
import { withErrorHandling } from '@/api/utils/errors';

/**
 * 대시보드 데이터를 분석하여 AI 인사이트 메시지를 생성합니다.
 * @returns 생성된 인사이트 메시지 (한 문장)
 */
export async function getDashboardInsight() {
  return withErrorHandling(async () => {
    console.log('🔍 [getDashboardInsight] 시작: 대시보드 데이터 수집 중...');
    
    // 대시보드 데이터 수집
    const [statsResult, todaySchedulesResult, pendingActionsResult, positionStatusResult, recentActivityResult] = await Promise.all([
      getDashboardStats(),
      getTodaySchedules(),
      getPendingActions(),
      getPositionStatus(),
      getRecentActivity(),
    ]);

    // 데이터 수집 결과 로깅
    console.log('📊 [getDashboardInsight] 데이터 수집 결과:');
    console.log('   - statsResult:', statsResult.error ? `에러: ${statsResult.error}` : '성공');
    console.log('   - todaySchedulesResult:', todaySchedulesResult.error ? `에러: ${todaySchedulesResult.error}` : '성공');
    console.log('   - pendingActionsResult:', pendingActionsResult.error ? `에러: ${pendingActionsResult.error}` : '성공');
    console.log('   - positionStatusResult:', positionStatusResult.error ? `에러: ${positionStatusResult.error}` : '성공');
    console.log('   - recentActivityResult:', recentActivityResult.error ? `에러: ${recentActivityResult.error}` : '성공');

    // 기본값 설정
    const stats = statsResult.data || {
      newApplications: 0,
      interviewsInProgress: 0,
      offersSent: 0,
      hiringCompleted: 0,
    };

    const todaySchedules = todaySchedulesResult.data || [];
    const pendingActions = pendingActionsResult.data || [];
    const positionStatus = positionStatusResult.data || [];
    const recentActivity = recentActivityResult.data || [];

    // 긴급 액션 계산
    const urgentActions = pendingActions.reduce((sum, action) => {
      const overdueItems = (action.items || []).filter(item => item.daysOverdue && item.daysOverdue > 0);
      return sum + overdueItems.length;
    }, 0);

    // 오늘 일정 개수 계산
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todaySchedulesCount = todaySchedules.filter(schedule => {
      const scheduleDate = new Date(schedule.scheduledAt);
      return scheduleDate >= today && scheduleDate < tomorrow;
    }).length;

    // 대시보드 데이터 요약 로깅
    console.log('📈 [getDashboardInsight] 대시보드 데이터 요약:');
    console.log('   - 신규 지원:', stats.newApplications);
    console.log('   - 면접 진행:', stats.interviewsInProgress);
    console.log('   - 오퍼 발송:', stats.offersSent);
    console.log('   - 채용 완료:', stats.hiringCompleted);
    console.log('   - 오늘 일정:', todaySchedulesCount);
    console.log('   - 긴급 액션:', urgentActions);
    console.log('   - 포지션 수:', positionStatus.length);
    console.log('   - 최근 활동:', recentActivity.length);

    // Gemini API를 호출하여 인사이트 메시지 생성
    console.log('🚀 [getDashboardInsight] Gemini API 호출 시작...');
    const insight = await generateDashboardInsight({
      stats,
      todaySchedules: todaySchedulesCount,
      urgentActions,
      positionCount: positionStatus.length,
      recentActivityCount: recentActivity.length,
    });

    // 반환값 검증
    if (!insight || typeof insight !== 'string') {
      console.error('❌ [getDashboardInsight] 반환값 검증 실패:', insight);
      throw new Error('AI 인사이트 생성 실패: 유효하지 않은 반환값');
    }

    if (insight.trim().length === 0) {
      console.warn('⚠️ [getDashboardInsight] 반환값이 빈 문자열입니다.');
      throw new Error('AI 인사이트 생성 실패: 빈 문자열 반환');
    }

    console.log('✅ [getDashboardInsight] 성공:', insight);
    console.log('   - 반환값 길이:', insight.length);
    console.log('   - 반환값 타입:', typeof insight);

    return insight;
  });
}
