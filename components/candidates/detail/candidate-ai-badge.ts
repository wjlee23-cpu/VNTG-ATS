/** AI 매칭 점수 구간별 배지 스타일 */
export function getScoreBadge(score: number | null) {
  if (score === null) return null;

  if (score >= 80) {
    return {
      text: 'STRONG HIRE',
      className:
        'px-3 py-1 rounded bg-emerald-50 border border-emerald-100 text-emerald-700 text-[11px] font-bold tracking-wider uppercase flex items-center gap-1.5',
      dotColor: 'bg-emerald-500',
    };
  }
  if (score >= 60) {
    return {
      text: 'CONSIDER',
      className:
        'px-3 py-1 rounded bg-amber-50 border border-amber-100 text-amber-600 text-[11px] font-bold tracking-wider uppercase flex items-center gap-1.5',
      dotColor: 'bg-amber-500',
    };
  }
  return {
    text: 'NOT RECOMMENDED',
    className:
      'px-3 py-1 rounded bg-red-50 border border-red-100 text-red-600 text-[11px] font-bold tracking-wider uppercase flex items-center gap-1.5',
    dotColor: 'bg-red-500',
  };
}
