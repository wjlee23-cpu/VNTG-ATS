/**
 * 프로세스 단계 관련 유틸리티 함수
 */

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { CustomStage } from '@/types/job';
import { STAGE_ID_TO_NAME_MAP } from '@/constants/stages';

/**
 * Job의 커스텀 단계 목록 조회
 * @param jobPostId Job Post ID
 * @returns 커스텀 단계 배열, 또는 null (기본 8단계 모두 활성화)
 */
export async function getCustomStagesForJob(jobPostId: string): Promise<CustomStage[] | null> {
  const supabase = await createClient();
  
  const { data: job, error } = await supabase
    .from('job_posts')
    .select('custom_stages')
    .eq('id', jobPostId)
    .single();

  if (error || !job) {
    throw new Error('Job을 찾을 수 없습니다.');
  }

  // custom_stages가 null이면 기본 8단계 모두 활성화로 간주
  if (job.custom_stages === null) {
    return null;
  }

  // JSONB를 배열로 변환
  if (Array.isArray(job.custom_stages)) {
    return job.custom_stages as CustomStage[];
  }

  return null;
}

/**
 * 커스텀 단계 배열에서 현재 단계 다음 단계 찾기
 * @param currentStageId 현재 단계 ID (예: "stage-3")
 * @param customStages 커스텀 단계 배열 (null이면 기본 8단계 모두 활성화)
 * @returns 다음 단계 ID, 또는 null (다음 단계 없음)
 */
export function getNextStageId(
  currentStageId: string,
  customStages: CustomStage[] | null
): string | null {
  // custom_stages가 null이면 기본 8단계 모두 활성화로 간주
  if (customStages === null) {
    // 기본 8단계 순서대로 다음 단계 찾기
    const stageIds = Object.keys(STAGE_ID_TO_NAME_MAP).sort();
    const currentIndex = stageIds.findIndex(id => id === currentStageId);
    
    if (currentIndex === -1) {
      return null;
    }
    
    if (currentIndex < stageIds.length - 1) {
      return stageIds[currentIndex + 1];
    }
    return null;
  }

  // custom_stages를 order 기준으로 정렬
  const sortedStages = [...customStages].sort((a, b) => a.order - b.order);

  // 현재 단계의 인덱스 찾기
  const currentIndex = sortedStages.findIndex(stage => stage.id === currentStageId);

  if (currentIndex === -1) {
    // 현재 단계를 찾을 수 없으면 null 반환
    return null;
  }

  // 다음 단계 반환
  if (currentIndex < sortedStages.length - 1) {
    return sortedStages[currentIndex + 1].id;
  }

  return null;
}

/**
 * Job의 커스텀 단계 정보 조회
 * @param jobPostId Job Post ID
 * @param isAdmin 관리자 여부 (선택, 기본값: false)
 * @returns { customStages }
 */
export async function getJobProcessInfo(jobPostId: string, isAdmin: boolean = false) {
  // 관리자일 경우 Service Role Client를 사용하여 RLS 정책 우회
  const supabase = isAdmin ? createServiceClient() : await createClient();
  
  if (!jobPostId) {
    throw new Error('채용 공고 ID가 제공되지 않았습니다.');
  }
  
  try {
    const { data: job, error } = await supabase
      .from('job_posts')
      .select('custom_stages')
      .eq('id', jobPostId)
      .single();

    if (error) {
      // custom_stages 컬럼이 없는 경우 (컬럼이 존재하지 않음)
      if (error.message?.includes('does not exist') || error.message?.includes('column') || error.message?.includes('custom_stages')) {
        // custom_stages 컬럼이 없으면 null 반환 (기본 단계 사용)
        return {
          customStages: null,
        };
      }
      
      // RLS 정책 위반인 경우
      if (error.code === 'PGRST116' || error.message?.includes('row-level security') || error.message?.includes('RLS')) {
        throw new Error('채용 공고에 접근할 권한이 없습니다.');
      }
      // 데이터가 없는 경우
      if (error.code === 'PGRST116' || error.message?.includes('No rows') || error.message?.includes('0 rows')) {
        throw new Error(`ID가 ${jobPostId}인 채용 공고를 찾을 수 없습니다.`);
      }
      // 기타 에러
      throw new Error(`채용 공고 조회 중 오류가 발생했습니다: ${error.message}`);
    }

    if (!job) {
      throw new Error(`ID가 ${jobPostId}인 채용 공고를 찾을 수 없습니다.`);
    }

    const customStages = job.custom_stages === null 
      ? null 
      : (Array.isArray(job.custom_stages) ? job.custom_stages as CustomStage[] : null);

    return {
      customStages,
    };
  } catch (error) {
    // custom_stages 컬럼이 없는 경우 fallback
    if (error instanceof Error && (error.message.includes('does not exist') || error.message.includes('column') || error.message.includes('custom_stages'))) {
      return {
        customStages: null,
      };
    }
    throw error;
  }
}

/**
 * 사용 가능한 모든 단계 목록 조회
 * @param jobPostId Job Post ID
 * @param currentStageId 현재 단계 ID (비활성화 처리용)
 * @param isAdmin 관리자 여부 (선택, 기본값: false)
 * @returns 사용 가능한 단계 배열 (현재 단계 포함, order 기준 정렬)
 */
export async function getAvailableStages(
  jobPostId: string,
  currentStageId: string,
  isAdmin: boolean = false
): Promise<Array<{ id: string; name: string; order: number; isCurrent: boolean }>> {
  const { customStages } = await getJobProcessInfo(jobPostId, isAdmin);

  // custom_stages가 null이면 기본 8단계 모두 활성화로 간주
  if (customStages === null) {
    // 기본 단계 목록 생성 (STAGE_ID_TO_NAME_MAP에서)
    const stageIds = Object.keys(STAGE_ID_TO_NAME_MAP).sort();
    return stageIds.map((id, index) => ({
      id,
      name: STAGE_ID_TO_NAME_MAP[id] || id,
      order: index + 1,
      isCurrent: id === currentStageId,
    }));
  }

  // custom_stages를 order 기준으로 정렬
  const sortedStages = [...customStages].sort((a, b) => a.order - b.order);
  
  return sortedStages.map(stage => ({
    id: stage.id,
    name: stage.name,
    order: stage.order,
    isCurrent: stage.id === currentStageId,
  }));
}