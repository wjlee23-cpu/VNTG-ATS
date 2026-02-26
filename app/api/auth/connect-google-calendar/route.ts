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
    
    // next 파라미터를 state에 포함하여 콜백에서 사용
    const urlWithState = `${authUrl}&state=${encodeURIComponent(JSON.stringify({ next }))}`;

    return NextResponse.redirect(urlWithState);
  } catch (error: any) {
    console.error('구글 캘린더 연동 URL 생성 실패:', error);
    return NextResponse.json(
      { error: '구글 캘린더 연동 URL 생성에 실패했습니다.' },
      { status: 500 }
    );
  }
}
