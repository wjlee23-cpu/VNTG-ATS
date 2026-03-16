/**
 * Service Role Key를 사용하여 Storage RLS 정책 설정
 * Postgres 직접 연결을 통해 storage.objects 테이블에 정책 설정
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

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.');
  process.exit(1);
}

async function setupStorageRLS() {
  console.log('🚀 Service Role Key를 사용한 Storage RLS 정책 설정 시작...\n');

  // SQL 파일 읽기
  const sqlFile = resolve(process.cwd(), 'supabase/migrations/20250101000000_setup_storage_bucket_rls.sql');
  const sql = readFileSync(sqlFile, 'utf-8');
  
  console.log(`📄 SQL 파일 로드 완료 (${(sql.length / 1024).toFixed(2)} KB)\n`);

  // 1. 먼저 Supabase 클라이언트로 bucket 확인
  console.log('1️⃣ Storage bucket 확인 중...');
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
  
  if (bucketError) {
    console.error(`   ❌ Bucket 목록 조회 실패: ${bucketError.message}`);
    process.exit(1);
  }

  const resumesBucket = buckets?.find(b => b.name === 'resumes');
  if (!resumesBucket) {
    console.error('   ❌ resumes bucket이 없습니다. 먼저 bucket을 생성하세요.');
    console.log('   💡 실행: npx tsx scripts/setup-storage-bucket.ts\n');
    process.exit(1);
  }

  console.log(`   ✅ resumes bucket 확인됨 (Public: ${resumesBucket.public})\n`);

  // 2. Postgres 직접 연결하여 RLS 정책 설정
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL이 설정되지 않았습니다.');
    process.exit(1);
  }

  console.log('2️⃣ Postgres 연결 중...');
  
  // DATABASE_URL 파싱
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

    console.log('3️⃣ Storage RLS 정책 설정 중...\n');
    
    // SQL을 개별 문장으로 분리하여 실행
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))
      .map(s => s + ';');

    console.log(`   📝 총 ${statements.length}개의 SQL 문장 실행 중...\n`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.length < 10) continue;

      try {
        await client.query(statement);
        console.log(`   ✅ 문장 ${i + 1}/${statements.length} 완료`);
      } catch (error: any) {
        // 이미 존재하는 정책은 무시
        if (error.message.includes('already exists') || 
            error.message.includes('duplicate') ||
            error.message.includes('IF EXISTS') ||
            error.message.includes('does not exist')) {
          console.log(`   ⚠️  문장 ${i + 1}/${statements.length} 스킵 (${error.message.split('\n')[0]})`);
        } else if (error.message.includes('must be owner')) {
          console.error(`   ❌ 문장 ${i + 1}/${statements.length} 실패: 권한 부족`);
          console.error(`      ${error.message}`);
          console.log('\n💡 Storage RLS 정책은 Supabase 대시보드에서만 설정할 수 있습니다.');
          console.log('   Storage > resumes bucket > Policies에서 수동으로 설정하세요.\n');
          break;
        } else {
          console.error(`   ❌ 문장 ${i + 1}/${statements.length} 실패: ${error.message}`);
        }
      }
    }

    // 정책 확인
    console.log('\n4️⃣ 설정된 정책 확인 중...\n');
    try {
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
        console.log('✨ Storage RLS 정책 설정 완료!');
        console.log('\n📌 이제 파일 업로드 기능을 테스트할 수 있습니다.\n');
      } else {
        console.log('⚠️  정책이 조회되지 않았습니다.');
        console.log('   Storage RLS 정책은 Supabase 대시보드에서 수동으로 설정해야 할 수 있습니다.\n');
      }
    } catch (checkError: any) {
      console.log('⚠️  정책 확인 중 오류:', checkError.message);
    }
    
    await client.end();
    
  } catch (error: any) {
    console.error('❌ 오류 발생:', error.message);
    
    if (error.message.includes('ENOTFOUND') || error.message.includes('connection')) {
      console.log('\n💡 연결 오류입니다. DATABASE_URL을 확인하세요.');
    } else if (error.message.includes('must be owner')) {
      console.log('\n💡 Storage RLS 정책은 Supabase 대시보드에서만 설정할 수 있습니다.');
      console.log('   Storage > resumes bucket > Policies에서 수동으로 설정하세요.\n');
    }
    
    await client.end().catch(() => {});
    process.exit(1);
  }
}

setupStorageRLS().catch(console.error);
