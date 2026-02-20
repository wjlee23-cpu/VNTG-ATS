'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/api/utils/auth';
import { withErrorHandling } from '@/api/utils/errors';

/**
 * JD 요청 목록 조회
 * @param status 상태 필터 (선택)
 * @returns JD 요청 목록
 */
export async function getJDRequests(status?: 'pending' | 'approved' | 'rejected') {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const isAdmin = user.role === 'admin';
    
    const supabase = isAdmin ? createServiceClient() : await createClient();

    let query = supabase
      .from('jd_requests')
      .select(`
        *,
        requested_by_user:users!jd_requests_requested_by_fkey (
          id,
          email
        )
      `)
      .order('submitted_at', { ascending: false });

    if (!isAdmin) {
      query = query.eq('organization_id', user.organizationId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`JD 요청 조회 실패: ${error.message}`);
    }

    return data || [];
  });
}

/**
 * JD 요청 통계 조회
 * @returns JD 요청 통계 (All, Pending, Approved, Rejected)
 */
export async function getJDRequestStats() {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const isAdmin = user.role === 'admin';
    
    const supabase = isAdmin ? createServiceClient() : await createClient();

    let baseQuery = supabase.from('jd_requests');
    
    if (!isAdmin) {
      baseQuery = baseQuery.eq('organization_id', user.organizationId);
    }

    // 전체 수
    const { count: all } = await baseQuery
      .select('*', { count: 'exact', head: true });

    // Pending 수
    const { count: pending } = await baseQuery
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    // Approved 수
    const { count: approved } = await baseQuery
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved');

    // Rejected 수
    const { count: rejected } = await baseQuery
      .select('*', { count: 'exact', head: true })
      .eq('status', 'rejected');

    return {
      all: all || 0,
      pending: pending || 0,
      approved: approved || 0,
      rejected: rejected || 0,
    };
  });
}
