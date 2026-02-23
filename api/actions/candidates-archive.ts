'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { getCurrentUser, verifyCandidateAccess } from '@/api/utils/auth';
import { withErrorHandling } from '@/api/utils/errors';

/**
 * 후보자 아카이브 처리
 * @param id 후보자 ID
 * @param reason 아카이브 사유
 */
export async function archiveCandidate(id: string, reason: string) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const candidate = await verifyCandidateAccess(id);
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('candidates')
      .update({
        archived: true,
        archive_reason: reason,
        status: 'rejected', // 아카이브 시 상태를 rejected로 변경
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`아카이브 처리 실패: ${error.message}`);
    }

    // 타임라인 이벤트 생성
    await supabase.from('timeline_events').insert({
      candidate_id: id,
      type: 'archive',
      content: {
        message: `후보자가 아카이브되었습니다. 사유: ${reason}`,
        archive_reason: reason,
      },
      created_by: user.userId,
    });

    // 캐시 무효화
    revalidatePath('/dashboard/candidates');
    revalidatePath(`/dashboard/candidates/${id}`);

    return data;
  });
}

/**
 * 후보자 아카이브 해제
 * @param id 후보자 ID
 */
export async function unarchiveCandidate(id: string) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    await verifyCandidateAccess(id);
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('candidates')
      .update({
        archived: false,
        archive_reason: null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`아카이브 해제 실패: ${error.message}`);
    }

    // 타임라인 이벤트 생성
    await supabase.from('timeline_events').insert({
      candidate_id: id,
      type: 'archive',
      content: {
        message: '후보자가 아카이브에서 복구되었습니다.',
      },
      created_by: user.userId,
    });

    // 캐시 무효화
    revalidatePath('/dashboard/candidates');
    revalidatePath(`/dashboard/candidates/${id}`);

    return data;
  });
}
