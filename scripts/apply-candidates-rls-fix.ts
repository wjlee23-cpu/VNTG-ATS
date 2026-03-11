/**
 * Candidates RLS 무한 재귀 문제 수정 마이그레이션 적용
 * Service Role Key를 사용하여 직접 SQL 실행
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';

// .env 파일 로드
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let databaseUrl = process.env.DATABASE_URL;

// DATABASE_URL이 없으면 Supabase URL에서 구성 시도
if (!databaseUrl && supabaseUrl) {
  // Supabase URL에서 프로젝트 ID 추출
  const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
  if (match) {
    const projectId = match[1];
    const dbPassword = process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD || process.env.SUPABASE_DB_PASS;
    if (dbPassword) {
      // 여러 리전 시도
      const regions = ['ap-northeast-2', 'us-east-1', 'eu-west-1'];
      // 일단 ap-northeast-2로 시도
      databaseUrl = `postgresql://postgres.${projectId}:${encodeURIComponent(dbPassword)}@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres`;
    } else {
      // 직접 연결 문자열 시도
      databaseUrl = `postgresql://postgres.${projectId}:[YOUR-PASSWORD]@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres`;
    }
  }
}

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 환경 변수가 설정되지 않았습니다.');
  console.error('   필요한 변수: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

async function executeSQLViaPostgres() {
  if (!databaseUrl) {
    return null;
  }

  try {
    const client = new Client({
      connectionString: databaseUrl,
      ssl: { rejectUnauthorized: false },
    });

    await client.connect();
    console.log('✅ PostgreSQL 직접 연결 성공\n');
    return client;
  } catch (error: any) {
    console.log('⚠️  PostgreSQL 직접 연결 실패:', error.message);
    return null;
  }
}

async function executeSQL() {
  console.log('🚀 Candidates RLS 무한 재귀 문제 수정 마이그레이션 적용 시작...\n');
  console.log(`🔗 연결: ${supabaseUrl}\n`);

  // 마이그레이션 파일 읽기
  const migrationFile = resolve(
    process.cwd(),
    'supabase/migrations/20260308000000_fix_candidates_rls_recursion.sql'
  );

  if (!require('fs').existsSync(migrationFile)) {
    console.error(`❌ 마이그레이션 파일을 찾을 수 없습니다: ${migrationFile}`);
    process.exit(1);
  }

  const sql = readFileSync(migrationFile, 'utf-8');
  console.log(`📄 마이그레이션 파일 로드 완료\n`);

  // 방법 1: PostgreSQL 직접 연결 시도
  if (databaseUrl) {
    console.log('📝 방법 1: PostgreSQL 직접 연결 시도...\n');
    const client = await executeSQLViaPostgres();

    if (client) {
      try {
        // SQL 실행
        await client.query(sql);
        console.log('✅ 마이그레이션 적용 완료!\n');
        await client.end();
        return;
      } catch (error: any) {
        console.error(`❌ PostgreSQL 실행 중 오류: ${error.message}`);
        try {
          await client.end();
        } catch {
          // 이미 종료된 경우 무시
        }
      }
    }
  }

  // 방법 2: Supabase Service Role Client 사용
  console.log('\n📝 방법 2: Supabase Service Role Client 사용...\n');
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // SQL을 세미콜론으로 분리하여 각 문장 실행
  // 주석 라인을 제거하고 빈 줄 제거
  const lines = sql.split('\n').filter(line => {
    const trimmed = line.trim();
    return trimmed.length > 0 && !trimmed.startsWith('--');
  });
  const sqlWithoutComments = lines.join('\n');
  
  const statements = sqlWithoutComments
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .map(s => s + ';');

  console.log(`📝 총 ${statements.length}개의 SQL 문장 실행 중...\n`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    if (statement.length < 10) continue;

    try {
      // Supabase는 직접 SQL 실행을 지원하지 않으므로,
      // RPC 함수를 통해 시도하거나 사용자에게 안내
      console.log(`  ⚠️  문장 ${i + 1}/${statements.length}: Supabase 클라이언트로는 DDL 실행이 불가능합니다.`);
      console.log(`     PostgreSQL 직접 연결을 사용하거나 Supabase 대시보드에서 실행하세요.\n`);
      failCount++;
    } catch (error: any) {
      console.log(`  ❌ 문장 ${i + 1}/${statements.length} 실패: ${error.message}`);
      failCount++;
    }
  }

  if (failCount > 0) {
    console.log('\n❌ 자동 실행이 불가능합니다.');
    console.log('\n📋 Supabase 대시보드에서 직접 실행하세요:');
    console.log('   1. https://app.supabase.com 접속');
    console.log('   2. 프로젝트 선택 > SQL Editor');
    console.log('   3. New query 클릭');
    console.log('   4. 아래 SQL을 복사하여 실행:\n');
    console.log('='.repeat(60));
    console.log(sql);
    console.log('='.repeat(60));
    console.log(`\n전체 SQL 파일: ${migrationFile}`);
  }
}

executeSQL().catch((error) => {
  console.error('❌ 오류 발생:', error);
  process.exit(1);
});
