/**
 * 현재 로그인한 사용자를 users 테이블에 추가하는 스크립트
 * 더미 데이터의 organization_id와 연결
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

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

async function main() {
  console.log('👤 테스트 사용자 생성 중...\n');

  try {
    // 1. 조직 ID 가져오기
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('name', 'VNTG Tech')
      .single();

    if (orgError || !org) {
      console.error('❌ 조직을 찾을 수 없습니다:', orgError?.message);
      process.exit(1);
    }

    const organizationId = org.id;
    console.log(`✅ 조직 ID: ${organizationId}\n`);

    // 2. auth.users에서 모든 사용자 가져오기 (Service Role Key 사용)
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.error('❌ 사용자 목록 조회 실패:', authError.message);
      process.exit(1);
    }

    if (!users || users.length === 0) {
      console.log('⚠️  auth.users에 사용자가 없습니다.');
      console.log('💡 먼저 Supabase 대시보드에서 사용자를 생성하거나 로그인하세요.\n');
      process.exit(1);
    }

    console.log(`📋 auth.users에 ${users.length}명의 사용자가 있습니다.\n`);

    // 3. 각 사용자를 users 테이블에 추가
    let createdCount = 0;
    let updatedCount = 0;

    for (const authUser of users) {
      // 이미 users 테이블에 있는지 확인
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('id', authUser.id)
        .single();

      if (existingUser) {
        // 이미 존재하면 organization_id 업데이트
        const { error: updateError } = await supabase
          .from('users')
          .update({ organization_id: organizationId })
          .eq('id', authUser.id);

        if (updateError) {
          console.log(`⚠️  사용자 업데이트 실패 (${authUser.email}):`, updateError.message);
        } else {
          console.log(`✅ 사용자 업데이트 완료: ${authUser.email}`);
          updatedCount++;
        }
      } else {
        // 새로 생성
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            id: authUser.id,
            email: authUser.email || 'unknown@example.com',
            organization_id: organizationId,
            role: 'admin',
          });

        if (insertError) {
          console.log(`⚠️  사용자 생성 실패 (${authUser.email}):`, insertError.message);
        } else {
          console.log(`✅ 사용자 생성 완료: ${authUser.email}`);
          createdCount++;
        }
      }
    }

    console.log(`\n✨ 완료!`);
    console.log(`   - 생성: ${createdCount}명`);
    console.log(`   - 업데이트: ${updatedCount}명`);
    console.log(`\n💡 이제 대시보드에서 더미 데이터를 확인할 수 있습니다.\n`);

  } catch (error: any) {
    console.error('❌ 오류 발생:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
