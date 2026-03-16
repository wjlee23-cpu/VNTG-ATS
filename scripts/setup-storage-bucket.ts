/**
 * Supabase Storage Bucket 생성 스크립트
 * 프로덕션 환경에서 resumes bucket을 생성하고 RLS 정책을 설정합니다.
 * 
 * 사용 방법:
 *   npx tsx scripts/setup-storage-bucket.ts
 * 
 * 환경 변수 필요:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY (bucket 생성 및 RLS 정책 설정에 필요)
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

// 환경 변수 로드
config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const BUCKET_NAME = 'resumes';

async function setupStorageBucket() {
  console.log('🚀 Supabase Storage Bucket 설정 시작...\n');

  // 1. 환경 변수 확인
  if (!supabaseUrl) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL이 설정되지 않았습니다.');
    process.exit(1);
  }

  if (!supabaseServiceKey) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.');
    console.error('   Storage bucket 생성 및 RLS 정책 설정에는 Service Role Key가 필요합니다.');
    process.exit(1);
  }

  // Service Role Key로 Supabase 클라이언트 생성
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    // 2. 기존 bucket 확인
    console.log(`1️⃣ '${BUCKET_NAME}' bucket 존재 여부 확인...`);
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error(`   ❌ Bucket 목록 조회 실패: ${listError.message}`);
      process.exit(1);
    }

    const existingBucket = buckets?.find(bucket => bucket.name === BUCKET_NAME);
    
    if (existingBucket) {
      console.log(`   ✅ '${BUCKET_NAME}' bucket이 이미 존재합니다.`);
      console.log(`   📋 Bucket 정보:`);
      console.log(`      - Public: ${existingBucket.public}`);
      console.log(`      - Created: ${existingBucket.created_at}`);
    } else {
      // 3. Bucket 생성
      console.log(`2️⃣ '${BUCKET_NAME}' bucket 생성 중...`);
      const { data: bucketData, error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
        public: false, // Private bucket (이력서는 민감 정보이므로)
        fileSizeLimit: 52428800, // 50MB (바이트 단위)
        allowedMimeTypes: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ],
      });

      if (createError) {
        console.error(`   ❌ Bucket 생성 실패: ${createError.message}`);
        process.exit(1);
      }

      console.log(`   ✅ '${BUCKET_NAME}' bucket 생성 완료!`);
    }

    // 4. RLS 정책 설정 (SQL 사용)
    console.log(`\n3️⃣ Storage RLS 정책 설정 중...`);
    
    // Storage RLS 정책은 SQL로 설정해야 합니다
    const rlsPolicies = [
      // SELECT 정책: 리크루터 이상 권한만 조회 가능
      `CREATE POLICY IF NOT EXISTS "Recruiters can view resumes" ON storage.objects
        FOR SELECT
        USING (
          bucket_id = '${BUCKET_NAME}' AND
          EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role IN ('admin', 'recruiter')
          )
        );`,
      
      // INSERT 정책: 리크루터 이상 권한만 업로드 가능
      `CREATE POLICY IF NOT EXISTS "Recruiters can upload resumes" ON storage.objects
        FOR INSERT
        WITH CHECK (
          bucket_id = '${BUCKET_NAME}' AND
          EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role IN ('admin', 'recruiter')
          )
        );`,
      
      // UPDATE 정책: 리크루터 이상 권한만 수정 가능
      `CREATE POLICY IF NOT EXISTS "Recruiters can update resumes" ON storage.objects
        FOR UPDATE
        USING (
          bucket_id = '${BUCKET_NAME}' AND
          EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role IN ('admin', 'recruiter')
          )
        )
        WITH CHECK (
          bucket_id = '${BUCKET_NAME}' AND
          EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role IN ('admin', 'recruiter')
          )
        );`,
      
      // DELETE 정책: 리크루터 이상 권한만 삭제 가능
      `CREATE POLICY IF NOT EXISTS "Recruiters can delete resumes" ON storage.objects
        FOR DELETE
        USING (
          bucket_id = '${BUCKET_NAME}' AND
          EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role IN ('admin', 'recruiter')
          )
        );`,
    ];

    // SQL 실행을 위해 RPC 또는 직접 SQL 실행
    // Supabase JS 클라이언트는 직접 SQL을 실행할 수 없으므로,
    // Supabase 대시보드의 SQL Editor에서 실행하거나 Management API를 사용해야 합니다.
    
    console.log(`   ⚠️  Storage RLS 정책은 Supabase 대시보드의 SQL Editor에서 수동으로 설정해야 합니다.`);
    console.log(`   📝 다음 SQL을 Supabase 대시보드 > SQL Editor에서 실행하세요:\n`);
    
    console.log('-- ============================================');
    console.log('-- Storage RLS 정책 설정');
    console.log('-- ============================================\n');
    
    rlsPolicies.forEach((policy, index) => {
      console.log(`-- 정책 ${index + 1}:`);
      console.log(policy);
      console.log('');
    });

    console.log('\n✨ Storage Bucket 설정 완료!\n');
    console.log('📌 다음 단계:');
    console.log('   1. Supabase 대시보드 (https://app.supabase.com) 접속');
    console.log('   2. 프로젝트 선택');
    console.log('   3. 좌측 메뉴에서 "SQL Editor" 클릭');
    console.log('   4. 위의 SQL 정책들을 복사하여 실행');
    console.log('   5. 파일 업로드 기능 테스트\n');

  } catch (error: any) {
    console.error('❌ 오류 발생:', error.message);
    process.exit(1);
  }
}

setupStorageBucket()
  .catch((error) => {
    console.error('❌ 스크립트 실행 중 오류 발생:', error);
    process.exit(1);
  });
