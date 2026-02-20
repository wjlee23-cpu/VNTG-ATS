/**
 * Supabase Management API를 통한 jd_requests 테이블 마이그레이션 적용
 * SUPABASE_ACCESS_TOKEN을 사용하여 Management API로 직접 적용합니다.
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { readFileSync } from 'fs';

// .env 파일에서 환경 변수 로드
config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAccessToken = process.env.SUPABASE_ACCESS_TOKEN!;
const supabaseProjectId = process.env.SUPABASE_PROJECT_ID!;

if (!supabaseUrl || !supabaseAccessToken || !supabaseProjectId) {
  console.error('❌ 환경 변수가 설정되지 않았습니다.');
  console.error('NEXT_PUBLIC_SUPABASE_URL, SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_ID를 확인하세요.');
  process.exit(1);
}

console.log('🚀 jd_requests 테이블 마이그레이션 적용 시작...\n');
console.log(`🔗 프로젝트: ${supabaseProjectId}\n`);

// SQL 파일 읽기
const migrationSQL = readFileSync(
  resolve(process.cwd(), 'scripts/apply-jd-requests-migration.sql'),
  'utf-8'
);

async function executeSQLViaManagementAPI() {
  console.log('📄 마이그레이션 SQL 파일 로드 완료\n');
  console.log('📝 Supabase Management API를 통한 SQL 실행 시도...\n');
  
  // Supabase Management API 엔드포인트
  // 참고: Management API는 프로젝트별로 다른 엔드포인트를 사용합니다
  const managementApiUrl = `https://api.supabase.com/v1/projects/${supabaseProjectId}/database/query`;
  
  try {
    const response = await fetch(managementApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAccessToken}`,
      },
      body: JSON.stringify({
        query: migrationSQL,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Management API 호출 실패');
      console.error(`   상태 코드: ${response.status}`);
      console.error(`   응답: ${errorText}\n`);
      
      // 다른 엔드포인트 시도
      console.log('📝 대안 방법 시도 중...\n');
      return await tryAlternativeMethods();
    }
    
    const result = await response.json();
    console.log('✅ SQL 실행 성공!\n');
    console.log('결과:', result);
    return true;
  } catch (error: any) {
    console.error('❌ 오류 발생:', error.message);
    return await tryAlternativeMethods();
  }
}

async function tryAlternativeMethods() {
  // 방법 1: Database API를 통한 직접 실행
  const dbApiUrl = `https://api.supabase.com/v1/projects/${supabaseProjectId}/database/rest/v1/rpc/exec_sql`;
  
  try {
    const response = await fetch(dbApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAccessToken}`,
        'apikey': supabaseAccessToken,
      },
      body: JSON.stringify({
        sql: migrationSQL,
      }),
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ 대안 방법으로 SQL 실행 성공!\n');
      console.log('결과:', result);
      return true;
    }
  } catch (error: any) {
    console.error('❌ 대안 방법도 실패:', error.message);
  }
  
  // 모든 방법이 실패한 경우
  console.log('\n⚠️  Supabase Management API를 통한 직접 실행이 불가능합니다.');
  console.log('📋 Supabase 대시보드 > SQL Editor에서 다음 SQL을 실행하세요:\n');
  console.log('='.repeat(70));
  console.log(migrationSQL);
  console.log('='.repeat(70));
  console.log('\n');
  
  return false;
}

async function main() {
  const success = await executeSQLViaManagementAPI();
  
  if (success) {
    console.log('✨ 마이그레이션이 성공적으로 적용되었습니다!\n');
    console.log('💡 Supabase 스키마 캐시를 새로고침하세요:');
    console.log('   Settings > API > Refresh Schema Cache\n');
  } else {
    console.log('💡 수동 실행이 필요합니다. 위의 SQL을 Supabase 대시보드에서 실행하세요.\n');
  }
}

main().catch((error) => {
  console.error('❌ 오류 발생:', error);
  process.exit(1);
});
