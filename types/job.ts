/**
 * Job 관련 타입 정의
 */

/**
 * 커스텀 프로세스 단계
 */
export interface CustomStage {
  id: string; // stage ID (예: "stage-1", "stage-2")
  name: string; // 단계 이름 (예: "New Application", "HR Screening")
  order: number; // 순서 (1부터 시작)
  assignees: string[]; // 담당자 사용자 ID 배열
}

/**
 * 기본 단계 정보
 */
export interface BaseStage {
  id: string;
  name: string;
}
