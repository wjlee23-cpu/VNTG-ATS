'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/api/utils/auth';
import { withErrorHandling } from '@/api/utils/errors';

/**
 * 오퍼 목록 조회
 * @param status 상태 필터 (선택)
 * @returns 오퍼 목록
 */
export async function getOffers(status?: 'pending' | 'accepted' | 'rejected' | 'negotiating') {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const isAdmin = user.role === 'admin';
    
    const supabase = isAdmin ? createServiceClient() : await createClient();

    let query = supabase
      .from('offers')
      .select(`
        *,
        candidates (
          id,
          name,
          email,
          job_posts (
            id,
            title
          )
        )
      `)
      .order('offer_sent_at', { ascending: false });

    if (!isAdmin) {
      query = query.eq('organization_id', user.organizationId);
    }

    if (status) {
      query = query.eq('offer_status', status);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`오퍼 조회 실패: ${error.message}`);
    }

    return data || [];
  });
}

/**
 * 오퍼 통계 조회
 * @returns 오퍼 통계 (Accepted, Pending, Negotiating, Accept Rate)
 */
export async function getOfferStats() {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const isAdmin = user.role === 'admin';
    
    const supabase = isAdmin ? createServiceClient() : await createClient();

    let baseQuery = supabase.from('offers');
    
    if (!isAdmin) {
      baseQuery = baseQuery.eq('organization_id', user.organizationId);
    }

    // Accepted 수
    const { count: accepted } = await baseQuery
      .select('*', { count: 'exact', head: true })
      .eq('offer_status', 'accepted');

    // Pending 수
    const { count: pending } = await baseQuery
      .select('*', { count: 'exact', head: true })
      .eq('offer_status', 'pending');

    // Negotiating 수
    const { count: negotiating } = await baseQuery
      .select('*', { count: 'exact', head: true })
      .eq('offer_status', 'negotiating');

    // Accept Rate 계산 (accepted / (accepted + rejected))
    const { count: rejected } = await baseQuery
      .select('*', { count: 'exact', head: true })
      .eq('offer_status', 'rejected');

    const total = (accepted || 0) + (rejected || 0);
    const acceptRate = total > 0 
      ? Math.round(((accepted || 0) / total) * 100) 
      : 0;

    return {
      accepted: accepted || 0,
      pending: pending || 0,
      negotiating: negotiating || 0,
      acceptRate,
    };
  });
}
