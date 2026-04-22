/**
 * 서버 전용 Gemini API 키 조회.
 * - 브라우저에 노출되면 안 되므로 NEXT_PUBLIC_* 는 사용하지 않습니다.
 * - GOOGLE_GEMINI_API_KEY 우선, 없으면 GEMINI_API_KEY (관습적 별칭).
 */
export function getServerGeminiApiKey(): string | undefined {
  const raw =
    process.env.GOOGLE_GEMINI_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim();
  if (!raw || raw.length < 20) return undefined;
  return raw;
}

/** 키가 없으면 분석용 에러를 던집니다. */
export function requireServerGeminiApiKey(): string {
  const key = getServerGeminiApiKey();
  if (!key) {
    throw new Error(
      'GOOGLE_GEMINI_API_KEY 또는 GEMINI_API_KEY가 서버에 없거나 너무 짧습니다. .env.local 또는 배포 환경(Cloud Run·Vercel 등) 시크릿에 설정하세요.',
    );
  }
  return key;
}
