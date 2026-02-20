/**
 * 채용 단계 상수 정의
 * Candidates 페이지에서 사용하는 채용 단계 목록
 */
export const RECRUITMENT_STAGES = [
  { id: 'all', name: 'All Stages', label: 'All Stages' },
  { id: 'new_application', name: 'New Application', label: 'New Application' },
  { id: 'hr_screening', name: 'HR Screening', label: 'HR Screening' },
  { id: 'application_review', name: 'Application Review', label: 'Application Review' },
  { id: 'competency_assessment', name: 'Competency Assessment', label: 'Competency Assessment' },
  { id: 'technical_test', name: 'Technical Test', label: 'Technical Test' },
  { id: '1st_interview', name: '1st Interview', label: '1st Interview' },
  { id: 'reference_check', name: 'Reference Check', label: 'Reference Check' },
  { id: '2nd_interview', name: '2nd Interview', label: '2nd Interview' },
] as const;

/**
 * 단계 ID 타입
 */
export type StageId = typeof RECRUITMENT_STAGES[number]['id'];

/**
 * 단계 이름으로 ID 찾기
 */
export function getStageIdByName(name: string): string | null {
  const stage = RECRUITMENT_STAGES.find(s => s.name === name);
  return stage?.id || null;
}

/**
 * 단계 ID로 이름 찾기
 */
export function getStageNameById(id: string): string | null {
  const stage = RECRUITMENT_STAGES.find(s => s.id === id);
  return stage?.name || null;
}

/**
 * Process Stage ID를 단계 이름으로 매핑
 * 데이터베이스의 stage ID("stage-1", "stage-2" 등)를 사용자가 정의한 단계 이름으로 변환
 */
export const STAGE_ID_TO_NAME_MAP: Record<string, string> = {
  'stage-1': 'New Application',
  'stage-2': 'HR Screening',
  'stage-3': 'Application Review',
  'stage-4': 'Competency Assessment',
  'stage-5': 'Technical Test',
  'stage-6': '1st Interview',
  'stage-7': 'Reference Check',
  'stage-8': '2nd Interview',
};

/**
 * Process Stage ID를 단계 이름으로 변환
 * @param stageId process의 stage ID (예: "stage-1", "stage-2")
 * @returns 단계 이름 (예: "New Application", "HR Screening") 또는 null
 */
export function getStageNameByStageId(stageId: string | null): string | null {
  if (!stageId) {
    return 'New Application'; // 기본값
  }
  return STAGE_ID_TO_NAME_MAP[stageId] || null;
}
