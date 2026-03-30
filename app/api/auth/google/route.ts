import { NextResponse } from 'next/server';
import { google } from 'googleapis';

/**
 * 구글 로그인 / 캘린더 연동 시작점 (모든 권한 포함)
 * 캘린더, Gmail 권한을 포함하여 처음부터 모든 권한을 받습니다.
 *
 * 🔑 핵심 로직:
 * - 기본적으로 prompt: 'select_account' 사용 → 계정 선택만, 동의 화면 생략
 * - 처음 사용하는 구글 계정은 자동으로 동의 화면이 표시됨 (구글이 알아서 처리)
 * - 이미 권한을 승인한 계정은 계정 선택만으로 바로 로그인/연동됨
 * - 콜백에서 refresh_token이 없고 DB에도 없는 경우에만 prompt: 'consent'로 재시도
 *
 * 사용 예시:
 * - 로그인:  GET /api/auth/google?next=/dashboard
 * - 캘린더: GET /api/auth/google?type=connect&next=/dashboard
 */
export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    // Cloud Run/도메인 환경은 배포 후에 바뀔 수 있으므로,
    // redirectUri는 "현재 요청의 origin"을 우선으로 잡고 NEXT_PUBLIC_APP_URL이 있으면 덮어씁니다.
    // (이렇게 하면 NEXT_PUBLIC_APP_URL이 잘못 들어갔을 때도 localhost로 콜백되는 문제가 줄어듭니다.)
    const resolvedAppOrigin =
      process.env.NEXT_PUBLIC_APP_URL || requestUrl.origin;
    const next = requestUrl.searchParams.get('next') || '/dashboard';
    // login / connect 플로우 구분
    const type = requestUrl.searchParams.get('type') || 'login';
    // 콜백에서 재시도 요청이 올 수 있음 (refresh_token 미발급 시)
    const forceConsent = requestUrl.searchParams.get('force_consent') === 'true';

    // Google OAuth2 클라이언트 생성
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${resolvedAppOrigin}/api/auth/callback/google`
    );

    // 필요한 모든 스코프 포함
    const scopes = [
      'https://www.googleapis.com/auth/calendar',       // 캘린더 읽기/쓰기
      'https://www.googleapis.com/auth/gmail.send',      // Gmail 발송
      'https://www.googleapis.com/auth/gmail.readonly',  // Gmail 읽기 권한 (이메일 동기화용)
      'https://www.googleapis.com/auth/userinfo.email',  // 이메일 정보
      'https://www.googleapis.com/auth/userinfo.profile', // 프로필 정보
    ];

    // OAuth URL 옵션 구성
    const authUrlOptions: {
      access_type: string;
      scope: string[];
      prompt?: string;
      state: string;
    } = {
      access_type: 'offline', // refresh token 받기 위해 필수
      scope: scopes,
      // 어떤 플로우로 호출됐는지(state.type) 함께 전달
      state: encodeURIComponent(JSON.stringify({ next, type })),
    };

    if (forceConsent) {
      // 콜백에서 재시도 요청: refresh_token이 필요하므로 동의 화면 강제 표시
      authUrlOptions.prompt = 'consent';
    } else {
      // 기본값: 계정 선택만 표시 (이전에 권한을 승인한 경우 동의 화면 생략)
      // → 컴퓨터 껐다 켜도 계정만 선택하면 바로 로그인됨
      authUrlOptions.prompt = 'select_account';
    }

    const authUrl = oauth2Client.generateAuthUrl(authUrlOptions);

    return NextResponse.redirect(authUrl);
  } catch (error: any) {
    console.error('구글 로그인 URL 생성 실패:', error);
    const requestUrl = new URL(request.url);
    return NextResponse.redirect(
      new URL(`/login?error=oauth_error&message=${encodeURIComponent('구글 로그인 시작에 실패했습니다.')}`, requestUrl.origin)
    );
  }
}
