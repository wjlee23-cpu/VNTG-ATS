export function formatExperienceMonthsAsYm(totalMonths: number | null | undefined): string {
  // totalMonths가 없거나 유효하지 않으면 표시하지 않습니다.
  if (typeof totalMonths !== 'number' || !Number.isFinite(totalMonths) || totalMonths < 0) {
    return '—';
  }
  const months = Math.floor(totalMonths);
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  return `${years}y ${remMonths}m`;
}

function tryParseExperienceStringToMonths(raw: string): number | null {
  // 레거시/더미 문자열을 최소한으로만 해석합니다.
  // - "신입" -> 0
  // - "3년" -> 36
  // - "5년 3개월" / "5년3개월" -> 63
  // - 그 외는 null (추측 금지)
  const s = raw.trim();
  if (!s) return null;
  if (s === '신입') return 0;

  const yearMatch = s.match(/(\d+)\s*년/);
  const monthMatch = s.match(/(\d+)\s*개월/);
  const years = yearMatch ? Number(yearMatch[1]) : 0;
  const months = monthMatch ? Number(monthMatch[1]) : 0;

  if ((yearMatch && Number.isFinite(years)) || (monthMatch && Number.isFinite(months))) {
    return years * 12 + months;
  }

  return null;
}

export function formatExperienceFromCandidateLike(input: {
  total_experience_months?: number | null;
  experience?: string | null;
  parsed_data?: { experience?: string | null } | null;
}): string {
  // 1) 정규화된 숫자 컬럼이 있으면 최우선
  const fromMonths = formatExperienceMonthsAsYm(input.total_experience_months);
  if (fromMonths !== '—') return fromMonths;

  // 2) 레거시 문자열(경험) 최소 파싱 (가능할 때만)
  const legacy = (input.experience || input.parsed_data?.experience || '').trim();
  if (!legacy) return '—';
  const maybeMonths = tryParseExperienceStringToMonths(legacy);
  if (maybeMonths === null) return '—';
  return formatExperienceMonthsAsYm(maybeMonths);
}

