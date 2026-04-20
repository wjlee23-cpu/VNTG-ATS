'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/api/utils/auth';
import { withErrorHandling } from '@/api/utils/errors';

/**
 * 조직 내 사용자 목록 조회 (담당자 선택용)
 * @returns 사용자 목록 (id, email, role, name, avatar_url)
 */
export async function getUsers() {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const isAdmin = user.role === 'admin';
    
    // 관리자는 Service Role Client 사용, 일반 사용자는 일반 Client 사용
    const supabase = isAdmin ? createServiceClient() : await createClient();

    const { data, error } = await supabase
      .from('users')
      .select('id, email, role, name, avatar_url')
      .eq('organization_id', user.organizationId)
      .order('email', { ascending: true });

    if (error) {
      throw new Error(`사용자 목록 조회 실패: ${error.message}`);
    }

    return data || [];
  });
}

/**
 * 현재 사용자가 저장한 비가입 면접관 이메일 목록 조회
 */
export async function getExternalInterviewers() {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const supabase = await createClient();

    // 내부 사용자 이메일 목록을 미리 구해, 가입한 사용자와 중복되는 외부 면접관 레코드를 정리합니다.
    const { data: internalUsers, error: internalUsersError } = await supabase
      .from('users')
      .select('email')
      .eq('organization_id', user.organizationId);

    if (internalUsersError) {
      throw new Error(`내부 사용자 이메일 조회 실패: ${internalUsersError.message}`);
    }

    const normalizeEmail = (email: string) => email.trim().toLowerCase();
    const internalEmailSet = new Set(
      (internalUsers || [])
        .map((u) => u.email)
        .filter((email): email is string => typeof email === 'string' && email.trim().length > 0)
        .map(normalizeEmail),
    );

    const { data, error } = await supabase
      .from('external_interviewers')
      .select('id, email, display_name')
      .eq('user_id', user.userId)
      .order('email', { ascending: true });

    if (error) {
      throw new Error(`비가입 면접관 목록 조회 실패: ${error.message}`);
    }

    const externalList = data || [];
    const overlappedIds = externalList
      .filter((entry) => internalEmailSet.has(normalizeEmail(entry.email)))
      .map((entry) => entry.id);

    // ✅ 정책(확정): 내부 사용자와 동일한 이메일의 외부 면접관 레코드는 삭제합니다.
    if (overlappedIds.length > 0) {
      const { error: deleteError } = await supabase
        .from('external_interviewers')
        .delete()
        .in('id', overlappedIds);

      if (deleteError) {
        throw new Error(`중복 외부 면접관 삭제 실패: ${deleteError.message}`);
      }
    }

    // 화면에는 중복이 제거된 목록만 반환합니다.
    return externalList.filter((entry) => !internalEmailSet.has(normalizeEmail(entry.email)));
  });
}