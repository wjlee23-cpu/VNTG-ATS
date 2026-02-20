'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/api/utils/auth';
import { withErrorHandling } from '@/api/utils/errors';

/**
 * 디버깅용: Supabase에 있는 모든 데이터 확인
 * 관리자 전용
 */
export async function checkDatabaseData() {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    
    if (user.role !== 'admin') {
      throw new Error('관리자만 접근할 수 있습니다.');
    }

    // Service Role Client를 사용하여 RLS 정책 우회하여 모든 데이터 조회
    const serviceClient = createServiceClient();

    // 모든 테이블의 데이터 조회
    const [orgs, users, processes, jobPosts, candidates, schedules] = await Promise.all([
      serviceClient.from('organizations').select('*'),
      serviceClient.from('users').select('*'),
      serviceClient.from('processes').select('*'),
      serviceClient.from('job_posts').select('*'),
      serviceClient.from('candidates').select('*'),
      serviceClient.from('schedules').select('*'),
    ]);

    return {
      currentUser: {
        userId: user.userId,
        email: user.email,
        organizationId: user.organizationId,
        role: user.role,
      },
      organizations: orgs.data || [],
      users: users.data || [],
      processes: processes.data || [],
      jobPosts: jobPosts.data || [],
      candidates: candidates.data || [],
      schedules: schedules.data || [],
      counts: {
        organizations: orgs.data?.length || 0,
        users: users.data?.length || 0,
        processes: processes.data?.length || 0,
        jobPosts: jobPosts.data?.length || 0,
        candidates: candidates.data?.length || 0,
        schedules: schedules.data?.length || 0,
      },
    };
  });
}
