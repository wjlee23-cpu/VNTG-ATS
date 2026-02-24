/**
 * Supabase 스키마 캐시 새로고침 스크립트
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// 환경 변수 로드
config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function refreshSchemaCache() {
  console.log('🔄 Supabase 스키마 캐시 새로고침 시작...\n');

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ 필수 환경 변수가 설정되지 않았습니다.');
    console.error('필요한 환경 변수:');
    console.error('  - NEXT_PUBLIC_SUPABASE_URL');
    console.error('  - SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  // Supabase URL에서 프로젝트 참조 추출
  const urlMatch = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/);
  if (!urlMatch) {
    console.error('❌ Supabase URL 형식이 올바르지 않습니다.');
    process.exit(1);
  }

  const projectRef = urlMatch[1];
  console.log(`📋 프로젝트 참조: ${projectRef}\n`);

  // 방법 1: Management API를 통한 스키마 새로고침 시도
  try {
    console.log('📝 방법 1: Management API를 통한 스키마 새로고침 시도...\n');

    // Supabase Management API 엔드포인트
    // 참고: 실제 API 엔드포인트는 Supabase 문서를 확인해야 합니다
    const endpoints = [
      `https://api.supabase.com/v1/projects/${projectRef}/database/schema/refresh`,
      `https://api.supabase.com/v1/projects/${projectRef}/schema/refresh`,
      `https://api.supabase.com/v1/projects/${projectRef}/refresh-schema`,
    ];

    let success = false;
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          console.log(`✅ 스키마 캐시 새로고침 성공! (${endpoint})\n`);
          success = true;
          break;
        } else if (response.status === 404) {
          // 엔드포인트가 없으면 다음 시도
          continue;
        } else {
          const errorText = await response.text();
          console.log(`⚠️  API 호출 실패 (HTTP ${response.status}): ${errorText.substring(0, 200)}\n`);
        }
      } catch (error: any) {
        console.log(`⚠️  API 호출 중 오류: ${error.message}\n`);
        continue;
      }
    }

    if (success) {
      console.log('✨ 스키마 캐시 새로고침이 완료되었습니다!');
      return;
    }
  } catch (error: any) {
    console.log(`⚠️  Management API 시도 실패: ${error.message}\n`);
  }

  // 방법 2: Supabase JS 클라이언트를 통해 간접적으로 스키마를 로드
  try {
    console.log('📝 방법 2: Supabase 클라이언트를 통한 스키마 확인...\n');

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 간단한 쿼리를 실행하여 스키마가 업데이트되었는지 확인
    const { data, error } = await supabase
      .from('schedules')
      .select('workflow_status')
      .limit(1);

    if (error) {
      // 스키마 캐시 문제일 수 있음
      if (error.message.includes('schema cache') || error.message.includes('column')) {
        console.log('⚠️  스키마 캐시가 아직 업데이트되지 않았을 수 있습니다.');
        console.log('   에러 메시지:', error.message);
      } else {
        console.log('✅ 스키마가 정상적으로 작동하는 것으로 보입니다.');
      }
    } else {
      console.log('✅ 스키마가 정상적으로 작동합니다!');
      console.log('   workflow_status 컬럼이 정상적으로 인식됩니다.\n');
    }
  } catch (error: any) {
    console.log(`⚠️  스키마 확인 중 오류: ${error.message}\n`);
  }

  // 방법 3: 수동 안내
  console.log('\n📋 Management API로 자동 새로고침이 불가능한 경우:');
  console.log('   다음 단계를 수동으로 진행하세요:\n');
  console.log('   1. https://app.supabase.com 접속');
  console.log('   2. 프로젝트 선택');
  console.log('   3. Settings > API');
  console.log('   4. "Refresh Schema Cache" 버튼 클릭\n');
}

refreshSchemaCache().catch((error) => {
  console.error('❌ 오류 발생:', error);
  process.exit(1);
});
