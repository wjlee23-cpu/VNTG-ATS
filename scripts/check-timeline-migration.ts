/**
 * 타임라인 이벤트 타입 마이그레이션 확인 스크립트
 * 
 * 사용법:
 *   npx tsx scripts/check-timeline-migration.ts
 * 
 * 또는:
 *   npm run check-timeline-migration
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// .env.local 파일 로드
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 환경 변수가 설정되지 않았습니다.');
  console.error('필요한 환경 변수:');
  console.error('  - NEXT_PUBLIC_SUPABASE_URL');
  console.error('  - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function checkMigration() {
  console.log('🔍 타임라인 이벤트 타입 마이그레이션 확인 중...\n');

  try {
    // 1. 제약 조건 확인
    console.log('1. 제약 조건 확인 중...');
    const { data: constraintData, error: constraintError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT 
          conname as constraint_name,
          pg_get_constraintdef(oid) as constraint_definition
        FROM pg_constraint
        WHERE conrelid = 'timeline_events'::regclass
        AND conname = 'timeline_events_type_check';
      `,
    });

    if (constraintError) {
      console.log('   직접 쿼리로 확인 시도...');
      // RPC가 없으면 직접 테스트
    }

    // 2. 허용된 타입 목록 확인 (실제 테스트)
    console.log('\n2. 허용된 타입 테스트 중...');
    const requiredTypes = [
      'email_received',
      'interviewer_response',
      'schedule_regenerated',
    ];

    const { data: testCandidate } = await supabase
      .from('candidates')
      .select('id')
      .limit(1)
      .single();

    if (!testCandidate) {
      console.error('❌ 테스트할 후보자가 없습니다.');
      return;
    }

    const testResults: Record<string, { allowed: boolean; error?: string }> = {};

    for (const type of requiredTypes) {
      try {
        const { error } = await supabase
          .from('timeline_events')
          .insert({
            candidate_id: testCandidate.id,
            type,
            content: { test: true, migration_check: true },
            created_by: null,
          })
          .select()
          .limit(0);

        if (error) {
          testResults[type] = {
            allowed: false,
            error: `${error.code}: ${error.message}`,
          };
        } else {
          testResults[type] = { allowed: true };
        }
      } catch (error: any) {
        testResults[type] = {
          allowed: false,
          error: error.message || '알 수 없는 오류',
        };
      }
    }

    // 테스트 이벤트 삭제
    await supabase
      .from('timeline_events')
      .delete()
      .eq('candidate_id', testCandidate.id)
      .eq('content->>migration_check', 'true');

    // 3. 결과 출력
    console.log('\n📊 테스트 결과:');
    let allPassed = true;
    for (const [type, result] of Object.entries(testResults)) {
      if (result.allowed) {
        console.log(`   ✅ ${type}: 허용됨`);
      } else {
        console.log(`   ❌ ${type}: 허용되지 않음`);
        console.log(`      에러: ${result.error}`);
        allPassed = false;
      }
    }

    if (!allPassed) {
      console.log('\n⚠️  마이그레이션이 적용되지 않은 것으로 보입니다.');
      console.log('   마이그레이션 파일: supabase/migrations/20260225000000_extend_timeline_event_types.sql');
      console.log('   Supabase 대시보드에서 마이그레이션을 적용하세요.');
    } else {
      console.log('\n✅ 모든 타입이 허용되고 있습니다. 마이그레이션이 정상적으로 적용되었습니다.');
    }

    // 4. 현재 타임라인 이벤트 개수 확인
    console.log('\n3. 현재 타임라인 이벤트 통계:');
    const { count, error: countError } = await supabase
      .from('timeline_events')
      .select('*', { count: 'exact', head: true });

    if (!countError) {
      console.log(`   전체 이벤트 개수: ${count || 0}`);

      // 타입별 개수
      const { data: typeData } = await supabase
        .from('timeline_events')
        .select('type');

      if (typeData) {
        const typeCounts: Record<string, number> = {};
        typeData.forEach(event => {
          typeCounts[event.type] = (typeCounts[event.type] || 0) + 1;
        });

        console.log('\n   타입별 개수:');
        Object.entries(typeCounts)
          .sort((a, b) => b[1] - a[1])
          .forEach(([type, count]) => {
            console.log(`     ${type}: ${count}개`);
          });
      }
    }
  } catch (error: any) {
    console.error('❌ 오류 발생:', error.message);
    process.exit(1);
  }
}

checkMigration()
  .then(() => {
    console.log('\n✅ 확인 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 스크립트 실행 실패:', error);
    process.exit(1);
  });
