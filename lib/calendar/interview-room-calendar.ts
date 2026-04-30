/**
 * 인터뷰룸(회의실) 전용 Google Calendar ID를 반환합니다.
 *
 * - 운영에서는 `INTERVIEW_ROOM_CALENDAR_ID` 환경변수로 주입하는 것이 정석입니다.
 * - 미설정 시에는 기존 운영에서 사용하던 기본값을 사용합니다. (레거시 호환)
 * - 로그는 서버 프로세스당 1회만 남겨서 과도한 스팸을 방지합니다.
 */

const DEFAULT_INTERVIEW_ROOM_CALENDAR_ID =
  'c_7a0bedbaf87e6bc93e3b6944b4f5f61d29b01877c9644374a37c840a75c488d8@group.calendar.google.com';

let hasLoggedInterviewRoomCalendarId = false;

export function getInterviewRoomCalendarId(): string {
  const envValue = process.env.INTERVIEW_ROOM_CALENDAR_ID;
  const value =
    envValue && envValue.trim().length > 0 ? envValue.trim() : DEFAULT_INTERVIEW_ROOM_CALENDAR_ID;

  if (!hasLoggedInterviewRoomCalendarId) {
    // 운영 로그로 어떤 값이 사용되는지 남깁니다. (민감정보 아님)
    console.log('[ScheduleActions] Using INTERVIEW_ROOM_CALENDAR_ID =', value);
    hasLoggedInterviewRoomCalendarId = true;
  }

  return value;
}
