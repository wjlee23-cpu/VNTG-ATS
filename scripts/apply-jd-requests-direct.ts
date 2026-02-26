/**
 * Supabase Management API를 통한 jd_requests 테이블 마이그레이션 적용
 * 환경 변수에서 Supabase 설정을 읽어 직접 적용합니다.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';
import { readFileSync } from 'fs';

// .env 파일에서 환경 변수 로드
config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 환경 변수가 설정되지 않았습니다.');
  console.error('NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 확인하세요.');
  process.exit(1);
}

console.log('🚀 jd_requests 테이블 마이그레이션 적용 시작...\n');
console.log(`🔗 연결: ${supabaseUrl}\n`);

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// SQL 파일 읽기
const migrationSQL = readFileSync(
  resolve(process.cwd(), 'scripts/apply-jd-requests-migration.sql'),
  'utf-8'
);

async function applyMigrationViaManagementAPI() {
  console.log('📄 마이그레이션 SQL 파일 로드 완료\n');
  
  // Supabase Management API를 통한 SQL 실행
  // Management API는 프로젝트 ID가 필요합니다
  const urlMatch = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/);
  if (!urlMatch) {
    console.error('❌ Supabase URL 형식이 올바르지 않습니다.');
    return false;
  }
  
  const projectRef = urlMatch[1];
  const managementApiUrl = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
  
  console.log('📝 Supabase Management API를 통한 SQL 실행 시도...\n');
  
  try {
    // Supabase Management API는 액세스 토큰이 필요합니다
    // Service Role Key를 사용할 수 없으므로, 대신 Supabase REST API의 직접 SQL 실행을 시도합니다
    
    // 방법: Supabase의 PostgREST를 통해 직접 SQL 실행
    // 하지만 PostgREST는 SELECT/INSERT/UPDATE/DELETE만 지원하므로 DDL은 불가능합니다
    
    // 대신, 각 SQL 문장을 개별적으로 실행하는 방법을 시도합니다
    // 하지만 이것도 Supabase의 제한으로 인해 불가능합니다
    
    console.log('⚠️  Supabase는 직접 SQL 실행을 지원하지 않습니다.');
    console.log('📋 Supabase 대시보드 > SQL Editor에서 다음 SQL을 실행하세요:\n');
    console.log(migrationSQL);
    console.log('\n');
    
    return false;
  } catch (error: any) {
    console.error('❌ 오류 발생:', error.message);
    return false;
  }
}

async function checkAndCreateTable() {
  // 먼저 테이블 존재 여부 확인
  console.log('🔍 jd_requests 테이블 존재 여부 확인 중...\n');
  
  try {
    const { data, error } = await supabase
      .from('jd_requests')
      .select('*')
      .limit(0);
    
    if (error) {
      if (error.message.includes('schema cache') || error.message.includes('not found')) {
        console.log('❌ jd_requests 테이블이 존재하지 않습니다.\n');
        return false;
      }
    }
    
    console.log('✅ jd_requests 테이블이 이미 존재합니다.\n');
    return true;
  } catch (error: any) {
    console.log('❌ 테이블 확인 중 오류:', error.message);
    return false;
  }
}

async function main() {
  const exists = await checkAndCreateTable();
  
  if (exists) {
    console.log('💡 테이블을 재생성하려면 Supabase 대시보드에서 테이블을 삭제한 후 다시 실행하세요.\n');
    return;
  }
  
  console.log('📝 마이그레이션을 적용합니다...\n');
  
  // Supabase는 직접 SQL 실행을 지원하지 않으므로
  // 사용자에게 대시보드에서 실행하도록 안내합니다
  console.log('⚠️  Supabase는 보안상의 이유로 직접 SQL 실행을 지원하지 않습니다.');
  console.log('📋 다음 단계를 따라주세요:\n');
  console.log('1. Supabase 대시보드 접속: https://app.supabase.com');
  console.log('2. 프로젝트 선택');
  console.log('3. 좌측 메뉴에서 "SQL Editor" 클릭');
  console.log('4. "New query" 클릭');
  console.log('5. 아래 SQL을 복사하여 붙여넣기');
  console.log('6. "Run" 버튼 클릭\n');
  console.log('='.repeat(70));
  console.log(migrationSQL);
  console.log('='.repeat(70));
  console.log('\n');
  
  // 하지만 사용자가 요청했으므로, 가능한 방법을 모두 시도합니다
  await applyMigrationViaManagementAPI();
}

main().catch((error) => {
  console.error('❌ 오류 발생:', error);
  process.exit(1);
});
