/**
 * Supabase 스키마 생성 및 더미 데이터 삽입 스크립트
 * Supabase MCP를 통해 실행
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
  console.error('NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 확인하세요.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// 현재 테이블 목록 조회
async function checkCurrentSchema() {
  console.log('📋 현재 스키마 상태 확인 중...\n');
  
  try {
    // information_schema를 통해 테이블 목록 조회
    const { data, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .order('table_name');

    if (error) {
      console.log('⚠️  테이블 목록 조회 실패 (정상일 수 있음 - 테이블이 없을 때)');
      console.log(`   에러: ${error.message}\n`);
      return [];
    }

    const tables = data?.map((row: any) => row.table_name) || [];
    console.log(`✅ 현재 테이블 개수: ${tables.length}`);
    if (tables.length > 0) {
      console.log(`   테이블 목록: ${tables.join(', ')}\n`);
    } else {
      console.log('   테이블이 없습니다. (새로 생성할 예정)\n');
    }
    return tables;
  } catch (error: any) {
    console.log('⚠️  스키마 확인 중 오류 발생');
    console.log(`   에러: ${error.message}\n`);
    return [];
  }
}

// SQL 실행 (Supabase는 직접 SQL 실행을 지원하지 않으므로 안내만 제공)
async function executeSQL(sql: string, description: string): Promise<void> {
  console.log(`\n📝 ${description}`);
  console.log(`   SQL 크기: ${(sql.length / 1024).toFixed(2)} KB\n`);
  console.log('⚠️  Supabase JavaScript 클라이언트는 직접 SQL 실행을 지원하지 않습니다.');
  console.log('📋 Supabase 대시보드 > SQL Editor에서 다음 SQL을 실행하세요:\n');
  console.log('='.repeat(80));
  console.log(sql);
  console.log('='.repeat(80));
  console.log('\n');
}

async function main() {
  console.log('🚀 Supabase 스키마 생성 및 더미 데이터 삽입 시작...\n');
  console.log(`🔗 연결: ${supabaseUrl}\n`);

  // 1단계: 현재 스키마 상태 확인
  const existingTables = await checkCurrentSchema();

  // 2단계: 마이그레이션 파일 읽기
  const schemaSQL = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/001_complete_schema.sql'),
    'utf-8'
  );

  // 3단계: 스키마 생성 SQL 실행 안내
  await executeSQL(schemaSQL, '스키마 생성 SQL');

  // 4단계: 더미 데이터 파일 읽기
  const seedSQL = readFileSync(
    resolve(process.cwd(), 'scripts/seed-dummy-data.sql'),
    'utf-8'
  );

  // 5단계: 더미 데이터 삽입 SQL 실행 안내
  await executeSQL(seedSQL, '더미 데이터 삽입 SQL');

  console.log('\n✨ 안내 완료!');
  console.log('\n💡 다음 단계:');
  console.log('   1. https://app.supabase.com 접속');
  console.log('   2. 프로젝트 선택 > SQL Editor > New query');
  console.log('   3. 위에 출력된 SQL을 순서대로 실행');
  console.log('      - 먼저 스키마 생성 SQL 실행');
  console.log('      - 그 다음 더미 데이터 삽입 SQL 실행\n');
}

main().catch(console.error);
