/**
 * 아카이브 사유 상수 정의
 * 후보자를 아카이브할 때 선택할 수 있는 사유 목록
 */
export const ARCHIVE_REASONS = [
  { 
    id: 'position_filled', 
    label: 'Position Filled', 
    description: '채용 포지션이 채워짐' 
  },
  { 
    id: 'better_for_another_role', 
    label: 'Better for Another Role', 
    description: '다른 포지션에 더 적합함' 
  },
  { 
    id: 'future_hire', 
    label: 'Future Hire', 
    description: '향후 채용 고려 대상' 
  },
  { 
    id: 'under_qualified', 
    label: 'Under Qualified', 
    description: '자격 요건 미달' 
  },
  { 
    id: 'timing', 
    label: 'Timing', 
    description: '타이밍 문제' 
  },
  { 
    id: 'withdrew', 
    label: 'Withdrew', 
    description: '후보자가 지원 철회' 
  },
  { 
    id: 'offer_declined', 
    label: 'Offer Declined', 
    description: '제안 거절' 
  },
  { 
    id: 'position_closed', 
    label: 'Position Closed', 
    description: '채용 공고 마감' 
  },
] as const;

/**
 * 아카이브 사유 ID 타입
 */
export type ArchiveReasonId = typeof ARCHIVE_REASONS[number]['id'];

/**
 * 아카이브 사유 ID로 라벨 찾기
 */
export function getArchiveReasonLabel(id: string): string | null {
  const reason = ARCHIVE_REASONS.find(r => r.id === id);
  return reason?.label || null;
}

/**
 * 아카이브 사유 ID로 설명 찾기
 */
export function getArchiveReasonDescription(id: string): string | null {
  const reason = ARCHIVE_REASONS.find(r => r.id === id);
  return reason?.description || null;
}
