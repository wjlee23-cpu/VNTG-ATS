/**
 * 한국 공휴일 체크 유틸리티
 * 한국의 법정 공휴일과 대체공휴일을 체크합니다.
 */

/**
 * 한국의 법정 공휴일 목록 (2024-2026)
 * 실제 운영 시에는 외부 API나 더 정확한 데이터를 사용하는 것을 권장합니다.
 */
const KOREAN_HOLIDAYS: Array<{ month: number; day: number; name: string }> = [
  // 1월
  { month: 1, day: 1, name: '신정' },
  // 3월
  { month: 3, day: 1, name: '3·1절' },
  // 5월
  { month: 5, day: 5, name: '어린이날' },
  // 6월
  { month: 6, day: 6, name: '현충일' },
  // 8월
  { month: 8, day: 15, name: '광복절' },
  // 10월
  { month: 10, day: 3, name: '개천절' },
  { month: 10, day: 9, name: '한글날' },
  // 12월
  { month: 12, day: 25, name: '크리스마스' },
];

/**
 * 음력 공휴일 계산 (간단한 근사치)
 * 실제로는 음력 계산 라이브러리를 사용하는 것이 정확합니다.
 * 여기서는 주요 음력 공휴일의 양력 변환 근사치를 사용합니다.
 */
function getLunarHolidays(year: number): Array<{ month: number; day: number; name: string }> {
  // 설날과 추석은 매년 달라지므로, 여기서는 간단한 근사치를 사용합니다.
  // 실제 운영 시에는 음력 계산 라이브러리(lunar-korean, korean-lunar-calendar 등)를 사용하세요.
  
  // 2024년
  if (year === 2024) {
    return [
      { month: 2, day: 9, name: '설날' },
      { month: 2, day: 10, name: '설날 연휴' },
      { month: 2, day: 12, name: '설날 대체공휴일' },
      { month: 9, day: 16, name: '추석' },
      { month: 9, day: 17, name: '추석 연휴' },
      { month: 9, day: 18, name: '추석 연휴' },
    ];
  }
  
  // 2025년
  if (year === 2025) {
    return [
      { month: 1, day: 28, name: '설날' },
      { month: 1, day: 29, name: '설날 연휴' },
      { month: 1, day: 30, name: '설날 연휴' },
      { month: 10, day: 5, name: '추석' },
      { month: 10, day: 6, name: '추석 연휴' },
      { month: 10, day: 7, name: '추석 연휴' },
    ];
  }
  
  // 2026년
  if (year === 2026) {
    return [
      { month: 2, day: 16, name: '설날' },
      { month: 2, day: 17, name: '설날 연휴' },
      { month: 2, day: 18, name: '설날 연휴' },
      { month: 9, day: 24, name: '추석' },
      { month: 9, day: 25, name: '추석 연휴' },
      { month: 9, day: 26, name: '추석 연휴' },
    ];
  }
  
  // 기본값 (나중에 확장 가능)
  return [];
}

/**
 * 특정 날짜가 한국 공휴일인지 확인
 * @param date 확인할 날짜
 * @returns 공휴일이면 true, 아니면 false
 */
export function isKoreanHoliday(date: Date): boolean {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // getMonth()는 0부터 시작하므로 +1
  const day = date.getDate();
  
  // 일요일 체크 (일요일은 공휴일로 간주)
  if (date.getDay() === 0) {
    return true;
  }
  
  // 법정 공휴일 체크
  const isLegalHoliday = KOREAN_HOLIDAYS.some(
    holiday => holiday.month === month && holiday.day === day
  );
  
  if (isLegalHoliday) {
    return true;
  }
  
  // 음력 공휴일 체크
  const lunarHolidays = getLunarHolidays(year);
  const isLunarHoliday = lunarHolidays.some(
    holiday => holiday.month === month && holiday.day === day
  );
  
  return isLunarHoliday;
}

/**
 * 특정 날짜가 평일인지 확인 (공휴일이 아닌 평일)
 * @param date 확인할 날짜
 * @returns 평일이면 true, 공휴일이면 false
 */
export function isWeekday(date: Date): boolean {
  const dayOfWeek = date.getDay();
  // 일요일(0)과 토요일(6)은 평일이 아님
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false;
  }
  
  // 공휴일 체크
  return !isKoreanHoliday(date);
}
