'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/api/utils/auth';
import { validateUUID } from '@/api/utils/validation';
import { withErrorHandling } from '@/api/utils/errors';

/**
 * 현재 조직의 모든 채용 프로세스 조회
 * 관리자일 경우 모든 조직의 프로세스를 조회하고, 일반 사용자는 자신의 조직 프로세스만 조회합니다.
 * @returns 채용 프로세스 목록
 */
export async function getProcesses() {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const isAdmin = user.role === 'admin';
    
    // 관리자일 경우 Service Role Client를 사용하여 RLS 정책 우회하여 모든 데이터 조회
    const supabase = isAdmin ? createServiceClient() : await createClient();

    let query = supabase
      .from('processes')
      .select('*')
      .order('created_at', { ascending: false });

    // 관리자가 아닐 경우 자신의 organization_id로 필터링
    if (!isAdmin) {
      query = query.eq('organization_id', user.organizationId);
    }

    const { data, error } = await query;

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
    const isAdmin = user.role === 'admin';

    const { data, error } = await supabase
      .from('processes')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new Error('프로세스를 찾을 수 없습니다.');
    }

    // 접근 권한 확인 (관리자는 모든 프로세스에 접근 가능)
    if (!isAdmin && data.organization_id !== user.organizationId) {
      throw new Error('이 프로세스에 접근할 권한이 없습니다.');
    }

    return data;
  });
}
