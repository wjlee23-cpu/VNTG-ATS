'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { getCurrentUser, verifyJobPostAccess, verifyCandidateAccess } from '@/api/utils/auth';
import { validateRequired, validateEmail, validatePhone, validateUUID } from '@/api/utils/validation';
import { withErrorHandling } from '@/api/utils/errors';
import { Database } from '@/lib/supabase/types';

type CandidateInsert = Database['public']['Tables']['candidates']['Insert'];
type CandidateUpdate = Database['public']['Tables']['candidates']['Update'];

/**
 * 후보자 생성
 * @param formData 후보자 정보 (name, email, phone, job_post_id)
 * @returns 생성된 후보자 데이터
 */
export async function createCandidate(formData: FormData) {
  return withErrorHandling(async () => {
    // 현재 사용자 확인 및 organization_id 가져오기
    const user = await getCurrentUser();
    const supabase = await createClient();

    // 입력값 검증
    const name = validateRequired(formData.get('name'), '이름');
    const email = validateEmail(validateRequired(formData.get('email'), '이메일'));
    const phone = validatePhone(formData.get('phone') as string | null);
    const jobPostId = validateUUID(validateRequired(formData.get('job_post_id'), '채용 공고 ID'), '채용 공고 ID');

    // job_post 접근 권한 확인
    await verifyJobPostAccess(jobPostId);

    // 후보자 생성
    const candidateData: CandidateInsert = {
      job_post_id: jobPostId,
      name,
      email,
      phone,
      status: 'pending',
      token: crypto.randomUUID(), // 비로그인 접근용 토큰 생성
    };

    const { data, error } = await supabase
      .from('candidates')
      .insert(candidateData)
      .select()
      .single();

    if (error) {
      throw new Error(`후보자 생성 실패: ${error.message}`);
    }

    // 타임라인 이벤트 생성
    await supabase.from('timeline_events').insert({
      candidate_id: data.id,
      type: 'system_log',
      content: {
        message: '후보자가 등록되었습니다.',
        action: 'candidate_created',
      },
      created_by: user.userId,
    });

    // 캐시 무효화
    revalidatePath('/dashboard/candidates');
    revalidatePath(`/dashboard/candidates/${data.id}`);

    return data;
  });
}

/**
 * 후보자 정보 수정
 * @param id 후보자 ID
 * @param formData 수정할 정보 (name, email, phone, status, current_stage_id)
 * @returns 수정된 후보자 데이터
 */
export async function updateCandidate(id: string, formData: FormData) {
  return withErrorHandling(async () => {
    // 후보자 접근 권한 확인
    await verifyCandidateAccess(id);
    const supabase = await createClient();

    // 입력값 검증
    const name = validateRequired(formData.get('name'), '이름');
    const email = validateEmail(validateRequired(formData.get('email'), '이메일'));
    const phone = validatePhone(formData.get('phone') as string | null);
    const status = formData.get('status') as string | null;
    const currentStageId = formData.get('current_stage_id') as string | null;

    // 수정할 데이터 구성
    const updateData: CandidateUpdate = {
      name,
      email,
      phone,
    };

    // 선택적 필드 추가
    if (status) {
      const validStatuses: Array<'pending' | 'in_progress' | 'confirmed' | 'rejected' | 'issue'> = 
        ['pending', 'in_progress', 'confirmed', 'rejected', 'issue'];
      if (validStatuses.includes(status as typeof validStatuses[number])) {
        updateData.status = status as 'pending' | 'in_progress' | 'confirmed' | 'rejected' | 'issue';
      }
    }

    if (currentStageId) {
      updateData.current_stage_id = validateUUID(currentStageId, '단계 ID');
    }

    const { data, error } = await supabase
      .from('candidates')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`후보자 수정 실패: ${error.message}`);
    }

    // 캐시 무효화
    revalidatePath('/dashboard/candidates');
    revalidatePath(`/dashboard/candidates/${id}`);

    return data;
  });
}

/**
 * 후보자 삭제
 * @param id 후보자 ID
 */
export async function deleteCandidate(id: string) {
  return withErrorHandling(async () => {
    // 후보자 접근 권한 확인
    await verifyCandidateAccess(id);
    const supabase = await createClient();

    const { error } = await supabase
      .from('candidates')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`후보자 삭제 실패: ${error.message}`);
    }

    // 캐시 무효화
    revalidatePath('/dashboard/candidates');
  });
}

/**
 * 후보자 상태 변경
 * @param id 후보자 ID
 * @param status 새로운 상태
 * @param stageId 새로운 단계 ID (선택)
 */
export async function updateCandidateStatus(
  id: string,
  status: 'pending' | 'in_progress' | 'confirmed' | 'rejected' | 'issue',
  stageId?: string
) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const candidate = await verifyCandidateAccess(id);
    const supabase = await createClient();

    const updateData: CandidateUpdate = { status };
    if (stageId) {
      updateData.current_stage_id = validateUUID(stageId, '단계 ID');
    }

    const { data, error } = await supabase
      .from('candidates')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`상태 변경 실패: ${error.message}`);
    }

    // 타임라인 이벤트 생성
    await supabase.from('timeline_events').insert({
      candidate_id: id,
      type: 'stage_changed',
      content: {
        message: `상태가 ${status}로 변경되었습니다.`,
        previous_status: candidate.status,
        new_status: status,
        stage_id: stageId,
      },
      created_by: user.userId,
    });

    // 캐시 무효화
    revalidatePath('/dashboard/candidates');
    revalidatePath(`/dashboard/candidates/${id}`);

    return data;
  });
}
