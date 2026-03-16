/**
 * Storage 업로드 테스트 스크립트
 * 정책이 올바르게 작동하는지 확인
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

// 환경 변수 로드
config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
  console.error('❌ 필수 환경 변수가 설정되지 않았습니다.');
  process.exit(1);
}

async function testStorageUpload() {
  console.log('🔍 Storage 업로드 테스트 시작...\n');

  // 1. Service Role Key로 bucket 확인
  console.log('1️⃣ Service Role Key로 bucket 확인...');
  const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: buckets, error: bucketError } = await serviceClient.storage.listBuckets();
  
  if (bucketError) {
    console.error(`   ❌ Bucket 목록 조회 실패: ${bucketError.message}`);
    process.exit(1);
  }

  const resumesBucket = buckets?.find(b => b.name === 'resumes');
  if (!resumesBucket) {
    console.error('   ❌ resumes bucket이 없습니다.');
    process.exit(1);
  }

  console.log(`   ✅ resumes bucket 확인됨 (Public: ${resumesBucket.public})\n`);

  // 2. 정책 확인
  console.log('2️⃣ Storage 정책 확인...');
  console.log('   💡 Supabase 대시보드에서 다음을 확인하세요:');
  console.log('      - Storage > resumes bucket > Policies');
  console.log('      - SELECT, INSERT, UPDATE, DELETE 정책이 모두 있는지');
  console.log('      - 각 정책의 Policy definition이 올바른지\n');

  // 3. 테스트 파일 생성 및 업로드 (Service Role Key 사용)
  console.log('3️⃣ Service Role Key로 테스트 업로드 시도...');
  
  const testContent = new Blob(['Test file content'], { type: 'text/plain' });
  const testFileName = `test-${Date.now()}.txt`;
  const testPath = `test/${testFileName}`;

  const { data: uploadData, error: uploadError } = await serviceClient.storage
    .from('resumes')
    .upload(testPath, testContent, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    console.error(`   ❌ 업로드 실패: ${uploadError.message}`);
    console.error(`   코드: ${uploadError.statusCode || 'N/A'}`);
    
    if (uploadError.message.includes('new row violates row-level security policy')) {
      console.log('\n💡 RLS 정책 문제입니다.');
      console.log('   정책 정의를 확인하세요:\n');
      console.log('   (bucket_id = \'resumes\' AND EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN (\'admin\', \'recruiter\')))');
      console.log('\n   Service Role Key는 RLS를 우회하므로 이 오류가 나오면 정책에 문제가 있을 수 있습니다.');
    }
  } else {
    console.log(`   ✅ 업로드 성공: ${testPath}`);
    
    // 테스트 파일 삭제
    await serviceClient.storage.from('resumes').remove([testPath]);
    console.log('   ✅ 테스트 파일 삭제 완료\n');
  }

  // 4. Anon Key로 업로드 시도 (실제 사용자 시나리오)
  console.log('4️⃣ Anon Key로 업로드 시도 (실제 사용자 시나리오)...');
  console.log('   ⚠️  Anon Key는 인증된 사용자가 필요합니다.');
  console.log('   실제 애플리케이션에서 로그인한 사용자로 테스트해야 합니다.\n');

  console.log('📋 다음 단계:');
  console.log('   1. 애플리케이션에서 로그인 확인');
  console.log('   2. 파일 업로드 시도');
  console.log('   3. 브라우저 개발자 도구(F12) > Console에서 오류 메시지 확인');
  console.log('   4. Network 탭에서 업로드 요청의 응답 확인\n');

  console.log('💡 일반적인 문제:');
  console.log('   1. 사용자가 로그인하지 않음 → auth.uid()가 null');
  console.log('   2. users 테이블에 사용자 정보가 없음 → EXISTS 조건 실패');
  console.log('   3. 사용자 role이 \'admin\' 또는 \'recruiter\'가 아님');
  console.log('   4. 정책 정의에 오타가 있음\n');
}

testStorageUpload().catch(console.error);
