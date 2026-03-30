/**
 * Cloud Run / 프록시 환경에서는 `request.url`의 origin이 `0.0.0.0:8080`처럼 내부 주소로 잡힐 수 있습니다.
 * 인증/리다이렉트 같은 "사용자에게 보여지는 URL"은 반드시 public URL 기반이어야 하므로,
 * NEXT_PUBLIC_APP_URL을 우선 사용하고, 없을 때만 요청 헤더 기반으로 보정합니다.
 */
export function getAppBaseUrl(request?: Request): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) return envUrl.replace(/\/$/, '');

  if (!request) return '';

  const proto =
    request.headers.get('x-forwarded-proto') ||
    request.headers.get('x-forwarded-scheme') ||
    'https';
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');

  if (!host) return '';
  return `${proto}://${host}`.replace(/\/$/, '');
}

