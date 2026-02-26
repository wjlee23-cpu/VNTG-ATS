/**
 * Supabase MCP를 사용하여 스키마 적용 및 더미 데이터 삽입
 * 
 * 사용법:
 * npx tsx scripts/apply-schema-via-mcp.ts
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

async function executeSQL(sql: string, description: string): Promise<void> {
  console.log(`\n📝 ${description} 실행 중...`);
  
  try {
    // Supabase는 직접 SQL 실행을 지원하지 않으므로
    // REST API를 통해 실행하거나 rpc 함수를 사용해야 합니다.
    // 여기서는 Supabase의 REST API를 사용합니다.
    
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ sql }),
    });

    if (!response.ok) {
      // exec_sql 함수가 없을 수 있으므로, 대안으로 각 테이블에 직접 접근
      console.log(`⚠️  exec_sql 함수를 사용할 수 없습니다. SQL을 직접 실행할 수 없습니다.`);
      console.log(`\n📋 대신 Supabase 대시보드에서 다음 SQL을 실행하세요:\n`);
      console.log(sql);
      console.log(`\n`);
      return;
    }

    const result = await response.json();
    console.log(`✅ ${description} 완료`);
  } catch (error) {
    console.error(`❌ ${description} 실패:`, error);
    console.log(`\n📋 Supabase 대시보드에서 다음 SQL을 직접 실행하세요:\n`);
    console.log(sql);
    console.log(`\n`);
  }
}

async function main() {
  console.log('🚀 Supabase 스키마 적용 시작...\n');
  console.log(`🔗 연결: ${supabaseUrl}\n`);

  // 1. 기존 테이블 삭제
  const dropSQL = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/000_drop_all_tables.sql'),
    'utf-8'
  );
  await executeSQL(dropSQL, '기존 테이블 삭제');

  // 2. 새 스키마 생성
  const schemaSQL = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/001_complete_schema.sql'),
    'utf-8'
  );
  await executeSQL(schemaSQL, '새 스키마 생성');

  // 3. 더미 데이터 삽입
  const seedSQL = readFileSync(
    resolve(process.cwd(), 'scripts/seed-dummy-data.sql'),
    'utf-8'
  );
  await executeSQL(seedSQL, '더미 데이터 삽입');

  console.log('\n✨ 모든 작업 완료!');
  console.log('\n💡 Supabase는 직접 SQL 실행을 지원하지 않으므로,');
  console.log('   위에 출력된 SQL을 Supabase 대시보드 > SQL Editor에서 실행하세요.');
}

main().catch(console.error);
