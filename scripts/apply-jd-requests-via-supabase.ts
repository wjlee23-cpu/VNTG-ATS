/**
 * Supabase를 통한 jd_requests 테이블 마이그레이션 적용
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

// SQL을 문장 단위로 분리 (세미콜론 기준)
function splitSQL(sql: string): string[] {
  // DO $$ 블록과 같은 복잡한 구문을 처리하기 위해 정규식 사용
  const statements: string[] = [];
  let current = '';
  let inBlock = false;
  let blockDepth = 0;
  
  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const nextTwo = sql.substring(i, i + 2);
    
    if (nextTwo === '$$') {
      inBlock = !inBlock;
      current += char;
      i++; // 다음 문자 건너뛰기
      current += sql[i];
      continue;
    }
    
    current += char;
    
    if (inBlock) {
      continue;
    }
    
    if (char === ';' && !inBlock) {
      const trimmed = current.trim();
      if (trimmed && !trimmed.startsWith('--')) {
        statements.push(trimmed);
      }
      current = '';
    }
  }
  
  // 마지막 문장 추가
  const trimmed = current.trim();
  if (trimmed && !trimmed.startsWith('--')) {
    statements.push(trimmed);
  }
  
  return statements.filter(s => s.length > 0);
}

async function executeSQLStatement(sql: string): Promise<boolean> {
  // 주석 제거
  const cleanSQL = sql
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n')
    .trim();
  
  if (!cleanSQL || cleanSQL.length === 0) {
    return true;
  }
  
  try {
    // 방법 1: RPC 함수 시도 (exec_sql, pg_query 등)
    const rpcFunctions = ['exec_sql', 'pg_query', 'execute_sql', 'run_sql'];
    
    for (const funcName of rpcFunctions) {
      try {
        const { data, error } = await supabase.rpc(funcName, {
          sql_query: cleanSQL,
          query: cleanSQL,
          sql: cleanSQL,
        });
        
        if (!error) {
          return true;
        }
      } catch {
        continue;
      }
    }
    
    // 방법 2: REST API를 통한 직접 실행 시도
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ sql: cleanSQL }),
    });
    
    if (response.ok) {
      return true;
    }
    
    return false;
  } catch (error: any) {
    console.error(`   에러: ${error.message}`);
    return false;
  }
}

async function applyMigration() {
  console.log('📄 마이그레이션 SQL 파일 로드 완료\n');
  
  // SQL을 문장 단위로 분리
  const statements = splitSQL(migrationSQL);
  console.log(`📝 총 ${statements.length}개의 SQL 문장을 실행합니다.\n`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    const preview = statement.substring(0, 50).replace(/\s+/g, ' ');
    
    console.log(`[${i + 1}/${statements.length}] 실행 중: ${preview}...`);
    
    const success = await executeSQLStatement(statement);
    
    if (success) {
      console.log(`✅ 성공\n`);
      successCount++;
    } else {
      console.log(`⚠️  실패 (수동 실행 필요)\n`);
      failCount++;
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(`✅ 성공: ${successCount}개`);
  console.log(`⚠️  실패: ${failCount}개`);
  console.log('='.repeat(50) + '\n');
  
  if (failCount > 0) {
    console.log('⚠️  일부 SQL 문장이 자동 실행되지 않았습니다.');
    console.log('📋 Supabase 대시보드 > SQL Editor에서 다음 SQL을 실행하세요:\n');
    console.log(migrationSQL);
    console.log('\n');
  } else {
    console.log('✨ 모든 마이그레이션이 성공적으로 적용되었습니다!\n');
    console.log('💡 Supabase 스키마 캐시를 새로고침하세요:');
    console.log('   Settings > API > Refresh Schema Cache\n');
  }
}

// 테이블 존재 여부 확인
async function checkTableExists(): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('jd_requests')
      .select('*')
      .limit(0);
    
    if (error) {
      if (error.message.includes('schema cache') || error.message.includes('not found')) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

async function main() {
  // 먼저 테이블 존재 여부 확인
  console.log('🔍 jd_requests 테이블 존재 여부 확인 중...\n');
  const exists = await checkTableExists();
  
  if (exists) {
    console.log('✅ jd_requests 테이블이 이미 존재합니다.\n');
    console.log('💡 테이블을 재생성하려면 Supabase 대시보드에서 테이블을 삭제한 후 다시 실행하세요.\n');
    return;
  }
  
  console.log('❌ jd_requests 테이블이 존재하지 않습니다.\n');
  console.log('📝 마이그레이션을 적용합니다...\n');
  
  await applyMigration();
}

main().catch((error) => {
  console.error('❌ 오류 발생:', error);
  console.log('\n📋 Supabase 대시보드 > SQL Editor에서 다음 SQL을 실행하세요:\n');
  console.log(migrationSQL);
  process.exit(1);
});
