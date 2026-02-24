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
    const processId = (formData.get('process_id') as string) || null; // 선택사항으로 변경
    const jdRequestId = (formData.get('jd_request_id') as string) || null;
    const customStagesStr = formData.get('custom_stages') as string | null;
    
    // custom_stages 파싱
    let customStages: any[] | null = null;
    if (customStagesStr) {
      try {
        customStages = JSON.parse(customStagesStr);
        if (!Array.isArray(customStages)) {
          throw new Error('커스텀 단계 정보는 배열 형식이어야 합니다.');
        }
        // 각 단계의 필수 필드 검증
        for (const stage of customStages) {
          if (!stage.id || !stage.name || typeof stage.order !== 'number') {
            throw new Error('각 단계는 id, name, order 필드가 필요합니다.');
          }
        }
      } catch (error) {
        throw new Error(`커스텀 단계 정보 형식이 올바르지 않습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
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

    // custom_stages가 없으면 에러
    if (!customStages || customStages.length === 0) {
      throw new Error('최소 1개 이상의 프로세스 단계를 선택해야 합니다.');
    }

    // process_id가 제공된 경우 검증 (선택사항)
    let finalProcessId = processId;
    if (processId) {
      validateUUID(processId, '프로세스 ID');
      
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
    } else {
      // process_id가 없으면 기본 프로세스 찾기 또는 생성
      // 기본 프로세스 이름으로 찾기
      const { data: defaultProcess } = await supabase
        .from('processes')
        .select('id')
        .eq('organization_id', user.organizationId)
        .eq('name', '기본 채용 프로세스')
        .single();

      if (defaultProcess) {
        finalProcessId = defaultProcess.id;
      } else {
        // 기본 프로세스가 없으면 생성
        const defaultStages = [
          { id: 'stage-1', name: 'New Application', order: 1, interviewers: [] },
          { id: 'stage-2', name: 'HR Screening', order: 2, interviewers: [] },
          { id: 'stage-3', name: 'Application Review', order: 3, interviewers: [] },
          { id: 'stage-4', name: 'Competency Assessment', order: 4, interviewers: [] },
          { id: 'stage-5', name: 'Technical Test', order: 5, interviewers: [] },
          { id: 'stage-6', name: '1st Interview', order: 6, interviewers: [] },
          { id: 'stage-7', name: 'Reference Check', order: 7, interviewers: [] },
          { id: 'stage-8', name: '2nd Interview', order: 8, interviewers: [] },
        ];

        const { data: newProcess, error: createError } = await supabase
          .from('processes')
          .insert({
            organization_id: user.organizationId,
            name: '기본 채용 프로세스',
            stages: defaultStages,
          })
          .select('id')
          .single();

        if (createError || !newProcess) {
          throw new Error('기본 프로세스 생성에 실패했습니다.');
        }

        finalProcessId = newProcess.id;
      }
    }

    // 채용 공고 생성
    const jobData: any = {
      organization_id: user.organizationId,
      title,
      description,
      process_id: finalProcessId,
    };

    // jd_request_id, custom_stages는 타입 정의에 없을 수 있으므로 동적으로 추가
    if (jdRequestId) {
      jobData.jd_request_id = jdRequestId;
    }
    if (customStages !== null) {
      jobData.custom_stages = customStages;
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
    const customStagesStr = formData.get('custom_stages') as string | null;

    // custom_stages 파싱
    let customStages: any[] | null = null;
    if (customStagesStr !== null) {
      try {
        customStages = JSON.parse(customStagesStr);
        if (!Array.isArray(customStages)) {
          throw new Error('커스텀 단계 정보는 배열 형식이어야 합니다.');
        }
        // 각 단계의 필수 필드 검증
        for (const stage of customStages) {
          if (!stage.id || !stage.name || typeof stage.order !== 'number') {
            throw new Error('각 단계는 id, name, order 필드가 필요합니다.');
          }
        }
      } catch (error) {
        throw new Error(`커스텀 단계 정보 형식이 올바르지 않습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
      }
    }

    const updateData: JobPostUpdate = {
      title,
      description,
    };

    // custom_stages가 제공된 경우에만 업데이트
    if (customStagesStr !== null) {
      if (!customStages || customStages.length === 0) {
        throw new Error('최소 1개 이상의 프로세스 단계를 선택해야 합니다.');
      }
      (updateData as any).custom_stages = customStages;
    }

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
