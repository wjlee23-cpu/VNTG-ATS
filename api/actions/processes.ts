'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/api/utils/auth';
import { validateRequired, validateUUID } from '@/api/utils/validation';
import { withErrorHandling } from '@/api/utils/errors';
import { Database } from '@/lib/supabase/types';

type ProcessInsert = Database['public']['Tables']['processes']['Insert'];
type ProcessUpdate = Database['public']['Tables']['processes']['Update'];

/**
 * 채용 프로세스 생성
 * @param formData 프로세스 정보 (name, stages)
 * @returns 생성된 프로세스 데이터
 */
export async function createProcess(formData: FormData) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const supabase = await createClient();

    // 입력값 검증
    const name = validateRequired(formData.get('name'), '프로세스 이름');
    const stagesJson = validateRequired(formData.get('stages'), '단계 정보');
    
    let stages;
    try {
      stages = JSON.parse(stagesJson);
    } catch {
      throw new Error('단계 정보 형식이 올바르지 않습니다.');
    }

    if (!Array.isArray(stages) || stages.length === 0) {
      throw new Error('최소 1개 이상의 단계가 필요합니다.');
    }

    // 프로세스 생성
    const processData: ProcessInsert = {
      organization_id: user.organizationId,
      name,
      stages,
    };

    const { data, error } = await supabase
      .from('processes')
      .insert(processData)
      .select()
      .single();

    if (error) {
      throw new Error(`프로세스 생성 실패: ${error.message}`);
    }

    // 캐시 무효화
    revalidatePath('/dashboard/templates');

    return data;
  });
}

/**
 * 채용 프로세스 수정
 * @param id 프로세스 ID
 * @param formData 수정할 정보 (name, stages)
 * @returns 수정된 프로세스 데이터
 */
export async function updateProcess(id: string, formData: FormData) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const supabase = await createClient();

    // 프로세스 조회 및 권한 확인
    const { data: process, error: processError } = await supabase
      .from('processes')
      .select('id, organization_id')
      .eq('id', id)
      .single();

    if (processError || !process) {
      throw new Error('프로세스를 찾을 수 없습니다.');
    }

    if (process.organization_id !== user.organizationId) {
      throw new Error('이 프로세스에 접근할 권한이 없습니다.');
    }

    // 입력값 검증
    const name = validateRequired(formData.get('name'), '프로세스 이름');
    const stagesJson = validateRequired(formData.get('stages'), '단계 정보');
    
    let stages;
    try {
      stages = JSON.parse(stagesJson);
    } catch {
      throw new Error('단계 정보 형식이 올바르지 않습니다.');
    }

    if (!Array.isArray(stages) || stages.length === 0) {
      throw new Error('최소 1개 이상의 단계가 필요합니다.');
    }

    // 프로세스 수정
    const updateData: ProcessUpdate = {
      name,
      stages,
    };

    const { data, error } = await supabase
      .from('processes')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`프로세스 수정 실패: ${error.message}`);
    }

    // 캐시 무효화
    revalidatePath('/dashboard/templates');
    revalidatePath(`/dashboard/templates/${id}`);

    return data;
  });
}

/**
 * 채용 프로세스 삭제
 * @param id 프로세스 ID
 */
export async function deleteProcess(id: string) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const supabase = await createClient();

    // 프로세스 조회 및 권한 확인
    const { data: process, error: processError } = await supabase
      .from('processes')
      .select('id, organization_id')
      .eq('id', id)
      .single();

    if (processError || !process) {
      throw new Error('프로세스를 찾을 수 없습니다.');
    }

    if (process.organization_id !== user.organizationId) {
      throw new Error('이 프로세스에 접근할 권한이 없습니다.');
    }

    // 연결된 job_posts 확인
    const { count } = await supabase
      .from('job_posts')
      .select('*', { count: 'exact', head: true })
      .eq('process_id', id);

    if (count && count > 0) {
      throw new Error('이 프로세스를 사용하는 채용 공고가 있어 삭제할 수 없습니다.');
    }

    const { error } = await supabase
      .from('processes')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`프로세스 삭제 실패: ${error.message}`);
    }

    // 캐시 무효화
    revalidatePath('/dashboard/templates');
  });
}
