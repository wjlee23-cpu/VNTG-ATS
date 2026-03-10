'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Gemini API를 사용하여 대시보드 인사이트 메시지를 생성합니다.
 * @param dashboardData 사용자의 대시보드 데이터
 * @returns 생성된 인사이트 메시지 (한 문장)
 */
export async function generateDashboardInsight(dashboardData: {
  stats: {
    newApplications: number;
    interviewsInProgress: number;
    offersSent: number;
    hiringCompleted: number;
  };
  todaySchedules: number;
  urgentActions: number;
  positionCount: number;
  recentActivityCount: number;
}): Promise<string> {
  try {
    // 환경변수 확인 (강화)
    console.log('🔑 [generateDashboardInsight] 환경변수 확인 중...');
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    
    if (!apiKey) {
      console.error('❌ [generateDashboardInsight] GOOGLE_GEMINI_API_KEY가 설정되지 않았습니다.');
      console.error('   - process.env.GOOGLE_GEMINI_API_KEY:', process.env.GOOGLE_GEMINI_API_KEY);
      console.error('   - 사용 가능한 환경변수 키:', Object.keys(process.env).filter(key => key.includes('GEMINI') || key.includes('GOOGLE')));
      console.warn('⚠️ 기본 메시지를 반환합니다.');
      return getDefaultMessage(dashboardData);
    }

    // API 키 유효성 검증 (최소 길이 확인)
    if (apiKey.length < 20) {
      console.error('❌ [generateDashboardInsight] API 키가 너무 짧습니다. 길이:', apiKey.length);
      console.warn('⚠️ 기본 메시지를 반환합니다.');
      return getDefaultMessage(dashboardData);
    }

    console.log('✅ [generateDashboardInsight] 환경변수 확인 완료');
    console.log('   - API 키 길이:', apiKey.length);
    console.log('   - API 키 앞 10자:', apiKey.substring(0, 10) + '...');
    console.log('🔍 [generateDashboardInsight] Gemini API 호출 시작...');
    
    // Gemini API 클라이언트 생성
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    console.log('✅ [generateDashboardInsight] Gemini API 클라이언트 생성 완료');

    // 프롬프트 생성
    const prompt = `당신은 채용 관리 대시보드의 AI 어시스턴트입니다. 다음 사용자의 채용 현황 데이터를 분석하여 한 문장의 간단하고 긍정적인 인사이트를 생성해주세요.

현재 채용 현황:
- 신규 지원: ${dashboardData.stats.newApplications}명
- 면접 진행 중: ${dashboardData.stats.interviewsInProgress}명
- 오퍼 발송: ${dashboardData.stats.offersSent}건
- 채용 완료: ${dashboardData.stats.hiringCompleted}명
- 오늘 일정: ${dashboardData.todaySchedules}건
- 긴급 액션 필요: ${dashboardData.urgentActions}건
- 진행 중인 포지션: ${dashboardData.positionCount}개
- 최근 활동: ${dashboardData.recentActivityCount}건

규칙:
1. 정확히 한 문장으로 작성 (60자 이내)
2. 가장 중요한 통계나 상황 1-2개만 언급
3. 긍정적이고 동기부여적인 톤 유지
4. 한국어로 작성
5. 구체적인 숫자나 상황을 포함
6. 이모지 사용 금지

예시:
- "신규 지원 5명이 들어왔어요. 오늘 면접 3건을 잘 준비해보세요!"
- "면접 진행 중인 후보자가 8명이에요. 오늘 일정 2건을 확인해보세요."
- "채용 완료가 3건이나 되었네요! 계속해서 좋은 인재를 찾아보세요."

인사이트 메시지를 생성해주세요:`;

    // API 호출
    console.log('📡 [generateDashboardInsight] API 요청 전송 중...');
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text().trim();

    console.log('✅ [generateDashboardInsight] Gemini API 호출 성공');
    console.log('   - 응답 길이:', text.length);
    console.log('   - 응답 내용 (원본):', text);

    // 응답이 너무 길면 잘라내기
    if (text.length > 100) {
      const truncated = text.substring(0, 100) + '...';
      console.log('📝 [generateDashboardInsight] 응답이 길어서 잘랐습니다:', truncated);
      return truncated;
    }

    if (!text || text.length === 0) {
      console.error('❌ [generateDashboardInsight] Gemini API 응답이 비어있습니다.');
      console.warn('⚠️ 기본 메시지를 반환합니다.');
      return getDefaultMessage(dashboardData);
    }

    console.log('✅ [generateDashboardInsight] 최종 인사이트 생성 완료:', text);
    return text;
  } catch (error) {
    console.error('❌ [generateDashboardInsight] Gemini API 호출 실패');
    console.error('   - 에러 타입:', error?.constructor?.name || typeof error);
    
    if (error instanceof Error) {
      console.error('   - 에러 메시지:', error.message);
      console.error('   - 에러 이름:', error.name);
      if (error.stack) {
        console.error('   - 에러 스택 (처음 500자):', error.stack.substring(0, 500));
      }
      
      // 특정 에러 타입별 처리
      if (error.message.includes('API_KEY')) {
        console.error('   - 원인: API 키 관련 에러');
      } else if (error.message.includes('quota') || error.message.includes('rate limit')) {
        console.error('   - 원인: API 할당량 초과');
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        console.error('   - 원인: 네트워크 에러');
      }
    } else {
      console.error('   - 알 수 없는 에러:', error);
    }
    
    console.warn('⚠️ 기본 메시지를 반환합니다.');
    return getDefaultMessage(dashboardData);
  }
}

/**
 * 기본 메시지 생성 (API 실패 시 사용)
 */
function getDefaultMessage(dashboardData: {
  stats: {
    newApplications: number;
    interviewsInProgress: number;
    offersSent: number;
    hiringCompleted: number;
  };
  todaySchedules: number;
  urgentActions: number;
}): string {
  // 데이터가 있으면 기본 메시지 생성
  if (dashboardData.stats.newApplications > 0) {
    return `신규 지원 ${dashboardData.stats.newApplications}명이 들어왔어요. 확인해보세요!`;
  }
  if (dashboardData.todaySchedules > 0) {
    return `오늘 면접 ${dashboardData.todaySchedules}건이 예정되어 있어요. 준비하세요!`;
  }
  if (dashboardData.urgentActions > 0) {
    return `긴급 액션이 필요한 항목이 ${dashboardData.urgentActions}건 있어요.`;
  }
  if (dashboardData.stats.interviewsInProgress > 0) {
    return `진행 중인 면접이 ${dashboardData.stats.interviewsInProgress}건 있어요.`;
  }
  
  // 데이터가 없으면 기본 격려 메시지
  return '오늘도 최선을 다하세요!';
}
