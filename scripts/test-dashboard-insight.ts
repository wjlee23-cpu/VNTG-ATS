/**
 * 대시보드 인사이트 메시지 생성 테스트
 */

import { generateDashboardInsight } from '../lib/ai/gemini';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

async function testDashboardInsight() {
  console.log('🔍 대시보드 인사이트 메시지 생성 테스트...\n');

  // 테스트용 대시보드 데이터
  const testData = {
    stats: {
      newApplications: 5,
      interviewsInProgress: 8,
      offersSent: 3,
      hiringCompleted: 2,
    },
    todaySchedules: 3,
    urgentActions: 2,
    positionCount: 4,
    recentActivityCount: 10,
  };

  console.log('📊 테스트 데이터:');
  console.log(JSON.stringify(testData, null, 2));
  console.log('');

  try {
    console.log('🚀 Gemini API 호출 중...\n');
    const insight = await generateDashboardInsight(testData);
    
    console.log('✅ 인사이트 메시지 생성 성공!\n');
    console.log('📝 생성된 메시지:');
    console.log(`   "${insight}"\n`);
    console.log(`   길이: ${insight.length}자\n`);
    
  } catch (error: any) {
    console.error('❌ 오류 발생:', error.message);
    console.error(error);
  }
}

testDashboardInsight();
