/**
 * Users 테이블 RLS 무한 재귀 문제 수정 스크립트
 * Supabase에 직접 SQL을 실행하여 문제를 해결합니다.
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
  console.error('NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 확인하세요.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function fixUsersRLS() {
  console.log('🔧 Users 테이블 RLS 무한 재귀 문제 수정 중...\n');

  // 마이그레이션 파일 읽기
  const migrationFile = resolve(process.cwd(), 'supabase/migrations/20260228000000_fix_users_rls_recursion.sql');
  const sql = readFileSync(migrationFile, 'utf-8');

  console.log('📄 마이그레이션 SQL 로드 완료\n');

  // SQL을 문장 단위로 분리
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const statement of statements) {
    if (statement.length === 0) continue;

    try {
      console.log(`실행 중: ${statement.substring(0, 50)}...`);
      
      // Supabase는 직접 SQL 실행을 지원하지 않으므로, 
      // RPC 함수를 사용하거나 Management API를 사용해야 합니다.
      // 여기서는 간단하게 정책만 삭제/생성하는 방식으로 진행합니다.
      
      // DROP POLICY는 직접 실행할 수 없으므로, 
      // Supabase 대시보드에서 수동으로 실행하거나
      // 다른 방법을 사용해야 합니다.
      
      console.log('⚠️  Supabase는 직접 SQL 실행을 지원하지 않습니다.');
      console.log('   Supabase 대시보드 > SQL Editor에서 다음 SQL을 실행하세요:\n');
      console.log(sql);
      console.log('\n');
      
      break;
    } catch (error: any) {
      console.error(`❌ 실행 실패: ${error.message}`);
    }
  }
}

// 더 간단한 방법: 정책을 직접 삭제/생성
async function fixUsersRLSDirect() {
  console.log('🔧 Users 테이블 RLS 정책 직접 수정 중...\n');

  try {
    // 1. 문제가 되는 정책 삭제 시도
    console.log('1️⃣ 문제가 되는 정책 삭제 시도...');
    // Supabase JS 클라이언트로는 정책을 직접 삭제할 수 없으므로
    // SQL을 실행해야 합니다.
    
    console.log('\n⚠️  Supabase JS 클라이언트로는 RLS 정책을 직접 수정할 수 없습니다.');
    console.log('   다음 중 하나의 방법을 사용하세요:\n');
    console.log('   방법 1: Supabase 대시보드 사용');
    console.log('   1. https://app.supabase.com 접속');
    console.log('   2. 프로젝트 선택 > SQL Editor');
    console.log('   3. 다음 SQL 실행:\n');
    
    const fixSQL = `
-- 문제가 되는 정책 삭제 (무한 재귀 원인)
DROP POLICY IF EXISTS "Users can view own organization data" ON users;

-- 참고: 
-- - 기존 "Users can view own data" 정책(id = auth.uid())은 그대로 유지됩니다.
-- - 개발 환경에서는 Service Role Key를 사용하여 RLS를 우회합니다.
-- - 같은 조직의 다른 사용자들을 보려면 애플리케이션 레벨에서 처리하세요.
`;
    
    console.log(fixSQL);
    console.log('\n');
    console.log('   방법 2: Supabase CLI 사용');
    console.log('   supabase db push');
    console.log('\n');
    
  } catch (error: any) {
    console.error(`❌ 오류 발생: ${error.message}`);
  }
}

fixUsersRLSDirect().catch(console.error);
