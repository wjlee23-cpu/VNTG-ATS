'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/api/utils/auth';
import { withErrorHandling } from '@/api/utils/errors';

/**
 * 현재 로그인한 사용자의 조직 정보를 조회합니다.
 * - 이메일 템플릿 치환(organization.name)에 사용됩니다.
 */
export async function getMyOrganization() {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const isAdmin = user.role === 'admin';
    const supabase = isAdmin ? createServiceClient() : await createClient();

    const { data, error } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('id', user.organizationId)
      .single();

    if (error) {
      throw new Error(`조직 정보 조회 실패: ${error.message}`);
    }

    return data as { id: string; name: string };
  });
}

