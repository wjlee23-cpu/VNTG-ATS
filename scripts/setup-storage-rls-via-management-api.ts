/**
 * Supabase Management API를 통한 Storage RLS 정책 설정 시도
 * Management API를 사용하여 정책 설정
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

// 환경 변수 로드
config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
const projectId = process.env.SUPABASE_PROJECT_ID;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 필수 환경 변수가 설정되지 않았습니다.');
  process.exit(1);
}

async function setupStorageRLSViaManagementAPI() {
  console.log('🚀 Supabase Management API를 통한 Storage RLS 정책 설정 시도...\n');

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

  // 2. Management API를 통한 SQL 실행 시도
  if (accessToken && projectId) {
    console.log('2️⃣ Supabase Management API를 통한 정책 설정 시도...\n');
    
    const sqlFile = resolve(process.cwd(), 'supabase/migrations/20250101000000_setup_storage_bucket_rls.sql');
    const sql = readFileSync(sqlFile, 'utf-8');
    
    // Management API를 통한 SQL 실행
    // 참고: Supabase Management API는 SQL 실행을 직접 지원하지 않을 수 있습니다.
    try {
      const response = await fetch(`https://api.supabase.com/v1/projects/${projectId}/database/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: sql,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('   ✅ Management API를 통한 정책 설정 성공!\n');
        console.log('✨ Storage RLS 정책 설정 완료!\n');
        return;
      } else {
        const error = await response.text();
        console.log(`   ⚠️  Management API 호출 실패: ${response.status}`);
        console.log(`   ${error}\n`);
      }
    } catch (error: any) {
      console.log(`   ⚠️  Management API 호출 중 오류: ${error.message}\n`);
    }
  }

  // 3. 대안: Supabase 대시보드에서 수동 설정 안내
  console.log('3️⃣ Storage RLS 정책 설정 방법 안내\n');
  console.log('⚠️  Storage RLS 정책은 Supabase 대시보드에서만 설정할 수 있습니다.');
  console.log('   프로그래밍 방식으로는 제한이 있습니다.\n');
  
  console.log('📋 다음 단계를 따라주세요:\n');
  console.log('='.repeat(60));
  console.log('방법 1: Storage Policies UI 사용 (가장 쉬움)');
  console.log('='.repeat(60));
  console.log('1. https://app.supabase.com 접속');
  console.log('2. 프로젝트 선택');
  console.log('3. 좌측 메뉴에서 "Storage" 클릭');
  console.log('4. "resumes" bucket 클릭');
  console.log('5. "Policies" 탭 클릭');
  console.log('6. "New Policy" 버튼 클릭');
  console.log('7. 아래 정책들을 하나씩 추가:\n');
  
  console.log('정책 1: SELECT (조회)');
  console.log('  - Policy name: Recruiters can view resumes');
  console.log('  - Allowed operation: SELECT');
  console.log('  - Policy definition:');
  console.log('    (bucket_id = \'resumes\' AND EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN (\'admin\', \'recruiter\')))');
  console.log('');
  
  console.log('정책 2: INSERT (업로드)');
  console.log('  - Policy name: Recruiters can upload resumes');
  console.log('  - Allowed operation: INSERT');
  console.log('  - Policy definition:');
  console.log('    (bucket_id = \'resumes\' AND EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN (\'admin\', \'recruiter\')))');
  console.log('');
  
  console.log('정책 3: UPDATE (수정)');
  console.log('  - Policy name: Recruiters can update resumes');
  console.log('  - Allowed operation: UPDATE');
  console.log('  - Policy definition:');
  console.log('    (bucket_id = \'resumes\' AND EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN (\'admin\', \'recruiter\')))');
  console.log('');
  
  console.log('정책 4: DELETE (삭제)');
  console.log('  - Policy name: Recruiters can delete resumes');
  console.log('  - Allowed operation: DELETE');
  console.log('  - Policy definition:');
  console.log('    (bucket_id = \'resumes\' AND EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN (\'admin\', \'recruiter\')))');
  console.log('');
  
  console.log('='.repeat(60));
  console.log('방법 2: SQL Editor 사용 (고급)');
  console.log('='.repeat(60));
  console.log('1. https://app.supabase.com 접속');
  console.log('2. 프로젝트 선택 > SQL Editor');
  console.log('3. 아래 SQL 복사하여 실행:\n');
  
  const sqlFile = resolve(process.cwd(), 'supabase/migrations/20250101000000_setup_storage_bucket_rls.sql');
  const sql = readFileSync(sqlFile, 'utf-8');
  console.log(sql);
  
  console.log('\n' + '='.repeat(60));
  console.log('✨ 정책 설정 후 파일 업로드 기능을 테스트하세요.\n');
}

setupStorageRLSViaManagementAPI().catch(console.error);
