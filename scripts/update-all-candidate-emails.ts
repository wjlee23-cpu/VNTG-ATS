import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

// 환경 변수 로드 (.env.local 또는 .env 파일 확인)
const envLocalPath = resolve(process.cwd(), '.env.local');
const envPath = resolve(process.cwd(), '.env');

if (require('fs').existsSync(envLocalPath)) {
  config({ path: envLocalPath, override: true });
} else if (require('fs').existsSync(envPath)) {
  config({ path: envPath, override: true });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 환경 변수가 설정되지 않았습니다.');
  console.error('NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 확인하세요.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function updateAllCandidateEmails() {
  console.log('🚀 모든 후보자의 이메일을 blee6291@gmail.com으로 업데이트 시작...\n');

  try {
    // 1. candidate@example.com 형식의 이메일을 가진 후보자 조회
    const { data: candidates, error: findError } = await supabase
      .from('candidates')
      .select('id, name, email')
      .like('email', 'candidate%@example.com');

    if (findError) {
      console.error('❌ 후보자 조회 실패:', findError.message);
      process.exit(1);
    }

    if (!candidates || candidates.length === 0) {
      console.log('⚠️  candidate@example.com 형식의 이메일을 가진 후보자를 찾을 수 없습니다.');
      console.log('   (이미 이메일이 변경되었거나 다른 이메일을 사용 중일 수 있습니다.)\n');
      
      // 모든 후보자 조회하여 현재 상태 확인
      const { data: allCandidates } = await supabase
        .from('candidates')
        .select('id, name, email')
        .limit(10);
      
      if (allCandidates && allCandidates.length > 0) {
        console.log('📋 현재 후보자 샘플 (최대 10명):');
        allCandidates.forEach(c => {
          console.log(`   - ID: ${c.id}, 이름: ${c.name}, 이메일: ${c.email}`);
        });
      }
      process.exit(0);
    }

    console.log(`📋 ${candidates.length}명의 후보자를 찾았습니다:\n`);
    candidates.slice(0, 10).forEach(c => {
      console.log(`   - ID: ${c.id}, 이름: ${c.name}, 현재 이메일: ${c.email}`);
    });
    if (candidates.length > 10) {
      console.log(`   ... 외 ${candidates.length - 10}명`);
    }

    // 2. 이메일 업데이트
    const { data: updated, error: updateError } = await supabase
      .from('candidates')
      .update({ email: 'blee6291@gmail.com' })
      .like('email', 'candidate%@example.com')
      .select('id, name, email');

    if (updateError) {
      console.error('❌ 이메일 업데이트 실패:', updateError.message);
      process.exit(1);
    }

    console.log(`\n✅ ${updated?.length || 0}명의 후보자 이메일이 업데이트되었습니다:\n`);
    updated?.slice(0, 10).forEach(c => {
      console.log(`   - ID: ${c.id}, 이름: ${c.name}, 새 이메일: ${c.email}`);
    });
    if (updated && updated.length > 10) {
      console.log(`   ... 외 ${updated.length - 10}명`);
    }

    // 3. 업데이트 결과 확인
    const { data: verifyData, error: verifyError } = await supabase
      .from('candidates')
      .select('id, email')
      .eq('email', 'blee6291@gmail.com');

    if (!verifyError && verifyData) {
      console.log(`\n📊 총 ${verifyData.length}명의 후보자가 blee6291@gmail.com 이메일을 사용 중입니다.`);
    }

    console.log('\n✅ 완료!');
  } catch (error: any) {
    console.error('❌ 오류 발생:', error.message);
    process.exit(1);
  }
}

updateAllCandidateEmails();
