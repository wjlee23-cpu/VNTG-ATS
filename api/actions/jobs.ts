'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { getCurrentUser, verifyJobPostAccess } from '@/api/utils/auth';
import { validateRequired, validateUUID } from '@/api/utils/validation';
import { withErrorHandling } from '@/api/utils/errors';
import { Database } from '@/lib/supabase/types';

type JobPostInsert = Database['public']['Tables']['job_posts']['Insert'];
type JobPostUpdate = Database['public']['Tables']['job_posts']['Update'];

/**
 * 채용 공고 생성
 * @param formData 채용 공고 정보 (title, description, process_id)
 * @returns 생성된 채용 공고 데이터
 */
export async function createJob(formData: FormData) {
  return withErrorHandling(async () => {
    // 현재 사용자 확인 및 organization_id 가져오기
    const user = await getCurrentUser();
    const supabase = await createClient();

    // 입력값 검증
    const title = validateRequired(formData.get('title'), '제목');
    const description = (formData.get('description') as string) || null;
    const processId = validateUUID(validateRequired(formData.get('process_id'), '프로세스 ID'), '프로세스 ID');
    const jdRequestId = (formData.get('jd_request_id') as string) || null;
    const stageAssigneesStr = formData.get('stage_assignees') as string;
    
    // stage_assignees 파싱
    let stageAssignees: Record<string, string[]> = {};
    if (stageAssigneesStr) {
      try {
        stageAssignees = JSON.parse(stageAssigneesStr);
      } catch (error) {
        throw new Error('전형별 담당자 정보 형식이 올바르지 않습니다.');
      }
    }

    // jd_request_id 검증 (있는 경우)
    if (jdRequestId) {
      validateUUID(jdRequestId, 'JD 요청 ID');
      
      // JD 요청이 승인된 상태인지 확인
      const { data: jdRequest, error: jdError } = await supabase
        .from('jd_requests')
        .select('id, status, organization_id')
        .eq('id', jdRequestId)
        .single();

      if (jdError || !jdRequest) {
        throw new Error('JD 요청을 찾을 수 없습니다.');
      }

      if (jdRequest.status !== 'approved') {
        throw new Error('승인된 JD만 사용할 수 있습니다.');
      }

      if (jdRequest.organization_id !== user.organizationId) {
        throw new Error('이 JD 요청에 접근할 권한이 없습니다.');
      }
    }

    // process가 해당 organization에 속하는지 확인
    const { data: process, error: processError } = await supabase
      .from('processes')
      .select('id, organization_id')
      .eq('id', processId)
      .single();

    if (processError || !process) {
      throw new Error('프로세스를 찾을 수 없습니다.');
    }

    if (process.organization_id !== user.organizationId) {
      throw new Error('이 프로세스에 접근할 권한이 없습니다.');
    }

    // 채용 공고 생성
    const jobData: any = {
      organization_id: user.organizationId,
      title,
      description,
      process_id: processId,
    };

    // jd_request_id와 stage_assignees는 타입 정의에 없을 수 있으므로 동적으로 추가
    if (jdRequestId) {
      jobData.jd_request_id = jdRequestId;
    }
    if (Object.keys(stageAssignees).length > 0) {
      jobData.stage_assignees = stageAssignees;
    }

    const { data, error } = await supabase
      .from('job_posts')
      .insert(jobData)
      .select()
      .single();

    if (error) {
      throw new Error(`채용 공고 생성 실패: ${error.message}`);
    }

    // 캐시 무효화
    revalidatePath('/dashboard/jobs');
    revalidatePath(`/dashboard/jobs/${data.id}`);

    return data;
  });
}

/**
 * 채용 공고 정보 수정
 * @param id 채용 공고 ID
 * @param formData 수정할 정보 (title, description)
 * @returns 수정된 채용 공고 데이터
 */
export async function updateJob(id: string, formData: FormData) {
  return withErrorHandling(async () => {
    // 채용 공고 접근 권한 확인
    await verifyJobPostAccess(id);
    const supabase = await createClient();

    // 입력값 검증
    const title = validateRequired(formData.get('title'), '제목');
    const description = (formData.get('description') as string) || null;

    const updateData: JobPostUpdate = {
      title,
      description,
    };

    const { data, error } = await supabase
      .from('job_posts')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`채용 공고 수정 실패: ${error.message}`);
    }

    // 캐시 무효화
    revalidatePath('/dashboard/jobs');
    revalidatePath(`/dashboard/jobs/${id}`);

    return data;
  });
}

/**
 * 채용 공고 삭제
 * @param id 채용 공고 ID
 */
export async function deleteJob(id: string) {
  return withErrorHandling(async () => {
    // 채용 공고 접근 권한 확인
    await verifyJobPostAccess(id);
    const supabase = await createClient();

    // 연결된 후보자가 있는지 확인
    const { count } = await supabase
      .from('candidates')
      .select('*', { count: 'exact', head: true })
      .eq('job_post_id', id);

    if (count && count > 0) {
      throw new Error('연결된 후보자가 있어 삭제할 수 없습니다.');
    }

    const { error } = await supabase
      .from('job_posts')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`채용 공고 삭제 실패: ${error.message}`);
    }

    // 캐시 무효화
    revalidatePath('/dashboard/jobs');
  });
}
