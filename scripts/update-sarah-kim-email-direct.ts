import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

// 환경 변수 로드
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 환경 변수가 설정되지 않았습니다.');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅' : '❌');
  process.exit(1);
}

async function updateSarahKimEmail() {
  console.log('🚀 Sarah Kim의 이메일 업데이트 시작...\n');

  try {
    // Service Role Client 사용 (RLS 우회)
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 1. 현재 Sarah Kim 후보자 조회
    const { data: candidates, error: findError } = await supabase
      .from('candidates')
      .select('id, name, email')
      .eq('name', 'Sarah Kim')
      .like('email', 'candidate%@example.com');

    if (findError) {
      console.error('❌ 후보자 조회 실패:', findError.message);
      process.exit(1);
    }

    if (!candidates || candidates.length === 0) {
      console.log('⚠️  Sarah Kim 후보자를 찾을 수 없습니다.');
      console.log('   (이미 이메일이 변경되었거나 다른 이메일을 사용 중일 수 있습니다.)\n');
      
      // 모든 Sarah Kim 후보자 조회
      const { data: allSarahKim } = await supabase
        .from('candidates')
        .select('id, name, email')
        .eq('name', 'Sarah Kim');
      
      if (allSarahKim && allSarahKim.length > 0) {
        console.log('📋 현재 Sarah Kim 후보자 목록:');
        allSarahKim.forEach(c => {
          console.log(`   - ID: ${c.id}, Email: ${c.email}`);
        });
      }
      process.exit(0);
    }

    console.log(`📋 ${candidates.length}명의 Sarah Kim 후보자를 찾았습니다:\n`);
    candidates.forEach(c => {
      console.log(`   - ID: ${c.id}, 현재 이메일: ${c.email}`);
    });

    // 2. 이메일 업데이트
    const { data: updated, error: updateError } = await supabase
      .from('candidates')
      .update({ email: 'wjlee23@vntgcorp.com' })
      .eq('name', 'Sarah Kim')
      .like('email', 'candidate%@example.com')
      .select('id, name, email');

    if (updateError) {
      console.error('❌ 이메일 업데이트 실패:', updateError.message);
      process.exit(1);
    }

    console.log(`\n✅ ${updated?.length || 0}명의 후보자 이메일이 업데이트되었습니다:\n`);
    updated?.forEach(c => {
      console.log(`   - ID: ${c.id}, 이름: ${c.name}, 새 이메일: ${c.email}`);
    });

    console.log('\n✅ 완료!');
  } catch (error: any) {
    console.error('❌ 오류 발생:', error.message);
    process.exit(1);
  }
}

updateSarahKimEmail();
