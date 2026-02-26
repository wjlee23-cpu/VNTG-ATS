/**
 * Supabase에 SQL을 실행하는 최종 스크립트
 * Service Role Key를 사용하여 가능한 모든 방법 시도
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
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL이 설정되지 않았습니다.');
  process.exit(1);
}

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.');
  process.exit(1);
}

console.log('🚀 Supabase 스키마 생성 및 더미 데이터 삽입 시작...\n');
console.log(`🔗 연결: ${supabaseUrl}\n`);
console.log(`✅ Service Role Key: ${supabaseServiceKey.substring(0, 20)}...\n`);

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// SQL 파일 읽기
const schemaSQL = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/001_complete_schema.sql'),
  'utf-8'
);

const seedSQL = readFileSync(
  resolve(process.cwd(), 'scripts/seed-dummy-data.sql'),
  'utf-8'
);

async function executeSQLViaRPC(sql: string, description: string): Promise<boolean> {
  console.log(`\n📝 ${description} 실행 시도 (RPC 함수)...\n`);

  // 여러 RPC 함수 이름 시도
  const rpcFunctions = ['exec_sql', 'pg_query', 'execute_sql', 'run_sql'];
  
  for (const funcName of rpcFunctions) {
    try {
      const { data, error } = await supabase.rpc(funcName, { 
        sql_query: sql,
        query: sql,
        sql: sql,
      });

      if (!error) {
        console.log(`✅ ${description} 완료! (${funcName} 사용)`);
        return true;
      }
    } catch (error: any) {
      continue;
    }
  }

  return false;
}

async function executeSQLViaRestAPI(sql: string, description: string): Promise<boolean> {
  console.log(`\n📝 ${description} 실행 시도 (REST API)...\n`);

  // 여러 엔드포인트 시도
  const endpoints = [
    '/rest/v1/rpc/exec_sql',
    '/rest/v1/rpc/pg_query',
    '/rest/v1/rpc/execute_sql',
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${supabaseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ 
          sql_query: sql,
          query: sql,
          sql: sql,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`✅ ${description} 완료! (${endpoint})`);
        return true;
      }
    } catch (error: any) {
      continue;
    }
  }

  return false;
}

async function executeSQLViaManagementAPI(sql: string, description: string): Promise<boolean> {
  console.log(`\n📝 ${description} 실행 시도 (Management API)...\n`);

  const urlMatch = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/);
  if (!urlMatch) {
    return false;
  }

  const projectRef = urlMatch[1];

  try {
    const response = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'apikey': supabaseServiceKey,
        },
        body: JSON.stringify({ query: sql }),
      }
    );

    if (response.ok) {
      const result = await response.json();
      console.log(`✅ ${description} 완료! (Management API)`);
      return true;
    } else {
      const errorText = await response.text();
      console.log(`⚠️  Management API 실패: HTTP ${response.status}`);
      return false;
    }
  } catch (error: any) {
    console.log(`⚠️  Management API 호출 실패: ${error.message}`);
    return false;
  }
}

async function main() {
  // 방법 1: RPC 함수 시도
  let schemaSuccess = await executeSQLViaRPC(schemaSQL, '스키마 생성');
  
  // 방법 2: REST API 시도
  if (!schemaSuccess) {
    schemaSuccess = await executeSQLViaRestAPI(schemaSQL, '스키마 생성');
  }

  // 방법 3: Management API 시도
  if (!schemaSuccess) {
    schemaSuccess = await executeSQLViaManagementAPI(schemaSQL, '스키마 생성');
  }

  if (!schemaSuccess) {
    console.log('\n❌ 자동 실행이 불가능합니다.');
    console.log('💡 Supabase는 Service Role Key만으로는 직접 SQL 실행을 지원하지 않습니다.');
    console.log('📋 Supabase 대시보드 > SQL Editor에서 다음 SQL을 실행하세요:\n');
    console.log('='.repeat(80));
    console.log('1. https://app.supabase.com 접속');
    console.log('2. 프로젝트 선택 > SQL Editor > New query');
    console.log('3. 아래 파일 내용을 복사하여 실행:\n');
    console.log(`   - ${resolve(process.cwd(), 'supabase/migrations/001_complete_schema.sql')}`);
    console.log(`   - ${resolve(process.cwd(), 'scripts/seed-dummy-data.sql')}`);
    console.log('='.repeat(80));
    process.exit(1);
  }

  // 더미 데이터 삽입
  let seedSuccess = await executeSQLViaRPC(seedSQL, '더미 데이터 삽입');
  
  if (!seedSuccess) {
    seedSuccess = await executeSQLViaRestAPI(seedSQL, '더미 데이터 삽입');
  }

  if (!seedSuccess) {
    seedSuccess = await executeSQLViaManagementAPI(seedSQL, '더미 데이터 삽입');
  }

  if (seedSuccess) {
    console.log('\n✨ 모든 작업 완료!\n');
    
    // 결과 확인
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('id')
        .limit(1);
      
      if (!error && data) {
        console.log('✅ 스키마가 성공적으로 생성되었습니다!');
        console.log('📊 생성된 데이터를 확인하려면 Supabase 대시보드에서 확인하세요.\n');
      }
    } catch (error) {
      // 무시
    }
  } else {
    console.log('\n⚠️  더미 데이터 삽입 실패 (스키마는 생성됨)\n');
  }
}

main().catch(console.error);
