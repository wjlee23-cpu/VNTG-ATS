/**
 * Supabase Management API를 통한 Storage RLS 정책 설정
 * 
 * 사용 방법:
 *   npx tsx scripts/setup-storage-rls-via-api.ts
 * 
 * 환경 변수 필요:
 *   - SUPABASE_ACCESS_TOKEN
 *   - SUPABASE_PROJECT_ID
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { readFileSync } from 'fs';

// 환경 변수 로드
config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local') });

const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
const projectId = process.env.SUPABASE_PROJECT_ID;

if (!accessToken || !projectId) {
  console.error('❌ SUPABASE_ACCESS_TOKEN 또는 SUPABASE_PROJECT_ID가 설정되지 않았습니다.');
  process.exit(1);
}

async function setupStorageRLSViaAPI() {
  console.log('🚀 Supabase Management API를 통한 Storage RLS 정책 설정 시작...\n');

  // SQL 파일 읽기
  const sqlFile = resolve(process.cwd(), 'supabase/migrations/20250101000000_setup_storage_bucket_rls.sql');
  const sql = readFileSync(sqlFile, 'utf-8');
  
  console.log(`📄 SQL 파일 로드 완료 (${(sql.length / 1024).toFixed(2)} KB)\n`);

  try {
    // Supabase Management API를 통한 SQL 실행
    // 참고: Management API는 SQL 실행을 직접 지원하지 않으므로,
    // Supabase 대시보드의 SQL Editor를 사용하거나 Postgres 직접 연결이 필요합니다.
    
    console.log('⚠️  Supabase Management API는 SQL 실행을 직접 지원하지 않습니다.');
    console.log('💡 대신 Supabase 클라이언트를 사용하여 RLS 정책을 확인하고,');
    console.log('   SQL은 Supabase 대시보드에서 실행하거나 Postgres 직접 연결을 사용하세요.\n');
    
    // Supabase 클라이언트로 bucket 확인
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (supabaseUrl && supabaseServiceKey) {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });

      // Bucket 확인
      console.log('🔍 Storage bucket 확인 중...\n');
      const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
      
      if (bucketError) {
        console.error('❌ Bucket 목록 조회 실패:', bucketError.message);
      } else {
        const resumesBucket = buckets?.find(b => b.name === 'resumes');
        if (resumesBucket) {
          console.log('✅ resumes bucket이 존재합니다.');
          console.log(`   - Public: ${resumesBucket.public}`);
          console.log(`   - Created: ${resumesBucket.created_at}\n`);
        } else {
          console.log('⚠️  resumes bucket이 없습니다. 먼저 bucket을 생성하세요.\n');
        }
      }
    }

    console.log('📋 다음 SQL을 Supabase 대시보드에서 실행하세요:\n');
    console.log('='.repeat(60));
    console.log('1. https://app.supabase.com 접속');
    console.log('2. 프로젝트 선택 > SQL Editor > New query');
    console.log('3. 아래 SQL 복사하여 실행\n');
    console.log('='.repeat(60));
    console.log(sql);
    console.log('='.repeat(60));
    console.log('\n✨ 설정 완료 후 파일 업로드 기능을 테스트하세요.\n');
    
  } catch (error: any) {
    console.error('❌ 오류 발생:', error.message);
    process.exit(1);
  }
}

setupStorageRLSViaAPI().catch(console.error);
