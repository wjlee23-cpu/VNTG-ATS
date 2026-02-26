/**
 * 생성된 데이터 확인 스크립트
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
  console.log('📊 생성된 데이터 확인 중...\n');

  try {
    // 각 테이블의 데이터 개수 확인
    const [orgs, processes, jobs, candidates, schedules, scheduleOptions, timelineEvents] = await Promise.all([
      supabase.from('organizations').select('id', { count: 'exact', head: true }),
      supabase.from('processes').select('id', { count: 'exact', head: true }),
      supabase.from('job_posts').select('id', { count: 'exact', head: true }),
      supabase.from('candidates').select('id', { count: 'exact', head: true }),
      supabase.from('schedules').select('id', { count: 'exact', head: true }),
      supabase.from('schedule_options').select('id', { count: 'exact', head: true }),
      supabase.from('timeline_events').select('id', { count: 'exact', head: true }),
    ]);

    console.log('✅ 생성된 데이터:');
    console.log(`   - Organizations: ${orgs.count || 0}개`);
    console.log(`   - Processes: ${processes.count || 0}개`);
    console.log(`   - Job Posts: ${jobs.count || 0}개`);
    console.log(`   - Candidates: ${candidates.count || 0}개`);
    console.log(`   - Schedules: ${schedules.count || 0}개`);
    console.log(`   - Schedule Options: ${scheduleOptions.count || 0}개`);
    console.log(`   - Timeline Events: ${timelineEvents.count || 0}개`);
    console.log('\n✨ 모든 작업 완료!\n');
  } catch (error: any) {
    console.error('❌ 데이터 확인 실패:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
