'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getCurrentUser, verifyCandidateAccess } from '@/api/utils/auth';
import { validateUUID } from '@/api/utils/validation';
import { withErrorHandling } from '@/api/utils/errors';

/**
 * 후보자의 모든 첨부 파일 조회
 * @param candidateId 후보자 ID
 * @returns 첨부 파일 목록
 */
export async function getResumeFilesByCandidate(candidateId: string) {
  return withErrorHandling(async () => {
    // 접근 권한 확인
    await verifyCandidateAccess(candidateId);
    const user = await getCurrentUser();
    const isAdmin = user.role === 'admin';
    
    // 관리자일 경우 Service Role Client를 사용하여 RLS 정책 우회하여 모든 데이터 조회
    const supabase = isAdmin ? createServiceClient() : await createClient();

    const { data, error } = await supabase
      .from('resume_files')
      .select('*')
      .eq('candidate_id', candidateId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`첨부 파일 조회 실패: ${error.message}`);
    }

    return data || [];
  });
}

/**
 * 특정 첨부 파일 조회
 * @param fileId 파일 ID
 * @returns 첨부 파일 정보
 */
export async function getResumeFileById(fileId: string) {
  return withErrorHandling(async () => {
    validateUUID(fileId, '파일 ID');
    const user = await getCurrentUser();
    const isAdmin = user.role === 'admin';
    
    const supabase = isAdmin ? createServiceClient() : await createClient();

    const { data, error } = await supabase
      .from('resume_files')
      .select('*, candidates!inner(id)')
      .eq('id', fileId)
      .single();

    if (error) {
      throw new Error(`첨부 파일 조회 실패: ${error.message}`);
    }

    // 후보자 접근 권한 확인
    if (data?.candidates) {
      await verifyCandidateAccess(data.candidates.id);
    }

    return data;
  });
}
