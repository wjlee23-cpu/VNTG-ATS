/**
 * 후보자 관리 시스템 개선 마이그레이션 적용
 * Supabase Service Role Key를 사용하여 직접 실행
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

// 환경 변수 로드
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

async function executeSQL() {
  console.log('🚀 후보자 관리 시스템 개선 마이그레이션 적용 시작...\n');
  console.log(`🔗 연결: ${supabaseUrl}\n`);

  // 마이그레이션 파일 읽기
  const migrationFile = resolve(
    process.cwd(),
    'supabase/migrations/20260223173357_apply_all_migrations.sql'
  );
  const sql = readFileSync(migrationFile, 'utf-8');

  console.log(`📄 마이그레이션 파일 로드 완료\n`);

  // SQL을 문장 단위로 분리
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))
    .map(s => s + ';');

  console.log(`📝 총 ${statements.length}개의 SQL 문장 실행 중...\n`);

  // 각 문장을 Supabase의 REST API를 통해 실행
  // Supabase는 직접 SQL 실행을 지원하지 않으므로, 
  // 각 DDL 문장을 개별적으로 처리해야 합니다.
  
  // 하지만 Supabase REST API는 DDL을 지원하지 않으므로,
  // 실제로는 Supabase 대시보드에서 직접 실행해야 합니다.
  
  console.log('⚠️  Supabase REST API는 DDL(ALTER TABLE, CREATE TABLE 등)을 지원하지 않습니다.');
  console.log('📋 Supabase 대시보드에서 직접 실행하세요:\n');
  console.log('='.repeat(70));
  console.log('1. https://app.supabase.com 접속');
  console.log('2. 프로젝트 선택 > SQL Editor');
  console.log('3. New query 클릭');
  console.log('4. 아래 SQL을 복사하여 붙여넣기');
  console.log('5. Run 버튼 클릭\n');
  console.log('='.repeat(70));
  console.log(sql);
  console.log('='.repeat(70));
  console.log('\n');

  // 하지만 사용자가 MCP 권한을 부여했다고 했으므로,
  // 혹시 다른 방법이 있을 수 있습니다.
  // 일단 각 문장을 시도해보겠습니다.
  
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    if (statement.length < 10) continue;

    try {
      // 방법 1: RPC 함수 시도
      const rpcFunctions = ['exec_sql', 'pg_query', 'execute_sql', 'run_sql', 'exec'];
      
      let success = false;
      for (const funcName of rpcFunctions) {
        try {
          const { data, error } = await supabase.rpc(funcName, {
            sql_query: statement,
            query: statement,
            sql: statement,
            statement: statement,
          });

          if (!error) {
            console.log(`  ✅ 문장 ${i + 1}/${statements.length} 완료 (${funcName})`);
            success = true;
            successCount++;
            break;
          }
        } catch {
          continue;
        }
      }

      if (!success) {
        // 방법 2: REST API 직접 호출
        try {
          const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseServiceKey,
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ 
              sql: statement,
              query: statement,
              sql_query: statement,
            }),
          });

          if (response.ok) {
            console.log(`  ✅ 문장 ${i + 1}/${statements.length} 완료 (REST API)`);
            success = true;
            successCount++;
          }
        } catch {
          // REST API 실패 시 계속
        }
      }

      if (!success) {
        console.log(`  ⚠️  문장 ${i + 1}/${statements.length} 실행 불가 (DDL은 Supabase 대시보드에서 실행 필요)`);
        failCount++;
      }
    } catch (error: any) {
      console.log(`  ❌ 문장 ${i + 1}/${statements.length} 실행 중 오류: ${error.message}`);
      failCount++;
    }
  }

  console.log(`\n📊 실행 결과:`);
  console.log(`   ✅ 성공: ${successCount}개`);
  console.log(`   ⚠️  실패: ${failCount}개`);

  if (failCount > 0) {
    console.log('\n💡 실패한 문장들은 Supabase 대시보드에서 직접 실행해야 합니다.');
    console.log('   위에 출력된 SQL을 복사하여 실행하세요.\n');
  } else {
    console.log('\n✨ 모든 마이그레이션이 성공적으로 적용되었습니다!');
  }
}

executeSQL().catch((error) => {
  console.error('❌ 오류 발생:', error);
  process.exit(1);
});
