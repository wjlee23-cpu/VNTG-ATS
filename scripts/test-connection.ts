/**
 * Supabase 연결 테스트 스크립트
 * 환경 변수가 제대로 설정되어 있고 Supabase에 연결할 수 있는지 확인합니다.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

// 환경 변수 로드
config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function testConnection() {
  console.log('🔍 Supabase 연결 테스트 시작...\n');

  // 1. 환경 변수 확인
  console.log('1️⃣ 환경 변수 확인:');
  if (!supabaseUrl) {
    console.error('   ❌ NEXT_PUBLIC_SUPABASE_URL이 설정되지 않았습니다.');
    return false;
  }
  console.log(`   ✅ NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl.substring(0, 30)}...`);

  if (!supabaseAnonKey) {
    console.error('   ❌ NEXT_PUBLIC_SUPABASE_ANON_KEY가 설정되지 않았습니다.');
    return false;
  }
  console.log(`   ✅ NEXT_PUBLIC_SUPABASE_ANON_KEY: ${supabaseAnonKey.substring(0, 30)}...`);

  if (!supabaseServiceKey) {
    console.warn('   ⚠️  SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다. (선택사항)');
  } else {
    console.log(`   ✅ SUPABASE_SERVICE_ROLE_KEY: ${supabaseServiceKey.substring(0, 30)}...`);
  }

  console.log('\n');

  // 2. Anon Key로 연결 테스트
  console.log('2️⃣ Anon Key로 연결 테스트:');
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // 간단한 쿼리로 연결 테스트
    const { data, error } = await supabase
      .from('organizations')
      .select('id')
      .limit(1);

    if (error) {
      console.error(`   ❌ 연결 실패: ${error.message}`);
      console.error(`   코드: ${error.code || 'N/A'}`);
      return false;
    }

    console.log('   ✅ 연결 성공!');
    console.log(`   📊 organizations 테이블 조회 성공 (${data?.length || 0}개 결과)`);
  } catch (error: any) {
    console.error(`   ❌ 예외 발생: ${error.message}`);
    return false;
  }

  console.log('\n');

  // 3. Service Role Key로 연결 테스트 (있는 경우)
  if (supabaseServiceKey) {
    console.log('3️⃣ Service Role Key로 연결 테스트:');
    try {
      const supabaseService = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });

      const { data, error } = await supabaseService
        .from('organizations')
        .select('id')
        .limit(1);

      if (error) {
        console.error(`   ❌ 연결 실패: ${error.message}`);
        return false;
      }

      console.log('   ✅ 연결 성공!');
      console.log(`   📊 organizations 테이블 조회 성공 (${data?.length || 0}개 결과)`);
    } catch (error: any) {
      console.error(`   ❌ 예외 발생: ${error.message}`);
      return false;
    }
  }

  console.log('\n✨ 모든 연결 테스트 완료!\n');
  return true;
}

testConnection()
  .then((success) => {
    if (!success) {
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('❌ 테스트 중 오류 발생:', error);
    process.exit(1);
  });
