import { NextResponse } from 'next/server';
import { getAppBaseUrl } from '@/lib/url/getAppBaseUrl';
import { sanitizeNextPath } from '@/lib/url/sanitize-next-path';

/**
 * 구글 캘린더 연동 시작 (래퍼)
 * GET /api/auth/connect-google-calendar?next=/dashboard
 *
 * 실제 OAuth URL·스코프·prompt 로직은 /api/auth/google 한곳에만 두고,
 * 여기서는 type=connect 로 위임합니다.
 */
export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const appBase = getAppBaseUrl(request);
    const next = sanitizeNextPath(requestUrl.searchParams.get('next'), '/dashboard');

    const target = new URL('/api/auth/google', appBase || requestUrl.origin);
    target.searchParams.set('type', 'connect');
    target.searchParams.set('next', next);

    return NextResponse.redirect(target);
  } catch (error: unknown) {
    console.error('구글 캘린더 연동 URL 생성 실패:', error);
    return NextResponse.json(
      { error: '구글 캘린더 연동 URL 생성에 실패했습니다.' },
      { status: 500 }
    );
  }
}
