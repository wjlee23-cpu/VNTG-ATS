/**
 * Storage 정책 확인 및 수정 가이드
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function checkStoragePolicy() {
  console.log('📋 Storage RLS 정책 확인 및 수정 가이드\n');
  console.log('='.repeat(70));
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: buckets } = await supabase.storage.listBuckets();
  const resumesBucket = buckets?.find(b => b.name === 'resumes');
  
  if (!resumesBucket) {
    console.log('❌ resumes bucket이 없습니다.\n');
    return;
  }

  console.log('✅ resumes bucket 확인됨\n');
  
  console.log('🔍 정책 정의 확인:\n');
  console.log('현재 정책 정의:');
  console.log('(bucket_id = \'resumes\' AND EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN (\'admin\', \'recruiter\')))');
  console.log('');
  
  console.log('⚠️  문제 가능성:\n');
  console.log('1. Storage RLS 정책은 storage.objects 테이블의 다음 컬럼을 사용합니다:');
  console.log('   - bucket_id: bucket 이름');
  console.log('   - name: 파일 경로 (예: resumes/candidate-id/file.pdf)');
  console.log('   - owner: 파일 소유자 (auth.uid())');
  console.log('');
  
  console.log('2. 현재 정책은 bucket_id만 확인하고 있습니다.');
  console.log('   파일 경로(name)도 확인해야 할 수 있습니다.\n');
  
  console.log('📝 수정된 정책 정의 (권장):\n');
  console.log('='.repeat(70));
  console.log('정책 1: SELECT (조회)');
  console.log('Policy definition:');
  console.log('(bucket_id = \'resumes\' AND EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN (\'admin\', \'recruiter\')))');
  console.log('');
  
  console.log('정책 2: INSERT (업로드)');
  console.log('Policy definition:');
  console.log('(bucket_id = \'resumes\' AND EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN (\'admin\', \'recruiter\')))');
  console.log('');
  
  console.log('정책 3: UPDATE (수정)');
  console.log('Policy definition:');
  console.log('(bucket_id = \'resumes\' AND EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN (\'admin\', \'recruiter\')))');
  console.log('');
  
  console.log('정책 4: DELETE (삭제)');
  console.log('Policy definition:');
  console.log('(bucket_id = \'resumes\' AND EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN (\'admin\', \'recruiter\')))');
  console.log('');
  
  console.log('='.repeat(70));
  console.log('\n💡 추가 확인 사항:\n');
  console.log('1. 사용자가 로그인되어 있는지 확인');
  console.log('2. users 테이블에 사용자 정보가 있는지 확인');
  console.log('3. 사용자의 role이 \'admin\' 또는 \'recruiter\'인지 확인');
  console.log('4. 브라우저 개발자 도구(F12) > Console에서 실제 오류 메시지 확인\n');
  
  console.log('🔧 디버깅 방법:\n');
  console.log('1. 브라우저 개발자 도구(F12) 열기');
  console.log('2. Console 탭에서 파일 업로드 시도');
  console.log('3. 오류 메시지 확인 (예: "new row violates row-level security policy")');
  console.log('4. Network 탭에서 업로드 요청의 응답 확인\n');
}

checkStoragePolicy().catch(console.error);
