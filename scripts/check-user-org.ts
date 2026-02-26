/**
 * 사용자 및 조직 정보 확인 스크립트
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
  console.log('🔍 사용자 및 조직 정보 확인 중...\n');

  try {
    // 조직 정보 확인
    const { data: orgs, error: orgError } = await supabase
      .from('organizations')
      .select('*');

    if (orgError) {
      console.error('❌ 조직 조회 실패:', orgError.message);
    } else {
      console.log('✅ 조직 정보:');
      orgs?.forEach(org => {
        console.log(`   - ID: ${org.id}, Name: ${org.name}`);
      });
    }

    console.log('\n');

    // 사용자 정보 확인
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('*');

    if (userError) {
      console.error('❌ 사용자 조회 실패:', userError.message);
    } else {
      console.log(`✅ 사용자 정보 (${users?.length || 0}명):`);
      users?.forEach(user => {
        console.log(`   - ID: ${user.id}, Email: ${user.email}, Organization: ${user.organization_id}`);
      });
    }

    console.log('\n');

    // 채용 공고 및 후보자 확인
    const { data: jobs, error: jobError } = await supabase
      .from('job_posts')
      .select('id, title, organization_id');

    if (!jobError && jobs) {
      console.log(`✅ 채용 공고 (${jobs.length}개):`);
      jobs.forEach(job => {
        console.log(`   - ${job.title} (Org: ${job.organization_id})`);
      });
    }

    console.log('\n');

    // 후보자 확인
    const { data: candidates, error: candidateError } = await supabase
      .from('candidates')
      .select('id, name, job_post_id')
      .limit(5);

    if (!candidateError && candidates) {
      console.log(`✅ 후보자 샘플 (전체 ${candidates.length}개 중 5개):`);
      candidates.forEach(candidate => {
        console.log(`   - ${candidate.name} (Job Post: ${candidate.job_post_id})`);
      });
    }

    console.log('\n💡 문제 해결:');
    if (!users || users.length === 0) {
      console.log('   - users 테이블에 사용자가 없습니다.');
      console.log('   - 로그인한 사용자의 organization_id가 더미 데이터의 organization_id와 일치해야 합니다.');
      console.log('   - 테스트 사용자를 생성하거나, 로그인한 사용자의 organization_id를 확인하세요.\n');
    } else {
      console.log('   - 사용자가 존재합니다. 로그인한 사용자의 organization_id가 더미 데이터와 일치하는지 확인하세요.\n');
    }

  } catch (error: any) {
    console.error('❌ 오류 발생:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
