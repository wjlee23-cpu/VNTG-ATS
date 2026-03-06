/**
 * users 테이블에 name/avatar_url 컬럼이 실제로 반영되었는지 확인합니다.
 * - Service Role Key로 조회
 * - 컬럼이 없으면 select 시도에서 에러가 발생합니다.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

// 환경 변수 로드 (.env 우선, 없으면 .env.local)
config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 환경 변수가 설정되지 않았습니다.');
  console.error('   NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY를 확인해주세요.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function main() {
  console.log('🔎 users.name / users.avatar_url 반영 여부 확인 중...\n');

  // 1) 컬럼 존재 여부: 실제 select로 확인
  const { data: sample, error: sampleError } = await supabase
    .from('users')
    .select('id, email, name, avatar_url')
    .limit(3);

  if (sampleError) {
    console.error('❌ 조회 실패 (컬럼 미존재/권한 문제 가능):');
    console.error(`   - message: ${sampleError.message}`);
    console.error(`   - code: ${(sampleError as any).code || 'N/A'}`);
    process.exit(1);
  }

  console.log('✅ 컬럼 조회 성공! (샘플 3개)\n');
  console.log(sample);
  console.log('\n');

  // 2) name 업데이트 확인: name이 NULL인 사용자 수 카운트
  const { count: nullNameCount, error: nullNameError } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .is('name', null);

  if (nullNameError) {
    console.warn('⚠️ name NULL 카운트 조회 실패(치명적이지 않음):', nullNameError.message);
  } else {
    console.log(`📊 name이 NULL인 사용자 수: ${nullNameCount ?? 0}`);
  }

  console.log('\n🎉 확인 완료!');
}

main().catch((err) => {
  console.error('❌ 스크립트 실행 중 예외 발생:', err);
  process.exit(1);
});

