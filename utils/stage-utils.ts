/**
 * 프로세스 단계 관련 유틸리티 함수
 */

import { createClient } from '@/lib/supabase/server';
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
 * @returns { customStages }
 */
export async function getJobProcessInfo(jobPostId: string) {
  const supabase = await createClient();
  
  const { data: job, error } = await supabase
    .from('job_posts')
    .select('custom_stages')
    .eq('id', jobPostId)
    .single();

  if (error || !job) {
    throw new Error('Job을 찾을 수 없습니다.');
  }

  const customStages = job.custom_stages === null 
    ? null 
    : (Array.isArray(job.custom_stages) ? job.custom_stages as CustomStage[] : null);

  return {
    customStages,
  };
}
