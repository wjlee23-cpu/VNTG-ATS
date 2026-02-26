/**
 * Service Role Key를 사용하여 직접 SQL 실행
 * auth.users의 모든 사용자를 users 테이블에 추가
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';
import { readFileSync } from 'fs';

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
  console.log('👤 사용자 추가 중...\n');

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

    // 2. auth.users에서 모든 사용자 가져오기
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.error('❌ 사용자 목록 조회 실패:', authError.message);
      console.log('\n💡 Supabase 대시보드 > SQL Editor에서 다음 SQL을 실행하세요:\n');
      console.log(readFileSync(resolve(process.cwd(), 'scripts/add-current-user-to-org.sql'), 'utf-8'));
      process.exit(1);
    }

    if (!users || users.length === 0) {
      console.log('⚠️  auth.users에 사용자가 없습니다.');
      console.log('💡 먼저 로그인하거나 Supabase 대시보드에서 사용자를 생성하세요.\n');
      console.log('📋 또는 Supabase 대시보드 > SQL Editor에서 다음 SQL을 실행하세요:\n');
      console.log(readFileSync(resolve(process.cwd(), 'scripts/add-current-user-to-org.sql'), 'utf-8'));
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
    console.log(`\n💡 이제 대시보드를 새로고침하면 더미 데이터를 확인할 수 있습니다.\n`);

    // 최종 확인
    const { data: finalUsers } = await supabase
      .from('users')
      .select('id, email, organization_id');

    console.log(`📊 users 테이블에 ${finalUsers?.length || 0}명의 사용자가 있습니다.`);

  } catch (error: any) {
    console.error('❌ 오류 발생:', error.message);
    console.log('\n💡 Supabase 대시보드 > SQL Editor에서 다음 SQL을 직접 실행하세요:\n');
    console.log(readFileSync(resolve(process.cwd(), 'scripts/add-current-user-to-org.sql'), 'utf-8'));
    process.exit(1);
  }
}

main().catch(console.error);
