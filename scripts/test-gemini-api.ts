/**
 * Gemini API Key 테스트 스크립트
 * 환경변수 GOOGLE_GEMINI_API_KEY가 정상적으로 작동하는지 확인합니다.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';

// .env 파일 로드
dotenv.config({ path: '.env' });

async function testGeminiAPI() {
  console.log('🔍 Gemini API Key 테스트 시작...\n');

  // 1. 환경변수 확인
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  
  if (!apiKey) {
    console.error('❌ GOOGLE_GEMINI_API_KEY가 설정되지 않았습니다.');
    console.log('\n.env 파일에 다음을 추가하세요:');
    console.log('GOOGLE_GEMINI_API_KEY=your_api_key_here');
    process.exit(1);
  }

  console.log('✅ 환경변수 확인 완료');
  console.log(`   API Key: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}\n`);

  try {
    // 2. Gemini API 클라이언트 생성
    console.log('📡 Gemini API 클라이언트 생성 중...');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    console.log('✅ 클라이언트 생성 완료\n');

    // 3. 간단한 테스트 프롬프트로 API 호출
    console.log('🚀 API 호출 테스트 중...');
    const prompt = '안녕하세요. 간단히 인사만 해주세요. 한 문장으로 답변해주세요.';
    
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text().trim();

    console.log('✅ API 호출 성공!\n');
    console.log('📝 응답 내용:');
    console.log(`   "${text}"\n`);
    console.log('🎉 Gemini API가 정상적으로 작동합니다!');

  } catch (error: any) {
    console.error('❌ API 호출 실패:\n');
    
    if (error.message) {
      console.error(`   에러 메시지: ${error.message}`);
    }
    
    if (error.status) {
      console.error(`   HTTP 상태 코드: ${error.status}`);
    }

    // 일반적인 에러 원인 안내
    if (error.message?.includes('API_KEY')) {
      console.error('\n💡 해결 방법:');
      console.error('   - API Key가 유효한지 확인하세요.');
      console.error('   - Google AI Studio에서 API Key를 재생성해보세요.');
    } else if (error.message?.includes('quota') || error.message?.includes('rate limit')) {
      console.error('\n💡 해결 방법:');
      console.error('   - API 사용량 한도를 확인하세요.');
      console.error('   - Google Cloud Console에서 할당량을 확인하세요.');
    } else {
      console.error('\n💡 전체 에러 정보:');
      console.error(error);
    }

    process.exit(1);
  }
}

// 스크립트 실행
testGeminiAPI().catch((error) => {
  console.error('예상치 못한 오류:', error);
  process.exit(1);
});
