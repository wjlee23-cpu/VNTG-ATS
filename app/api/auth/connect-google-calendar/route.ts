import { NextResponse } from 'next/server';
import { getGoogleAuthUrl } from '@/lib/calendar/google';

/**
 * 구글 캘린더 연동 URL 생성
 * GET /api/auth/connect-google-calendar?next=/dashboard
 */
export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const next = requestUrl.searchParams.get('next') || '/dashboard';

    // 구글 OAuth URL 생성
    const authUrl = getGoogleAuthUrl();
    
    // next/type 파라미터를 state에 포함하여 콜백에서 사용
    // - callback 라우트는 state.type이 없으면 기본값을 connect로 두고 있지만,
    //   향후 혼동 방지 및 디버깅을 위해 명시적으로 type을 포함합니다.
    const urlWithState = `${authUrl}&state=${encodeURIComponent(JSON.stringify({ next, type: 'connect' }))}`;

    return NextResponse.redirect(urlWithState);
  } catch (error: any) {
    console.error('구글 캘린더 연동 URL 생성 실패:', error);
    return NextResponse.json(
      { error: '구글 캘린더 연동 URL 생성에 실패했습니다.' },
      { status: 500 }
    );
  }
}
