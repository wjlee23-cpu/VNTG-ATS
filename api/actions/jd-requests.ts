'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { getCurrentUser, requireAdmin } from '@/api/utils/auth';
import { validateRequired, validateUUID } from '@/api/utils/validation';
import { withErrorHandling } from '@/api/utils/errors';

/**
 * JD 요청 생성 (일반 사용자)
 * @param formData JD 요청 정보 (title, description, category, priority)
 * @returns 생성된 JD 요청 데이터
 */
export async function createJDRequest(formData: FormData) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const supabase = await createClient();

    // 입력값 검증
    const title = validateRequired(formData.get('title'), '제목');
    const description = (formData.get('description') as string) || null;
    const category = (formData.get('category') as string) || null;
    const priority = (formData.get('priority') as string) || 'medium';

    // priority 검증
    if (!['low', 'medium', 'high'].includes(priority)) {
      throw new Error('우선순위는 low, medium, high 중 하나여야 합니다.');
    }

    // JD 요청 생성
    const { data, error } = await supabase
      .from('jd_requests')
      .insert({
        organization_id: user.organizationId,
        title,
        description,
        category,
        priority: priority as 'low' | 'medium' | 'high',
        requested_by: user.userId,
        status: 'pending',
        submitted_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`JD 요청 생성 실패: ${error.message}`);
    }

    // 캐시 무효화
    revalidatePath('/jd-requests');
    revalidatePath('/jd-requests/create');

    return data;
  });
}

/**
 * JD 요청 승인 (관리자)
 * @param id JD 요청 ID
 * @returns 승인된 JD 요청 데이터
 */
export async function approveJDRequest(id: string) {
  return withErrorHandling(async () => {
    // 관리자 권한 확인
    await requireAdmin();
    const supabase = createServiceClient();

    // UUID 검증
    validateUUID(id, 'JD 요청 ID');

    // JD 요청 조회
    const { data: jdRequest, error: fetchError } = await supabase
      .from('jd_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !jdRequest) {
      throw new Error('JD 요청을 찾을 수 없습니다.');
    }

    if (jdRequest.status !== 'pending') {
      throw new Error('이미 처리된 JD 요청입니다.');
    }

    // JD 요청 승인
    const { data, error } = await supabase
      .from('jd_requests')
      .update({
        status: 'approved',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`JD 요청 승인 실패: ${error.message}`);
    }

    // 캐시 무효화
    revalidatePath('/jd-requests');

    return data;
  });
}

/**
 * JD 요청 거부 (관리자)
 * @param id JD 요청 ID
 * @returns 거부된 JD 요청 데이터
 */
export async function rejectJDRequest(id: string) {
  return withErrorHandling(async () => {
    // 관리자 권한 확인
    await requireAdmin();
    const supabase = createServiceClient();

    // UUID 검증
    validateUUID(id, 'JD 요청 ID');

    // JD 요청 조회
    const { data: jdRequest, error: fetchError } = await supabase
      .from('jd_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !jdRequest) {
      throw new Error('JD 요청을 찾을 수 없습니다.');
    }

    if (jdRequest.status !== 'pending') {
      throw new Error('이미 처리된 JD 요청입니다.');
    }

    // JD 요청 거부
    const { data, error } = await supabase
      .from('jd_requests')
      .update({
        status: 'rejected',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`JD 요청 거부 실패: ${error.message}`);
    }

    // 캐시 무효화
    revalidatePath('/jd-requests');

    return data;
  });
}
