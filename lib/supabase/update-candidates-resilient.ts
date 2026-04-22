import type { SupabaseClient } from '@supabase/supabase-js';

type CandidatesRow = Record<string, unknown>;

/**
 * PostgREST 스키마 캐시에 아직 없는 컬럼(PGRST204)이 있으면 해당 키만 제거하고 재시도합니다.
 * 원격 DB에 마이그레이션은 적용됐지만 API 스키마 새로고침 전인 경우에도 나머지 필드는 저장됩니다.
 */
export async function updateCandidatesResilient(
  supabase: SupabaseClient,
  candidateId: string,
  payload: CandidatesRow,
): Promise<{ error: { code?: string; message?: string } | null }> {
  let current: CandidatesRow = { ...payload };
  const maxAttempts = 16;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { error } = await supabase.from('candidates').update(current).eq('id', candidateId);

    if (!error) {
      return { error: null };
    }

    if (error.code === 'PGRST204') {
      const match = error.message?.match(/Could not find the '([^']+)' column/);
      const col = match?.[1];
      if (col && Object.prototype.hasOwnProperty.call(current, col)) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(
            `[updateCandidatesResilient] candidates.${col} 를 스키마에서 찾지 못해 제외하고 재시도합니다.`,
          );
        }
        const next = { ...current };
        delete next[col];
        current = next;
        continue;
      }
    }

    return { error };
  }

  return { error: { message: 'updateCandidatesResilient: 재시도 횟수 초과' } };
}
