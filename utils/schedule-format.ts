import { addMinutes } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { ko } from 'date-fns/locale/ko';

const KST_TZ = 'Asia/Seoul';

export function formatConfirmedDateLine(scheduledAtIso: string) {
  // 사용자가 보는 날짜는 KST 기준으로 표시합니다.
  // 예: 4월 2일 (목)
  return formatInTimeZone(scheduledAtIso, KST_TZ, 'M월 d일 (EEE)', { locale: ko });
}

export function formatConfirmedTimeRange(scheduledAtIso: string, durationMinutes: number | null | undefined) {
  // 예: 오후 2:00 - 3:00
  const start = formatInTimeZone(scheduledAtIso, KST_TZ, 'a h:mm', { locale: ko });
  const dur = typeof durationMinutes === 'number' && Number.isFinite(durationMinutes) ? durationMinutes : 60;

  const endIso = addMinutes(new Date(scheduledAtIso), dur).toISOString();
  const end = formatInTimeZone(endIso, KST_TZ, 'a h:mm', { locale: ko });
  return `${start} - ${end}`;
}

export function formatDdayBadge(scheduledAtIso: string) {
  // “오늘” 또는 “D-X”
  // KST 날짜 경계를 기준으로 계산합니다.
  const todayYmd = formatInTimeZone(new Date(), KST_TZ, 'yyyy-MM-dd');
  const targetYmd = formatInTimeZone(scheduledAtIso, KST_TZ, 'yyyy-MM-dd');

  const startOfDay = (ymd: string) => {
    // ymd: yyyy-MM-dd
    const [y, m, d] = ymd.split('-').map((v) => Number(v));
    // KST 00:00를 UTC로 환산(고정 +09:00)
    const utcMs = Date.UTC(y, (m || 1) - 1, d || 1, 0, 0, 0) - 9 * 60 * 60 * 1000;
    return utcMs;
  };

  const diffDays = Math.round((startOfDay(targetYmd) - startOfDay(todayYmd)) / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return '오늘';
  if (diffDays > 0) return `D-${diffDays}`;
  return `D+${Math.abs(diffDays)}`;
}

export function formatPipelineConfirmedBadge(scheduledAtIso: string) {
  // 예: D-2 (4/2)
  const todayYmd = formatInTimeZone(new Date(), KST_TZ, 'yyyy-MM-dd');
  const targetYmd = formatInTimeZone(scheduledAtIso, KST_TZ, 'yyyy-MM-dd');

  const startOfDay = (ymd: string) => {
    const [y, m, d] = ymd.split('-').map((v) => Number(v));
    const utcMs = Date.UTC(y, (m || 1) - 1, d || 1, 0, 0, 0) - 9 * 60 * 60 * 1000;
    return utcMs;
  };

  const diffDays = Math.round((startOfDay(targetYmd) - startOfDay(todayYmd)) / (24 * 60 * 60 * 1000));
  const dText = diffDays === 0 ? 'D-0' : diffDays > 0 ? `D-${diffDays}` : `D+${Math.abs(diffDays)}`;
  const md = formatInTimeZone(scheduledAtIso, KST_TZ, 'M/d', { locale: ko });
  return `${dText} (${md})`;
}

