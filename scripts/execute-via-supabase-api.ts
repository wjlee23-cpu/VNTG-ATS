/**
 * Supabase REST API를 사용하여 SQL 실행 시도
 * Service Role Key를 사용하여 가능한 작업 수행
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';
import { readFileSync } from 'fs';

// 환경 변수 로드
config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 환경 변수가 설정되지 않았습니다.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function executeSQLViaRPC(sql: string, description: string): Promise<boolean> {
  console.log(`\n📝 ${description} 실행 시도 (RPC 함수)...\n`);

  try {
    // Supabase는 exec_sql 같은 RPC 함수를 기본 제공하지 않지만
    // 사용자가 생성한 함수가 있을 수 있습니다.
    // 또는 pg_query 같은 함수를 시도해볼 수 있습니다.
    
    const { data, error } = await supabase.rpc('exec_sql', { 
      sql_query: sql 
    });

    if (error) {
      // 다른 함수 이름 시도
      const { data: data2, error: error2 } = await supabase.rpc('pg_query', { 
        query: sql 
      });

      if (error2) {
        console.log('⚠️  RPC 함수를 사용할 수 없습니다.');
        return false;
      }

      console.log(`✅ ${description} 완료! (pg_query 사용)`);
      return true;
    }

    console.log(`✅ ${description} 완료! (exec_sql 사용)`);
    return true;
  } catch (error: any) {
    console.log('⚠️  RPC 함수 호출 실패:', error.message);
    return false;
  }
}

async function executeSQLViaRestAPI(sql: string, description: string): Promise<boolean> {
  console.log(`\n📝 ${description} 실행 시도 (REST API)...\n`);

  try {
    // Supabase REST API를 통해 SQL 실행 시도
    // 실제로는 이 방법도 지원하지 않을 수 있습니다.
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ sql_query: sql }),
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`✅ ${description} 완료!`);
      return true;
    } else {
      console.log(`⚠️  REST API 호출 실패: HTTP ${response.status}`);
      return false;
    }
  } catch (error: any) {
    console.log('⚠️  REST API 호출 실패:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Supabase 스키마 생성 및 더미 데이터 삽입 시작...\n');
  console.log(`🔗 연결: ${supabaseUrl}\n`);

  // SQL 파일 읽기
  const schemaSQL = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/001_complete_schema.sql'),
    'utf-8'
  );

  const seedSQL = readFileSync(
    resolve(process.cwd(), 'scripts/seed-dummy-data.sql'),
    'utf-8'
  );

  // 방법 1: RPC 함수 시도
  let schemaSuccess = await executeSQLViaRPC(schemaSQL, '스키마 생성');
  
  if (!schemaSuccess) {
    // 방법 2: REST API 시도
    schemaSuccess = await executeSQLViaRestAPI(schemaSQL, '스키마 생성');
  }

  if (!schemaSuccess) {
    console.log('\n❌ 자동 실행이 불가능합니다.');
    console.log('💡 Supabase는 Service Role Key만으로는 직접 SQL 실행을 지원하지 않습니다.');
    console.log('📋 다음 방법 중 하나를 사용하세요:\n');
    console.log('1. Supabase 대시보드 > SQL Editor에서 직접 실행');
    console.log('2. PostgreSQL 클라이언트 사용 (SUPABASE_DB_PASSWORD 필요)');
    console.log('3. Supabase CLI 사용\n');
    console.log('SQL 파일 위치:');
    console.log(`   - ${resolve(process.cwd(), 'supabase/migrations/001_complete_schema.sql')}`);
    console.log(`   - ${resolve(process.cwd(), 'scripts/seed-dummy-data.sql')}\n`);
    process.exit(1);
  }

  // 더미 데이터 삽입
  let seedSuccess = await executeSQLViaRPC(seedSQL, '더미 데이터 삽입');
  
  if (!seedSuccess) {
    seedSuccess = await executeSQLViaRestAPI(seedSQL, '더미 데이터 삽입');
  }

  if (seedSuccess) {
    console.log('\n✨ 모든 작업 완료!\n');
  } else {
    console.log('\n⚠️  더미 데이터 삽입 실패 (스키마는 생성됨)\n');
  }
}

main().catch(console.error);
