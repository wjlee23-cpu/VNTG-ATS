/**
 * Gemini API에서 사용 가능한 모델 목록 조회
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

async function listModels() {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  
  if (!apiKey) {
    console.error('❌ GOOGLE_GEMINI_API_KEY가 설정되지 않았습니다.');
    process.exit(1);
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // 사용 가능한 모델 목록 조회
    console.log('📋 사용 가능한 모델 목록 조회 중...\n');
    
    // 직접 API 호출로 모델 목록 가져오기
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + apiKey);
    const data = await response.json();
    
    if (data.models) {
      console.log('✅ 사용 가능한 모델:\n');
      data.models.forEach((model: any) => {
        console.log(`   - ${model.name}`);
        if (model.supportedGenerationMethods) {
          console.log(`     지원 메서드: ${model.supportedGenerationMethods.join(', ')}`);
        }
        console.log('');
      });
    } else {
      console.log('❌ 모델 목록을 가져올 수 없습니다.');
      console.log('응답:', JSON.stringify(data, null, 2));
    }
  } catch (error: any) {
    console.error('❌ 오류 발생:', error.message);
    console.error(error);
  }
}

listModels();
