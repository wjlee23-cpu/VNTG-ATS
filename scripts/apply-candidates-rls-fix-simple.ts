/**
 * Candidates RLS 무한 재귀 문제 수정 마이그레이션 적용
 * DATABASE_URL을 사용하여 PostgreSQL에 직접 연결하여 SQL을 실행합니다.
 */

import { Client } from 'pg';
import { config } from 'dotenv';
import { resolve } from 'path';
import { readFileSync } from 'fs';

// 환경 변수 로드
config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local') });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL이 설정되지 않았습니다.');
  console.error('   .env 또는 .env.local 파일에 DATABASE_URL을 설정해주세요.');
  console.error('   형식: postgresql://postgres.[PROJECT_ID]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres');
  process.exit(1);
}

async function fixCandidatesRLS() {
  console.log('🔧 Candidates 테이블 RLS 무한 재귀 문제 수정 중...\n');

  // 마이그레이션 파일 읽기
  const migrationFile = resolve(process.cwd(), 'supabase/migrations/20260308000000_fix_candidates_rls_recursion.sql');
  const sql = readFileSync(migrationFile, 'utf-8');

  console.log('📄 마이그레이션 SQL 로드 완료\n');

  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✅ PostgreSQL 연결 성공\n');

    // SQL 실행
    await client.query(sql);
    console.log('✅ RLS 정책 수정 완료!\n');
    console.log('✨ 문제가 되는 정책이 수정되었습니다.');
    console.log('   이제 후보자 추가 기능이 정상적으로 작동할 것입니다.\n');

  } catch (error: any) {
    console.error(`❌ 오류 발생: ${error.message}`);
    if (error.message.includes('does not exist')) {
      console.log('\n⚠️  정책이 이미 삭제되었거나 존재하지 않습니다.');
      console.log('   이는 정상일 수 있습니다. 기능을 테스트해보세요.\n');
    } else {
      console.log('\n⚠️  마이그레이션 실행 중 오류가 발생했습니다.');
      console.log('   Supabase 대시보드의 SQL Editor에서 직접 실행해주세요.\n');
    }
  } finally {
    await client.end();
  }
}

fixCandidatesRLS().catch(console.error);
