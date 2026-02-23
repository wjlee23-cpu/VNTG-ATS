import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getCurrentUser } from '@/api/utils/auth';

/**
 * 구글 캘린더 OAuth 콜백 처리
 * 사용자가 구글 캘린더 권한을 승인한 후 리디렉트되는 경로
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const error = requestUrl.searchParams.get('error');
  const state = requestUrl.searchParams.get('state');
  
  // state에서 next 파라미터 추출
  let next = '/dashboard';
  if (state) {
    try {
      const stateData = JSON.parse(decodeURIComponent(state));
      next = stateData.next || '/dashboard';
    } catch {
      // state 파싱 실패 시 기본값 사용
    }
  }

  // 에러가 있으면 처리
  if (error) {
    console.error('구글 OAuth 에러:', error);
    return NextResponse.redirect(
      new URL(`/dashboard?error=google_oauth_error&message=${encodeURIComponent('구글 캘린더 연동에 실패했습니다.')}`, requestUrl.origin)
    );
  }

  // 코드가 없으면 에러
  if (!code) {
    return NextResponse.redirect(
      new URL(`/dashboard?error=oauth_error&message=${encodeURIComponent('인증 코드를 받지 못했습니다')}`, requestUrl.origin)
    );
  }

  try {
    // 현재 사용자 확인
    const user = await getCurrentUser();
    const supabase = await createClient();
    const serviceClient = createServiceClient();

    // OAuth2 클라이언트 생성
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/google`
    );

    // 인증 코드를 액세스 토큰으로 교환
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error('토큰을 받지 못했습니다.');
    }

    // 토큰 스코프 확인 및 로깅
    try {
      const tokenInfo = await oauth2Client.getTokenInfo(tokens.access_token);
      const scopes = tokenInfo.scopes || [];
      const hasGmailScope = scopes.some(scope => 
        scope.includes('gmail.send') || scope === 'https://www.googleapis.com/auth/gmail.send'
      );
      
      console.log('토큰 스코프:', scopes);
      console.log('Gmail 스코프 포함 여부:', hasGmailScope);
      
      if (!hasGmailScope) {
        console.warn('경고: 토큰에 Gmail 스코프가 포함되지 않았습니다. Google Cloud Console에서 Gmail API 활성화 및 OAuth 동의 화면에 gmail.send 스코프 추가가 필요합니다.');
      }
    } catch (scopeError) {
      console.error('토큰 스코프 확인 실패:', scopeError);
    }

    // 사용자 정보에 구글 캘린더 토큰 저장
    const { error: updateError } = await serviceClient
      .from('users')
      .update({
        calendar_provider: 'google',
        calendar_access_token: tokens.access_token,
        calendar_refresh_token: tokens.refresh_token,
      })
      .eq('id', user.userId);

    if (updateError) {
      console.error('구글 캘린더 토큰 저장 실패:', updateError);
      return NextResponse.redirect(
        new URL(`/dashboard?error=token_save_error&message=${encodeURIComponent('구글 캘린더 연동 정보 저장에 실패했습니다.')}`, requestUrl.origin)
      );
    }

    // 성공 시 대시보드로 리다이렉트
    return NextResponse.redirect(
      new URL(`${next}?success=calendar_connected&message=${encodeURIComponent('구글 캘린더가 성공적으로 연동되었습니다.')}`, requestUrl.origin)
    );
  } catch (err: any) {
    console.error('구글 캘린더 OAuth 콜백 처리 중 오류:', err);
    return NextResponse.redirect(
      new URL(`/dashboard?error=unknown_error&message=${encodeURIComponent('구글 캘린더 연동 처리 중 오류가 발생했습니다')}`, requestUrl.origin)
    );
  }
}
