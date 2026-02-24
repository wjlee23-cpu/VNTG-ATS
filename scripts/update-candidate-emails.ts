/**
 * 모든 지원자의 이메일 주소를 테스트용 이메일로 일괄 변경하는 스크립트
 * 
 * 사용법:
 * npx tsx scripts/update-candidate-emails.ts
 * 
 * 또는:
 * npm run update-emails
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
  console.log('🚀 모든 지원자 이메일 업데이트 시작...\n');
  console.log(`🔗 연결: ${supabaseUrl}\n`);

  const targetEmail = 'blee6291@gmail.com';

  try {
    // 먼저 현재 지원자 수 확인
    const { count: beforeCount } = await supabase
      .from('candidates')
      .select('*', { count: 'exact', head: true });

    console.log(`📊 현재 지원자 수: ${beforeCount || 0}명\n`);

    if (beforeCount === 0) {
      console.log('⚠️  업데이트할 지원자가 없습니다.');
      return;
    }

    // 모든 지원자의 이메일 업데이트
    console.log(`📝 모든 지원자의 이메일을 "${targetEmail}"로 변경 중...\n`);

    // 모든 지원자 ID 가져오기
    const { data: allCandidates, error: fetchError } = await supabase
      .from('candidates')
      .select('id');

    if (fetchError) {
      throw fetchError;
    }

    if (!allCandidates || allCandidates.length === 0) {
      console.log('⚠️  업데이트할 지원자가 없습니다.');
      return;
    }

    console.log(`   - 총 ${allCandidates.length}명의 지원자 발견\n`);

    // 배치로 업데이트 (한 번에 100개씩)
    const batchSize = 100;
    let updatedCount = 0;

    for (let i = 0; i < allCandidates.length; i += batchSize) {
      const batch = allCandidates.slice(i, i + batchSize);
      const batchIds = batch.map(c => c.id);

      const { error: updateError, count } = await supabase
        .from('candidates')
        .update({ email: targetEmail })
        .in('id', batchIds)
        .select('id', { count: 'exact' });

      if (updateError) {
        throw updateError;
      }

      updatedCount += count || batch.length;
      console.log(`   - 진행 중: ${Math.min(i + batchSize, allCandidates.length)}/${allCandidates.length}명 업데이트 완료`);
    }

    console.log(`\n✅ 업데이트 완료!`);
    console.log(`   - 변경된 지원자 수: ${updatedCount}명`);
    console.log(`   - 새로운 이메일: ${targetEmail}\n`);

    // 변경 확인
    const { count: afterCount } = await supabase
      .from('candidates')
      .select('*', { count: 'exact', head: true })
      .eq('email', targetEmail);

    console.log(`📊 확인: ${afterCount || 0}명의 지원자가 "${targetEmail}" 이메일을 사용 중입니다.\n`);

  } catch (error) {
    console.error('❌ 오류 발생:', error);
    if (error instanceof Error) {
      console.error('   메시지:', error.message);
    }
    process.exit(1);
  }
}

// 실행
updateAllCandidateEmails();
