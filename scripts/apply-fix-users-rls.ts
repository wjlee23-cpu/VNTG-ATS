/**
 * Users 테이블 RLS 무한 재귀 문제 수정 스크립트
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
  process.exit(1);
}

async function fixUsersRLS() {
  console.log('🔧 Users 테이블 RLS 무한 재귀 문제 수정 중...\n');

  // 마이그레이션 파일 읽기
  const migrationFile = resolve(process.cwd(), 'supabase/migrations/20260228000000_fix_users_rls_recursion.sql');
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
    console.log('✨ 문제가 되는 정책이 삭제되었습니다.');
    console.log('   이제 Supabase 연결이 정상적으로 작동할 것입니다.\n');

  } catch (error: any) {
    console.error(`❌ 오류 발생: ${error.message}`);
    if (error.message.includes('does not exist')) {
      console.log('\n⚠️  정책이 이미 삭제되었거나 존재하지 않습니다.');
      console.log('   이는 정상일 수 있습니다. 연결 테스트를 다시 시도해보세요.\n');
    }
  } finally {
    await client.end();
  }
}

fixUsersRLS().catch(console.error);
