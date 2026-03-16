/**
 * Postgres 직접 연결을 통한 Storage RLS 정책 설정
 * DATABASE_URL에서 연결 정보를 추출하여 사용
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import { Client } from 'pg';

// 환경 변수 로드
config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const databaseUrl = process.env.DATABASE_URL;

if (!supabaseUrl) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL이 설정되지 않았습니다.');
  process.exit(1);
}

async function setupStorageRLS() {
  console.log('🚀 Storage RLS 정책 설정 시작...\n');

  // SQL 파일 읽기
  const sqlFile = resolve(process.cwd(), 'supabase/migrations/20250101000000_setup_storage_bucket_rls.sql');
  const sql = readFileSync(sqlFile, 'utf-8');
  
  console.log(`📄 SQL 파일 로드 완료 (${(sql.length / 1024).toFixed(2)} KB)\n`);

  let client: Client | null = null;

  // DATABASE_URL 사용
  if (databaseUrl) {
    console.log('🔗 DATABASE_URL 사용...\n');
    
    // URL에서 연결 정보 추출
    try {
      // postgresql:// 형식 파싱
      const match = databaseUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
      
      if (match) {
        const [, user, password, host, port, database] = match;
        
        client = new Client({
          host: host,
          port: parseInt(port),
          database: database,
          user: decodeURIComponent(user),
          password: decodeURIComponent(password),
          ssl: { rejectUnauthorized: false },
          connectionTimeoutMillis: 10000,
        });
      } else {
        // 직접 연결 문자열로 시도
        client = new Client({
          connectionString: databaseUrl,
          ssl: { rejectUnauthorized: false },
          connectionTimeoutMillis: 10000,
        });
      }
    } catch (error: any) {
      console.error('❌ DATABASE_URL 파싱 오류:', error.message);
      console.log('💡 DATABASE_URL 형식을 확인하세요.\n');
      process.exit(1);
    }
  } else {
    console.error('❌ DATABASE_URL이 설정되지 않았습니다.');
    console.log('\n💡 수동 설정 방법:');
    console.log('   1. Supabase 대시보드 (https://app.supabase.com) 접속');
    console.log('   2. 프로젝트 선택 > SQL Editor > New query');
    console.log('   3. supabase/migrations/20250101000000_setup_storage_bucket_rls.sql 파일 내용 복사하여 실행\n');
    process.exit(1);
  }

  try {
    console.log('🔌 Postgres 연결 시도...\n');
    await client!.connect();
    console.log('✅ Postgres 연결 성공!\n');
    
    console.log('📝 Storage RLS 정책 설정 중...\n');
    
    // SQL 실행
    await client!.query(sql);
    
    console.log('✅ Storage RLS 정책 설정 완료!\n');
    
    // 정책 확인
    console.log('🔍 설정된 정책 확인 중...\n');
    const result = await client!.query(`
      SELECT 
        policyname,
        cmd,
        qual,
        with_check
      FROM pg_policies 
      WHERE schemaname = 'storage' 
      AND tablename = 'objects'
      AND policyname LIKE '%resumes%'
      ORDER BY policyname;
    `);
    
    if (result.rows.length > 0) {
      console.log('📋 설정된 정책 목록:');
      result.rows.forEach((row, index) => {
        console.log(`   ${index + 1}. ${row.policyname} (${row.cmd})`);
      });
      console.log('');
    } else {
      console.log('⚠️  정책이 조회되지 않았습니다. (정책이 생성되었는지 확인하세요)\n');
    }
    
    await client!.end();
    console.log('✨ 모든 작업 완료!');
    console.log('\n📌 이제 파일 업로드 기능을 테스트할 수 있습니다.\n');
    
  } catch (error: any) {
    console.error('❌ 오류 발생:', error.message);
    
    if (error.message.includes('ENOTFOUND') || error.message.includes('connection')) {
      console.log('\n💡 연결 오류입니다. DATABASE_URL을 확인하세요.');
    } else if (error.message.includes('already exists')) {
      console.log('\n⚠️  정책이 이미 존재합니다. 기존 정책을 사용합니다.');
    } else {
      console.error('   상세:', error);
    }
    
    await client!.end().catch(() => {});
    
    console.log('\n💡 수동 설정 방법:');
    console.log('   1. Supabase 대시보드 (https://app.supabase.com) 접속');
    console.log('   2. 프로젝트 선택 > SQL Editor > New query');
    console.log('   3. supabase/migrations/20250101000000_setup_storage_bucket_rls.sql 파일 내용 복사하여 실행\n');
    
    process.exit(1);
  }
}

setupStorageRLS().catch(console.error);
