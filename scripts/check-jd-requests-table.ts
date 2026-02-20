/**
 * jd_requests 테이블 존재 여부 확인 스크립트
 * Supabase 데이터베이스에서 jd_requests 테이블이 존재하는지 확인합니다.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 환경 변수가 설정되지 않았습니다.');
  console.error('NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 확인하세요.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function checkJDRequestsTable() {
  console.log('🔍 jd_requests 테이블 존재 여부 확인 중...\n');
  console.log(`🔗 연결: ${supabaseUrl}\n`);

  try {
    // 방법 1: 직접 테이블 조회 시도
    const { data, error } = await supabase
      .from('jd_requests')
      .select('*')
      .limit(0);

    if (error) {
      if (error.message.includes('schema cache') || error.message.includes('not found')) {
        console.log('❌ jd_requests 테이블이 존재하지 않습니다.');
        console.log(`   에러: ${error.message}\n`);
        return false;
      } else {
        console.log('⚠️  테이블은 존재하지만 다른 에러가 발생했습니다.');
        console.log(`   에러: ${error.message}\n`);
        return true; // 테이블은 존재하는 것으로 간주
      }
    } else {
      console.log('✅ jd_requests 테이블이 존재합니다.\n');
      return true;
    }
  } catch (error: any) {
    console.log('❌ 테이블 확인 중 오류 발생');
    console.log(`   에러: ${error.message}\n`);
    return false;
  }
}

async function checkAllTables() {
  console.log('📋 모든 테이블 목록 확인 중...\n');

  try {
    // information_schema를 통해 테이블 목록 조회
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name;
      `,
    });

    if (error) {
      // RPC 함수가 없을 수 있으므로 대안 방법 사용
      console.log('⚠️  RPC 함수를 사용할 수 없습니다. 직접 테이블 조회를 시도합니다.\n');
      return;
    }

    if (data) {
      const tables = (data as any[]).map((row: any) => row.table_name);
      console.log(`✅ 현재 테이블 개수: ${tables.length}`);
      if (tables.length > 0) {
        console.log(`   테이블 목록: ${tables.join(', ')}\n`);
        const hasJDRequests = tables.includes('jd_requests');
        if (hasJDRequests) {
          console.log('✅ jd_requests 테이블이 목록에 있습니다.\n');
        } else {
          console.log('❌ jd_requests 테이블이 목록에 없습니다.\n');
        }
      } else {
        console.log('   테이블이 없습니다.\n');
      }
    }
  } catch (error: any) {
    console.log('⚠️  테이블 목록 조회 실패');
    console.log(`   에러: ${error.message}\n`);
  }
}

async function main() {
  const exists = await checkJDRequestsTable();
  
  if (!exists) {
    await checkAllTables();
    console.log('\n📝 다음 단계:');
    console.log('   1. Supabase 대시보드 > SQL Editor로 이동');
    console.log('   2. supabase/migrations/20250221000003_add_figma_fields.sql 파일의');
    console.log('      "2. jd_requests 테이블 생성" 부분을 실행하세요.\n');
  }
}

main().catch(console.error);
