import { NextResponse } from 'next/server';
import { google } from 'googleapis';

/**
 * 구글 로그인 시작점 (모든 권한 포함)
 * 캘린더, Gmail 권한을 포함하여 처음부터 모든 권한을 받습니다.
 * GET /api/auth/google?next=/dashboard
 */
export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const next = requestUrl.searchParams.get('next') || '/dashboard';

    // Google OAuth2 클라이언트 생성
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/google`
    );

    // 필요한 모든 스코프 포함
    const scopes = [
      'https://www.googleapis.com/auth/calendar', // 캘린더 읽기/쓰기
      'https://www.googleapis.com/auth/gmail.send', // Gmail 발송
      'https://www.googleapis.com/auth/userinfo.email', // 이메일 정보
      'https://www.googleapis.com/auth/userinfo.profile', // 프로필 정보
    ];

    // OAuth URL 생성
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline', // refresh token 받기 위해 필수
      scope: scopes,
      prompt: 'consent', // 매번 동의 화면 표시 (처음 권한 받기 위해)
      // next 파라미터를 state에 포함하여 콜백에서 사용
      state: encodeURIComponent(JSON.stringify({ next, type: 'login' })),
    });

    return NextResponse.redirect(authUrl);
  } catch (error: any) {
    console.error('구글 로그인 URL 생성 실패:', error);
    const requestUrl = new URL(request.url);
    return NextResponse.redirect(
      new URL(`/login?error=oauth_error&message=${encodeURIComponent('구글 로그인 시작에 실패했습니다.')}`, requestUrl.origin)
    );
  }
}
