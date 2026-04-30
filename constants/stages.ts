/**
 * 채용 단계 상수 정의
 * Candidates 페이지에서 사용하는 채용 단계 목록
 */
export const RECRUITMENT_STAGES = [
  { id: 'all', name: 'All Stages', label: 'All Stages' },
  { id: 'new_application', name: 'New Application', label: 'New Application' },
  { id: 'application_review', name: 'Application Review', label: 'Application Review' },
  { id: 'competency_assessment', name: 'Competency Assessment', label: 'Competency Assessment' },
  { id: 'technical_test', name: 'Technical Test', label: 'Technical Test' },
  { id: '1st_interview', name: '1st Interview', label: '1st Interview' },
  { id: 'reference_check', name: 'Reference Check', label: 'Reference Check' },
  { id: '2nd_interview', name: '2nd Interview', label: '2nd Interview' },
  { id: 'offer', name: 'Offer', label: 'Offer' },
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
 * 채용 프로세스:
 * 1. New Application (stage-1)
 * 2. Application Review (stage-2)
 * 3. Competency Assessment (stage-3)
 * 4. Technical Test (stage-4)
 * 5. 1st Interview (stage-5)
 * 6. Reference Check (stage-6)
 * 7. 2nd Interview (stage-7)
 * 8. Offer (stage-8)
 */
export const STAGE_ID_TO_NAME_MAP: Record<string, string> = {
  'stage-1': 'New Application',
  'stage-2': 'Application Review',
  'stage-3': 'Competency Assessment',
  'stage-4': 'Technical Test',
  'stage-5': '1st Interview',
  'stage-6': 'Reference Check',
  'stage-7': '2nd Interview',
  'stage-8': 'Offer',
};

/**
 * Process Stage ID를 단계 이름으로 변환
 * @param stageId process의 stage ID (예: "stage-1", "stage-3")
 * @returns 단계 이름 (예: "New Application", "Application Review") 또는 null
 */
export function getStageNameByStageId(stageId: string | null): string | null {
  if (!stageId) {
    return 'New Application'; // 기본값
  }
  return STAGE_ID_TO_NAME_MAP[stageId] || null;
}

/**
 * 면접 일정·구글 캘린더 등에 쓰는 한글 단계 라벨 (stage-1 ~ stage-8)
 * — STAGE_ID_TO_NAME_MAP(영문)과 분리: 평가·필터 등 기존 로직과 충돌하지 않도록 함
 */
export const INTERVIEW_STAGE_LABEL_KO: Record<string, string> = {
  'stage-1': '스크리닝',
  'stage-2': '서류 전형',
  'stage-3': '역량 검사',
  'stage-4': '기술 면접',
  'stage-5': '1차 면접',
  'stage-6': '레퍼런스',
  'stage-7': '2차 면접',
  'stage-8': '오퍼',
};

/** 캘린더/메일용 한글 단계명. 매핑 없으면 stageId 그대로 */
export function getInterviewStageLabelKo(stageId: string | null | undefined): string {
  if (!stageId) return '스크리닝';
  return INTERVIEW_STAGE_LABEL_KO[stageId] ?? stageId;
}
