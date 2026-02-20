'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/api/utils/auth';
import { withErrorHandling } from '@/api/utils/errors';

/**
 * 조직 내 사용자 목록 조회 (담당자 선택용)
 * @returns 사용자 목록 (id, email, role)
 */
export async function getUsers() {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const isAdmin = user.role === 'admin';
    
    // 관리자는 Service Role Client 사용, 일반 사용자는 일반 Client 사용
    const supabase = isAdmin ? createServiceClient() : await createClient();

    const { data, error } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('organization_id', user.organizationId)
      .order('email', { ascending: true });

    if (error) {
      throw new Error(`사용자 목록 조회 실패: ${error.message}`);
    }

    return data || [];
  });
}
