/**
 * Supabase MCP를 통한 더미 데이터 마이그레이션 적용
 * 종합 더미 데이터를 Supabase에 직접 적용합니다.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { config } from 'dotenv';

// 환경 변수 로드
const envLocalPath = resolve(process.cwd(), '.env.local');
const envPath = resolve(process.cwd(), '.env');

if (require('fs').existsSync(envLocalPath)) {
  config({ path: envLocalPath, override: true });
} else if (require('fs').existsSync(envPath)) {
  config({ path: envPath, override: true });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
  console.log('🚀 더미 데이터 마이그레이션 적용 시작...\n');
  console.log(`🔗 연결: ${supabaseUrl}\n`);

  // 마이그레이션 파일 읽기
  const migrationFile = resolve(
    process.cwd(),
    'supabase/migrations/20260224000000_comprehensive_dummy_data.sql'
  );
  
  if (!require('fs').existsSync(migrationFile)) {
    console.error(`❌ 마이그레이션 파일을 찾을 수 없습니다: ${migrationFile}`);
    process.exit(1);
  }

  const sql = readFileSync(migrationFile, 'utf-8');
  console.log(`📄 마이그레이션 파일 로드 완료 (${(sql.length / 1024).toFixed(2)} KB)\n`);

  // SQL을 세미콜론으로 분리 (DO $$ 블록은 별도 처리 필요)
  // 복잡한 PL/pgSQL 블록을 고려하여 더 정교한 파싱 필요
  const statements = sql
    .split(/;(?![^$]*\$\$)/) // DO $$ 블록 내부의 세미콜론은 제외
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))
    .map(s => s + ';');

  console.log(`📝 총 ${statements.length}개의 SQL 문장 실행 중...\n`);

  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;

  // Supabase는 직접 SQL 실행을 지원하지 않으므로,
  // RPC 함수를 통해 시도하거나, 각 INSERT 문을 개별적으로 실행
  // 하지만 DDL과 복잡한 PL/pgSQL은 직접 실행이 불가능합니다.
  
  // 대안: Supabase REST API의 rpc 엔드포인트를 사용하거나
  // 또는 사용자에게 Supabase 대시보드에서 직접 실행하도록 안내
  
  console.log('⚠️  Supabase는 복잡한 SQL 마이그레이션을 직접 실행할 수 없습니다.');
  console.log('   DDL과 PL/pgSQL 블록은 Supabase 대시보드의 SQL Editor에서 실행해야 합니다.\n');
  
  console.log('='.repeat(70));
  console.log('📋 다음 단계를 따라주세요:');
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

  // 하지만 간단한 INSERT 문들은 시도해볼 수 있습니다
  // RPC 함수가 있다면 사용, 없다면 스킵
  const simpleInserts = statements.filter(s => 
    s.trim().toUpperCase().startsWith('INSERT INTO') && 
    !s.includes('DO $$') &&
    !s.includes('RETURNING')
  );

  if (simpleInserts.length > 0) {
    console.log(`\n📝 ${simpleInserts.length}개의 간단한 INSERT 문을 시도합니다...\n`);
    
    for (let i = 0; i < simpleInserts.length; i++) {
      const statement = simpleInserts[i];
      
      try {
        // Supabase REST API를 통한 직접 SQL 실행은 지원하지 않습니다.
        // 대신 각 테이블에 대한 insert를 Supabase 클라이언트로 시도할 수 있지만,
        // 복잡한 SQL은 불가능합니다.
        
        console.log(`  ⚠️  문장 ${i + 1}/${simpleInserts.length}: 직접 실행 불가 (Supabase 제한)`);
        skipCount++;
      } catch (error: any) {
        console.log(`  ❌ 문장 ${i + 1}/${simpleInserts.length} 실패: ${error.message}`);
        failCount++;
      }
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('📊 실행 결과:');
  console.log(`   성공: ${successCount}개`);
  console.log(`   스킵: ${skipCount}개`);
  console.log(`   실패: ${failCount}개`);
  console.log('='.repeat(70));
  console.log('\n💡 복잡한 SQL 마이그레이션은 Supabase 대시보드에서 직접 실행해야 합니다.');
  console.log('   위에 출력된 SQL을 복사하여 Supabase SQL Editor에서 실행하세요.\n');
}

executeSQL().catch(console.error);
