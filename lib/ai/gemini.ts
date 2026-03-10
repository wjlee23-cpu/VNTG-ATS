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

    // 우선순위 기반 메시지 타입 결정
    let messagePriority = 'general';
    if (dashboardData.urgentActions > 0) {
      messagePriority = 'urgent';
    } else if (dashboardData.todaySchedules >= 3) {
      messagePriority = 'schedule';
    } else if (dashboardData.stats.hiringCompleted >= 5) {
      messagePriority = 'achievement';
    } else if (dashboardData.stats.newApplications >= 5) {
      messagePriority = 'trend';
    }

    // 프롬프트 생성
    const prompt = `당신은 채용 관리 대시보드의 AI 어시스턴트입니다. 사용자의 채용 현황을 분석하여 실용적이고 유의미한 인사이트를 한 문장으로 제공해주세요.

현재 채용 현황:
- 신규 지원: ${dashboardData.stats.newApplications}명
- 면접 진행 중: ${dashboardData.stats.interviewsInProgress}명
- 오퍼 발송: ${dashboardData.stats.offersSent}건
- 채용 완료: ${dashboardData.stats.hiringCompleted}명
- 오늘 일정: ${dashboardData.todaySchedules}건
- 긴급 액션 필요: ${dashboardData.urgentActions}건
- 진행 중인 포지션: ${dashboardData.positionCount}개
- 최근 활동: ${dashboardData.recentActivityCount}건

메시지 우선순위: ${messagePriority === 'urgent' ? '긴급 액션' : messagePriority === 'schedule' ? '일정 관리' : messagePriority === 'achievement' ? '성과' : messagePriority === 'trend' ? '트렌드' : '일반'}

작성 규칙:
1. 정확히 한 문장으로 작성 (70자 이내)
2. 실용적이고 구체적인 액션 아이템이나 인사이트를 제공
3. 자연스러운 한국어 대화체 사용 (어색한 표현 절대 금지)
4. "큰 성과를 내셨고", "~하셨네요" 같은 어색한 존댓말 표현 사용 금지
5. 통계를 단순 나열하지 말고, 그 의미나 다음 액션을 제시
6. 이모지 사용 금지
7. 격려보다는 실용적인 정보 제공에 집중

메시지 타입별 예시:

[긴급 액션 우선순위]
- "면접 진행 중인 후보자 ${dashboardData.stats.interviewsInProgress}명 중 피드백 대기 항목이 있습니다. 확인해보세요."
- "긴급 액션이 필요한 항목이 ${dashboardData.urgentActions}건 있습니다. 우선순위를 정해 처리하세요."

[일정 관리 우선순위]
- "오늘 면접 ${dashboardData.todaySchedules}건이 예정되어 있습니다. 준비 상태를 확인하세요."
- "면접 일정이 ${dashboardData.todaySchedules}건으로 많습니다. 면접관과 시간을 조율하세요."

[성과 우선순위]
- "이번 주 채용 완료 ${dashboardData.stats.hiringCompleted}건으로 목표 달성률이 높습니다."
- "채용 완료 ${dashboardData.stats.hiringCompleted}건을 달성했습니다. 다음 포지션 채용을 준비하세요."

[트렌드 우선순위]
- "신규 지원 ${dashboardData.stats.newApplications}명이 들어왔습니다. 서류 검토에 집중하세요."
- "신규 지원이 ${dashboardData.stats.newApplications}명으로 증가했습니다. 우수 후보자 선별에 시간을 투자하세요."

[일반]
- "면접 진행 중인 후보자가 ${dashboardData.stats.interviewsInProgress}명입니다. 피드백을 정리하세요."
- "오퍼 발송 ${dashboardData.stats.offersSent}건 중 수락 여부를 확인하세요."

위 규칙과 예시를 참고하여, 현재 데이터에 맞는 실용적이고 자연스러운 인사이트 메시지를 생성해주세요:`;

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
 * 실용적이고 구체적인 액션 아이템을 제공하는 메시지로 생성
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
  // 우선순위: 긴급 액션 > 오늘 일정 > 신규 지원 > 면접 진행 > 오퍼 발송 > 채용 완료
  if (dashboardData.urgentActions > 0) {
    return `긴급 액션이 필요한 항목이 ${dashboardData.urgentActions}건 있습니다. 우선순위를 확인하세요.`;
  }
  if (dashboardData.todaySchedules > 0) {
    return `오늘 면접 ${dashboardData.todaySchedules}건이 예정되어 있습니다. 준비 상태를 확인하세요.`;
  }
  if (dashboardData.stats.newApplications > 0) {
    return `신규 지원 ${dashboardData.stats.newApplications}명이 들어왔습니다. 서류 검토에 집중하세요.`;
  }
  if (dashboardData.stats.interviewsInProgress > 0) {
    return `면접 진행 중인 후보자가 ${dashboardData.stats.interviewsInProgress}명입니다. 피드백을 정리하세요.`;
  }
  if (dashboardData.stats.offersSent > 0) {
    return `오퍼 발송 ${dashboardData.stats.offersSent}건 중 수락 여부를 확인하세요.`;
  }
  if (dashboardData.stats.hiringCompleted > 0) {
    return `채용 완료 ${dashboardData.stats.hiringCompleted}건을 달성했습니다. 다음 포지션 채용을 준비하세요.`;
  }
  
  // 데이터가 없으면 실용적인 안내 메시지
  return '채용 공고를 등록하고 후보자를 모집해보세요.';
}
