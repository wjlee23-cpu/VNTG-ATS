import { addDays, differenceInDays } from 'date-fns';

/**
 * 날짜 범위를 1주일씩 확장
 * 예: 3/2(월) ~ 3/6(금) → 3/9(월) ~ 3/13(금)
 * 
 * @param startDate 원본 시작 날짜
 * @param endDate 원본 종료 날짜
 * @returns 확장된 새로운 시작 날짜와 종료 날짜
 */
export function extendDateRangeByWeek(
  startDate: Date,
  endDate: Date
): { newStartDate: Date; newEndDate: Date } {
  // 원본 날짜 범위의 일수 계산
  const daysDiff = differenceInDays(endDate, startDate);
  
  // 종료일 다음날부터 시작 (주말을 건너뛰지 않고 연속적으로)
  const newStartDate = addDays(endDate, 1);
  
  // 동일한 기간 유지
  const newEndDate = addDays(newStartDate, daysDiff);
  
  return { newStartDate, newEndDate };
}

/**
 * 날짜 범위 확장이 필요한지 확인
 * 최대 5회까지 확장 가능 (총 6주 범위)
 * 
 * @param retryCount 현재 재시도 횟수
 * @returns 확장 가능 여부
 */
export function shouldExtendDateRange(retryCount: number): boolean {
  const MAX_RETRIES = 5;
  return retryCount < MAX_RETRIES;
}

/**
 * 재시도 횟수에 따라 날짜 범위를 계산
 * 
 * @param originalStartDate 원본 시작 날짜
 * @param originalEndDate 원본 종료 날짜
 * @param retryCount 재시도 횟수
 * @returns 현재 재시도에 해당하는 시작 날짜와 종료 날짜
 */
export function getDateRangeForRetry(
  originalStartDate: Date,
  originalEndDate: Date,
  retryCount: number
): { startDate: Date; endDate: Date } {
  if (retryCount === 0) {
    // 첫 시도: 원본 날짜 범위 사용
    return {
      startDate: new Date(originalStartDate),
      endDate: new Date(originalEndDate),
    };
  }
  
  // 재시도: 원본 날짜 범위를 기반으로 확장
  let currentStartDate = new Date(originalStartDate);
  let currentEndDate = new Date(originalEndDate);
  
  // retryCount만큼 1주일씩 확장
  for (let i = 0; i < retryCount; i++) {
    const extended = extendDateRangeByWeek(currentStartDate, currentEndDate);
    currentStartDate = extended.newStartDate;
    currentEndDate = extended.newEndDate;
  }
  
  return {
    startDate: currentStartDate,
    endDate: currentEndDate,
  };
}
