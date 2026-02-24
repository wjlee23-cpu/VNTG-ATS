'use server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, verifyCandidateAccess } from '@/api/utils/auth';
import { validateUUID } from '@/api/utils/validation';
import { withErrorHandling } from '@/api/utils/errors';

/**
 * 후보자별 코멘트 조회
 * @param candidateId 후보자 ID
 * @returns 코멘트 목록 (작성자 정보 포함)
 */
export async function getCommentsByCandidate(candidateId: string) {
  return withErrorHandling(async () => {
    // 접근 권한 확인
    await verifyCandidateAccess(candidateId);
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('comments')
      .select(`
        *,
        created_by_user:users!created_by (
          id,
          email,
          name
        )
      `)
      .eq('candidate_id', candidateId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`코멘트 조회 실패: ${error.message}`);
    }

    return data || [];
  });
}

/**
 * 특정 코멘트 조회
 * @param commentId 코멘트 ID
 * @returns 코멘트 데이터 (작성자 정보 포함)
 */
export async function getCommentById(commentId: string) {
  return withErrorHandling(async () => {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('comments')
      .select(`
        *,
        created_by_user:users!created_by (
          id,
          email,
          name
        ),
        candidates!inner (
          id
        )
      `)
      .eq('id', commentId)
      .single();

    if (error) {
      throw new Error(`코멘트 조회 실패: ${error.message}`);
    }

    if (!data) {
      throw new Error('코멘트를 찾을 수 없습니다.');
    }

    // 후보자 접근 권한 확인
    await verifyCandidateAccess(data.candidates.id);

    return data;
  });
}
