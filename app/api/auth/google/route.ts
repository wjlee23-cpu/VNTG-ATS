import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createClient, createServiceClient } from '@/lib/supabase/server';

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

    // 사용자가 이미 로그인되어 있고 캘린더를 연동했는지 확인
    let usePromptConsent = true; // 기본값: 항상 동의 화면 표시
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // 사용자가 이미 로그인되어 있으면 연동 상태 확인
        const serviceClient = createServiceClient();
        const { data: userData } = await serviceClient
          .from('users')
          .select('calendar_provider, calendar_refresh_token')
          .eq('id', user.id)
          .single();

        // 이미 연동되어 있고 refresh token이 있으면 prompt: 'consent' 제거
        if (userData?.calendar_provider === 'google' && userData?.calendar_refresh_token) {
          usePromptConsent = false;
        }
      }
    } catch (error) {
      // 사용자 확인 실패 시 기본값 사용 (항상 동의 화면 표시)
      console.log('사용자 연동 상태 확인 실패, 기본값 사용:', error);
    }

    // OAuth URL 생성
    const authUrlOptions: {
      access_type: string;
      scope: string[];
      prompt?: string;
      state: string;
    } = {
      access_type: 'offline', // refresh token 받기 위해 필수
      scope: scopes,
      state: encodeURIComponent(JSON.stringify({ next, type: 'login' })),
    };

    // 사용자가 이미 연동되어 있으면 prompt 제거, 아니면 prompt: 'consent' 사용
    if (usePromptConsent) {
      authUrlOptions.prompt = 'consent';
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
