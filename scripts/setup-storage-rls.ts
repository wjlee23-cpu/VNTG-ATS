/**
 * Supabase Storage RLS 정책 설정 스크립트
 * resumes bucket에 대한 RLS 정책을 Postgres 직접 연결을 통해 설정합니다.
 * 
 * 사용 방법:
 *   npx tsx scripts/setup-storage-rls.ts
 * 
 * 환경 변수 필요:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_DB_PASSWORD (또는 SUPABASE_DB_CONNECTION_STRING)
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import { Client } from 'pg';

// 환경 변수 로드
config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const dbPassword = process.env.SUPABASE_DB_PASSWORD;
const dbConnectionString = process.env.SUPABASE_DB_CONNECTION_STRING || process.env.DATABASE_URL;

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

  let client: Client;

  // Connection String이 제공된 경우 사용
  if (dbConnectionString) {
    console.log('🔗 제공된 Connection String 사용...\n');
    try {
      // URL 파싱하여 개별 파라미터로 전달 (특수 문자 처리)
      const url = new URL(dbConnectionString);
      const auth = url.username ? decodeURIComponent(url.username) : '';
      const password = url.password ? decodeURIComponent(url.password) : '';
      
      client = new Client({
        host: url.hostname,
        port: parseInt(url.port || '5432'),
        database: url.pathname.slice(1) || 'postgres',
        user: auth,
        password: password,
        ssl: { rejectUnauthorized: false },
      });
    } catch (error: any) {
      console.error('❌ Connection String 파싱 오류:', error.message);
      console.log('💡 DATABASE_URL 형식을 확인하세요.\n');
      // 원본 연결 문자열로 재시도
      try {
        client = new Client({
          connectionString: dbConnectionString,
        });
      } catch (retryError: any) {
        console.error('❌ 재시도 실패:', retryError.message);
        process.exit(1);
      }
    }
  } else if (dbPassword) {
    // Supabase URL에서 프로젝트 참조 추출
    const urlMatch = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/);
    if (!urlMatch) {
      console.error('❌ 잘못된 Supabase URL 형식입니다.');
      process.exit(1);
    }

    const projectRef = urlMatch[1];
    
    // 여러 리전 시도
    const regions = ['ap-northeast-2', 'us-east-1', 'eu-west-1', 'ap-southeast-1'];
    let connected = false;

    for (const region of regions) {
      const connectionString = `postgresql://postgres.${projectRef}:${encodeURIComponent(dbPassword)}@aws-0-${region}.pooler.supabase.com:6543/postgres?sslmode=require`;
      
      console.log(`🔗 ${region} 리전 연결 시도...`);
      
      client = new Client({
        connectionString,
        connectionTimeoutMillis: 5000,
      });

      try {
        await client.connect();
        console.log(`✅ ${region} 리전 연결 성공!\n`);
        connected = true;
        break;
      } catch (error: any) {
        console.log(`   ⚠️  ${region} 리전 연결 실패: ${error.message}`);
        await client.end().catch(() => {});
        continue;
      }
    }

    if (!connected) {
      console.error('\n❌ 모든 리전 연결 실패');
      console.log('\n💡 수동 설정 방법:');
      console.log('   1. Supabase 대시보드 (https://app.supabase.com) 접속');
      console.log('   2. 프로젝트 선택 > SQL Editor > New query');
      console.log('   3. supabase/migrations/20250101000000_setup_storage_bucket_rls.sql 파일 내용 복사하여 실행\n');
      process.exit(1);
    }
  } else {
    console.error('❌ SUPABASE_DB_PASSWORD 또는 SUPABASE_DB_CONNECTION_STRING이 필요합니다.');
    console.log('\n💡 수동 설정 방법:');
    console.log('   1. Supabase 대시보드 (https://app.supabase.com) 접속');
    console.log('   2. 프로젝트 선택 > SQL Editor > New query');
    console.log('   3. supabase/migrations/20250101000000_setup_storage_bucket_rls.sql 파일 내용 복사하여 실행\n');
    process.exit(1);
  }

  try {
    console.log('📝 Storage RLS 정책 설정 중...\n');
    
    // SQL 실행
    await client.query(sql);
    
    console.log('✅ Storage RLS 정책 설정 완료!\n');
    
    // 정책 확인
    console.log('🔍 설정된 정책 확인 중...\n');
    const result = await client.query(`
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
    
    await client.end();
    console.log('✨ 모든 작업 완료!');
    console.log('\n📌 이제 파일 업로드 기능을 테스트할 수 있습니다.\n');
    
  } catch (error: any) {
    console.error('❌ 오류 발생:', error.message);
    console.error('   상세:', error);
    
    await client.end().catch(() => {});
    
    console.log('\n💡 수동 설정 방법:');
    console.log('   1. Supabase 대시보드 (https://app.supabase.com) 접속');
    console.log('   2. 프로젝트 선택 > SQL Editor > New query');
    console.log('   3. supabase/migrations/20250101000000_setup_storage_bucket_rls.sql 파일 내용 복사하여 실행\n');
    
    process.exit(1);
  }
}

setupStorageRLS().catch(console.error);
