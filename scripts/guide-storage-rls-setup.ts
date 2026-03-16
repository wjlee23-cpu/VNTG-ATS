/**
 * Storage RLS 정책 설정 가이드
 * 사용자가 쉽게 따라할 수 있도록 단계별 안내 제공
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

// 환경 변수 로드
config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function guideStorageRLSSetup() {
  console.log('📋 Storage RLS 정책 설정 가이드\n');
  console.log('='.repeat(70));
  console.log('⚠️  Storage RLS 정책은 Supabase 대시보드에서만 설정할 수 있습니다.');
  console.log('   하지만 걱정하지 마세요! 아래 단계를 따라하면 5분 안에 완료됩니다.\n');
  console.log('='.repeat(70));
  
  // Storage bucket 확인
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: buckets } = await supabase.storage.listBuckets();
  const resumesBucket = buckets?.find(b => b.name === 'resumes');
  
  if (!resumesBucket) {
    console.log('❌ resumes bucket이 없습니다. 먼저 bucket을 생성하세요.\n');
    return;
  }

  console.log(`✅ resumes bucket 확인됨 (Public: ${resumesBucket.public})\n`);
  
  console.log('📝 설정 단계:\n');
  console.log('1️⃣  Supabase 대시보드 접속');
  console.log('   → https://app.supabase.com\n');
  
  console.log('2️⃣  프로젝트 선택');
  console.log(`   → 프로젝트 ID: ${supabaseUrl.split('//')[1].split('.')[0]}\n`);
  
  console.log('3️⃣  Storage 메뉴로 이동');
  console.log('   → 좌측 메뉴에서 "Storage" 클릭\n');
  
  console.log('4️⃣  resumes bucket 선택');
  console.log('   → "resumes" bucket 클릭\n');
  
  console.log('5️⃣  Policies 탭 클릭');
  console.log('   → "Policies" 탭 선택\n');
  
  console.log('6️⃣  정책 추가 (총 4개)');
  console.log('   → "New Policy" 또는 "Add Policy" 버튼 클릭\n');
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📌 정책 1: SELECT (파일 조회)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Policy name: Recruiters can view resumes');
  console.log('Allowed operation: SELECT');
  console.log('Policy definition (복사해서 붙여넣기):');
  console.log('');
  console.log('(bucket_id = \'resumes\' AND EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN (\'admin\', \'recruiter\')))');
  console.log('');
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📌 정책 2: INSERT (파일 업로드)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Policy name: Recruiters can upload resumes');
  console.log('Allowed operation: INSERT');
  console.log('Policy definition (복사해서 붙여넣기):');
  console.log('');
  console.log('(bucket_id = \'resumes\' AND EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN (\'admin\', \'recruiter\')))');
  console.log('');
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📌 정책 3: UPDATE (파일 수정)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Policy name: Recruiters can update resumes');
  console.log('Allowed operation: UPDATE');
  console.log('Policy definition (복사해서 붙여넣기):');
  console.log('');
  console.log('(bucket_id = \'resumes\' AND EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN (\'admin\', \'recruiter\')))');
  console.log('');
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📌 정책 4: DELETE (파일 삭제)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Policy name: Recruiters can delete resumes');
  console.log('Allowed operation: DELETE');
  console.log('Policy definition (복사해서 붙여넣기):');
  console.log('');
  console.log('(bucket_id = \'resumes\' AND EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN (\'admin\', \'recruiter\')))');
  console.log('');
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✨ 완료!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('모든 정책을 추가한 후 파일 업로드 기능을 테스트하세요.\n');
  console.log('💡 팁: 각 정책의 Policy definition은 모두 동일합니다.');
  console.log('   복사해서 붙여넣기만 하면 됩니다!\n');
}

guideStorageRLSSetup().catch(console.error);
