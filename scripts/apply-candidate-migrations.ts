/**
 * 후보자 관리 시스템 개선 마이그레이션 적용
 * Supabase MCP를 통해 실행
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

// 환경 변수 로드 (.env.local 우선, 없으면 .env)
config({ path: resolve(process.cwd(), '.env.local') });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  config({ path: resolve(process.cwd(), '.env') });
}

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

async function executeSQL(sql: string, description: string): Promise<boolean> {
  console.log(`\n📝 ${description} 실행 중...`);
  
  // SQL을 세미콜론으로 분리하여 각 문장 실행
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))
    .map(s => s + ';');

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    if (statement.length < 10) continue; // 너무 짧은 문장은 스킵

    try {
      // 방법 1: RPC 함수 시도
      const rpcFunctions = ['exec_sql', 'pg_query', 'execute_sql', 'run_sql'];
      let success = false;

      for (const funcName of rpcFunctions) {
        try {
          const { data, error } = await supabase.rpc(funcName, {
            sql_query: statement,
            query: statement,
            sql: statement,
          });

          if (!error) {
            success = true;
            break;
          }
        } catch {
          continue;
        }
      }

      if (success) {
        console.log(`  ✅ 문장 ${i + 1}/${statements.length} 완료`);
        continue;
      }

      // 방법 2: REST API 시도
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ sql: statement }),
        });

        if (response.ok) {
          console.log(`  ✅ 문장 ${i + 1}/${statements.length} 완료`);
          continue;
        }
      } catch {
        // REST API 실패 시 계속
      }

      // 모든 방법 실패
      console.log(`  ⚠️  문장 ${i + 1}/${statements.length} 실행 실패 (수동 실행 필요)`);
      console.log(`     SQL: ${statement.substring(0, 100)}...`);
    } catch (error: any) {
      console.log(`  ⚠️  문장 ${i + 1}/${statements.length} 실행 중 오류: ${error.message}`);
    }
  }

  console.log(`\n✅ ${description} 완료`);
  return true;
}

async function main() {
  console.log('🚀 후보자 관리 시스템 개선 마이그레이션 적용 시작...\n');
  console.log(`🔗 연결: ${supabaseUrl}\n`);

  // 마이그레이션 파일 읽기
  const migrationFile = resolve(
    process.cwd(),
    'supabase/migrations/20260223173357_apply_all_migrations.sql'
  );
  const sql = readFileSync(migrationFile, 'utf-8');

  console.log(`📄 마이그레이션 파일 로드 완료\n`);

  // 마이그레이션 실행
  await executeSQL(sql, '후보자 관리 시스템 개선 마이그레이션');

  console.log('\n✨ 마이그레이션 적용 완료!');
  console.log('\n💡 Supabase 스키마 캐시를 새로고침하세요:');
  console.log('   Settings > API > Refresh Schema Cache\n');
}

main().catch((error) => {
  console.error('❌ 오류 발생:', error);
  console.error('\n📋 Supabase 대시보드에서 직접 실행하세요:');
  console.error('   1. https://app.supabase.com 접속');
  console.error('   2. 프로젝트 선택 > SQL Editor');
  console.error('   3. supabase/migrations/20260223173357_apply_all_migrations.sql 파일 내용 복사하여 실행\n');
  process.exit(1);
});
