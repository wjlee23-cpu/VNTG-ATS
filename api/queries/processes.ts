'use server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/api/utils/auth';
import { validateUUID } from '@/api/utils/validation';
import { withErrorHandling } from '@/api/utils/errors';

/**
 * 현재 조직의 모든 채용 프로세스 조회
 * @returns 채용 프로세스 목록
 */
export async function getProcesses() {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('processes')
      .select('*')
      .eq('organization_id', user.organizationId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`프로세스 조회 실패: ${error.message}`);
    }

    return data || [];
  });
}

/**
 * 특정 채용 프로세스 상세 정보 조회
 * @param id 프로세스 ID
 * @returns 프로세스 상세 정보
 */
export async function getProcessById(id: string) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('processes')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new Error('프로세스를 찾을 수 없습니다.');
    }

    // 접근 권한 확인
    if (data.organization_id !== user.organizationId) {
      throw new Error('이 프로세스에 접근할 권한이 없습니다.');
    }

    return data;
  });
}
