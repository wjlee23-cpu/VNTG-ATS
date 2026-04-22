/**
 * Cloud Run / 프록시 환경에서는 `request.url`의 origin이 `0.0.0.0:8080`처럼 내부 주소로 잡힐 수 있습니다.
 * 인증/리다이렉트용 "사용자에게 보이는 URL"을 결정합니다.
 *
 * - **localhost / 127.0.0.1** 로 들어온 요청은 항상 그 origin을 씁니다.
 *   (.env에 배포용 NEXT_PUBLIC_APP_URL만 있어도 OAuth가 배포 쪽으로 새는 문제 방지)
 * - 그 외에는 `NEXT_PUBLIC_APP_URL` → `x-forwarded-*` 순으로 보정합니다.
 */
export function getAppBaseUrl(request?: Request): string {
  const envUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');

  if (request) {
    try {
      const { hostname, origin } = new URL(request.url);
      const isLoopback =
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '[::1]';

      if (isLoopback) {
        return origin.replace(/\/$/, '');
      }
    } catch {
      /* request.url 파싱 실패 시 아래로 진행 */
    }
  }

  if (envUrl) return envUrl;

  if (!request) return '';

  const proto =
    request.headers.get('x-forwarded-proto') ||
    request.headers.get('x-forwarded-scheme') ||
    'https';
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');

  if (!host) return '';
  return `${proto}://${host}`.replace(/\/$/, '');
}

