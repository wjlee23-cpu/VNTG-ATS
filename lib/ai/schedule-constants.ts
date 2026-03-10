/**
 * 면접 일정 조율 알고리즘의 점수 가중치 상수
 * A/B 테스트나 동적 조정을 위해 하드코딩된 점수 로직을 분리
 */

export const SCORING_WEIGHTS = {
  /**
   * 시간대별 기본 점수
   * 오후 시간대를 선호하도록 설정
   */
  timeOfDay: {
    morning: {
      base: 5, // 오전 시간대 기본 점수
      range: [10, 11], // 10시~11시
    },
    afternoon: {
      base: 12, // 오후 시간대 기본 점수
      range: [12, 16], // 12시~16시
    },
  },
  
  /**
   * 모든 면접관이 가능한 경우 보너스 점수
   */
  allInterviewersBonus: 20,
  
  /**
   * 부분적 충돌 허용 시, 가능한 면접관 수에 곱하는 배수
   */
  partialConflictMultiplier: 2,
  
  /**
   * 요일별 선호도 보너스
   * 화요일~목요일을 선호
   */
  dayOfWeek: {
    monday: 0,
    tuesday: 10,
    wednesday: 10,
    thursday: 10,
    friday: 5,
  },
} as const;

/**
 * 비즈니스 시간 설정
 */
export const BUSINESS_HOURS = {
  start: 10, // 오전 10시
  end: 17, // 오후 5시 (17시까지, 16:30까지 슬롯 생성)
} as const;

/**
 * 시간 슬롯 생성 간격 (분)
 */
export const SLOT_INTERVAL_MINUTES = 30;

/**
 * 일정 옵션 간 최소 간격 (분)
 */
export const MIN_SLOT_INTERVAL_MINUTES = 30;

/**
 * 최대 일정 옵션 개수
 */
export const MAX_SCHEDULE_OPTIONS = 5;
