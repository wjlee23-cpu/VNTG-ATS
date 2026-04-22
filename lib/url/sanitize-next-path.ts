/**
 * 로그인/ OAuth 이후 이동 경로. 절대 URL·오픈 리다이렉트를 막고 앱 내부 경로만 허용합니다.
 */
export function sanitizeNextPath(next: unknown, fallback = '/dashboard'): string {
  if (typeof next !== 'string') return fallback;
  const t = next.trim();
  if (!t.startsWith('/') || t.startsWith('//')) return fallback;
  if (/^https?:\/\//i.test(t)) return fallback;
  return t;
}
