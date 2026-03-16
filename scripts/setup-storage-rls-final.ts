/**
 * Service Role Key를 사용하여 Storage RLS 정책 설정 (최종 버전)
 * 전체 SQL을 한 번에 실행하여 정책 설정
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';

// 환경 변수 로드
config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const databaseUrl = process.env.DATABASE_URL;

if (!supabaseUrl || !supabaseServiceKey || !databaseUrl) {
  console.error('❌ 필수 환경 변수가 설정되지 않았습니다.');
  process.exit(1);
}

async function setupStorageRLS() {
  console.log('🚀 Storage RLS 정책 설정 시작...\n');

  // 1. Storage bucket 확인
  console.log('1️⃣ Storage bucket 확인 중...');
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: buckets } = await supabase.storage.listBuckets();
  const resumesBucket = buckets?.find(b => b.name === 'resumes');
  
  if (!resumesBucket) {
    console.error('   ❌ resumes bucket이 없습니다.');
    process.exit(1);
  }
  console.log(`   ✅ resumes bucket 확인됨\n`);

  // 2. Postgres 연결
  console.log('2️⃣ Postgres 연결 중...');
  const match = databaseUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  
  if (!match) {
    console.error('❌ DATABASE_URL 형식이 올바르지 않습니다.');
    process.exit(1);
  }

  const [, user, password, host, port, database] = match;
  
  const client = new Client({
    host: host,
    port: parseInt(port),
    database: database,
    user: decodeURIComponent(user),
    password: decodeURIComponent(password),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  try {
    await client.connect();
    console.log('   ✅ Postgres 연결 성공!\n');

    // 3. SQL 실행
    console.log('3️⃣ Storage RLS 정책 설정 중...\n');
    
    // SQL 파일 읽기
    const sqlFile = resolve(process.cwd(), 'supabase/migrations/20250101000000_setup_storage_bucket_rls.sql');
    const sql = readFileSync(sqlFile, 'utf-8');
    
    // 전체 SQL을 한 번에 실행
    try {
      await client.query(sql);
      console.log('   ✅ SQL 실행 완료!\n');
    } catch (error: any) {
      if (error.message.includes('must be owner')) {
        console.error('   ❌ 권한 부족: storage.objects 테이블에 대한 소유자 권한이 필요합니다.');
        console.log('\n💡 Storage RLS 정책은 Supabase 대시보드에서만 설정할 수 있습니다.');
        console.log('   다음 단계를 따라주세요:\n');
        console.log('   1. https://app.supabase.com 접속');
        console.log('   2. 프로젝트 선택');
        console.log('   3. Storage > resumes bucket > Policies');
        console.log('   4. 각 정책을 수동으로 추가\n');
        process.exit(1);
      } else {
        throw error;
      }
    }

    // 4. 정책 확인
    console.log('4️⃣ 설정된 정책 확인 중...\n');
    const result = await client.query(`
      SELECT 
        policyname,
        cmd
      FROM pg_policies 
      WHERE schemaname = 'storage' 
      AND tablename = 'objects'
      AND (policyname LIKE '%resumes%' OR policyname LIKE '%Recruiters%')
      ORDER BY policyname;
    `);
    
    if (result.rows.length > 0) {
      console.log('📋 설정된 정책 목록:');
      result.rows.forEach((row, index) => {
        console.log(`   ${index + 1}. ${row.policyname} (${row.cmd})`);
      });
      console.log('\n✨ Storage RLS 정책 설정 완료!');
      console.log('📌 이제 파일 업로드 기능을 테스트할 수 있습니다.\n');
    } else {
      // 다른 방법으로 확인 시도
      console.log('⚠️  pg_policies에서 정책을 찾을 수 없습니다.');
      console.log('   Supabase 대시보드에서 정책이 설정되었는지 확인하세요.\n');
      
      // Supabase 클라이언트로 파일 업로드 테스트 가능 여부 확인
      console.log('💡 파일 업로드 기능을 직접 테스트해보세요.');
      console.log('   정책이 제대로 설정되지 않았다면 업로드 시 권한 오류가 발생합니다.\n');
    }
    
    await client.end();
    
  } catch (error: any) {
    console.error('❌ 오류 발생:', error.message);
    await client.end().catch(() => {});
    process.exit(1);
  }
}

setupStorageRLS().catch(console.error);
