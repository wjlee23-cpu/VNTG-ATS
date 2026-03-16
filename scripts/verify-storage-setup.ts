/**
 * Storage Bucket 및 RLS 정책 확인 스크립트
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

// 환경 변수 로드
config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 환경 변수가 설정되지 않았습니다.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function verifyStorageSetup() {
  console.log('🔍 Storage 설정 확인 중...\n');

  // 1. Bucket 확인
  console.log('1️⃣ Storage Bucket 확인...');
  const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
  
  if (bucketError) {
    console.error(`   ❌ Bucket 목록 조회 실패: ${bucketError.message}\n`);
    return;
  }

  const resumesBucket = buckets?.find(b => b.name === 'resumes');
  if (resumesBucket) {
    console.log(`   ✅ resumes bucket이 존재합니다.`);
    console.log(`      - Public: ${resumesBucket.public}`);
    console.log(`      - Created: ${resumesBucket.created_at}\n`);
  } else {
    console.log(`   ❌ resumes bucket이 없습니다.\n`);
    console.log('   💡 bucket을 생성하려면: npx tsx scripts/setup-storage-bucket.ts\n');
    return;
  }

  // 2. RLS 정책 확인 (Postgres 직접 연결 필요)
  console.log('2️⃣ Storage RLS 정책 확인...');
  console.log('   ⚠️  RLS 정책은 Postgres 직접 연결로만 확인 가능합니다.\n');
  
  console.log('📋 Storage RLS 정책 설정 방법:\n');
  console.log('='.repeat(60));
  console.log('Storage RLS 정책은 Supabase 대시보드에서만 설정할 수 있습니다.');
  console.log('');
  console.log('설정 단계:');
  console.log('1. https://app.supabase.com 접속');
  console.log('2. 프로젝트 선택');
  console.log('3. 좌측 메뉴에서 "SQL Editor" 클릭');
  console.log('4. "New query" 버튼 클릭');
  console.log('5. 아래 SQL을 복사하여 실행:\n');
  console.log('='.repeat(60));
  
  const sqlFile = resolve(process.cwd(), 'supabase/migrations/20250101000000_setup_storage_bucket_rls.sql');
  const { readFileSync } = await import('fs');
  const sql = readFileSync(sqlFile, 'utf-8');
  console.log(sql);
  
  console.log('='.repeat(60));
  console.log('\n✨ SQL 실행 후 파일 업로드 기능을 테스트하세요.\n');
}

verifyStorageSetup().catch(console.error);
