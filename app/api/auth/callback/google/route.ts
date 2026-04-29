import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getAppBaseUrl } from '@/lib/url/getAppBaseUrl';
import { sanitizeNextPath } from '@/lib/url/sanitize-next-path';

const LIST_USERS_PER_PAGE = 200;
const LIST_USERS_MAX_PAGES = 50;

/**
 * @supabase/auth-js Admin API에는 getUserByEmail이 없으므로 listUsers로 이메일을 찾습니다.
 */
async function findAuthUserIdByEmail(
  serviceSupabase: SupabaseClient,
  email: string
): Promise<string | null> {
  const target = email.trim().toLowerCase();
  for (let page = 1; page <= LIST_USERS_MAX_PAGES; page++) {
    const { data, error } = await serviceSupabase.auth.admin.listUsers({
      page,
      perPage: LIST_USERS_PER_PAGE,
    });
    if (error) throw error;
    const users = data?.users ?? [];
    const hit = users.find((u) => (u.email ?? '').toLowerCase() === target);
    if (hit) return hit.id;
    if (users.length < LIST_USERS_PER_PAGE) break;
  }
  return null;
}

function isLikelyDuplicateAuthUserError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { message?: string; code?: string };
  const msg = (e.message ?? '').toLowerCase();
  const code = (e.code ?? '').toLowerCase();
  return (
    code === 'email_exists' ||
    msg.includes('already been registered') ||
    msg.includes('already registered') ||
    msg.includes('duplicate')
  );
}

function buildOAuthErrorLoginUrl(appBase: string, errorMessage: string, err: unknown): URL {
  const url = new URL(
    `/login?error=unknown_error&message=${encodeURIComponent(errorMessage)}`,
    appBase
  );
  if (process.env.NODE_ENV === 'development') {
    const hint =
      err instanceof Error ? err.message : typeof err === 'string' ? err : '';
    if (hint) url.searchParams.set('debug_hint', hint.slice(0, 240));
  }
  return url;
}

/**
 * 구글 OAuth 콜백 처리
 * 로그인과 캘린더 연동을 함께 처리합니다.
 * 
 * 🔑 핵심 로직:
 * - 로그인 플로우: Google OAuth → Supabase 사용자 생성/로그인 → 캘린더 토큰 저장
 * - 캘린더 연동 플로우: 기존 사용자의 캘린더 토큰만 업데이트
 * - refresh_token이 없고 DB에도 없을 때: prompt=consent로 자동 재시도 (1회만)
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const appBaseUrl = getAppBaseUrl(request);
  const code = requestUrl.searchParams.get('code');
  const error = requestUrl.searchParams.get('error');
  const errorDescription = requestUrl.searchParams.get('error_description');
  const state = requestUrl.searchParams.get('state');
  
  // state에서 next 파라미터 및 타입 추출
  let next = '/dashboard';
  let flowType = 'connect'; // 'login' 또는 'connect'
  if (state) {
    try {
      const stateData = JSON.parse(decodeURIComponent(state));
      next = sanitizeNextPath(stateData.next, '/dashboard');
      flowType = stateData.type || 'connect';
    } catch {
      // state 파싱 실패 시 기본값 사용
    }
  }

  // 에러가 있으면 처리
  if (error) {
    console.error('구글 OAuth 에러:', {
      error,
      errorDescription,
      fullUrl: requestUrl.toString(),
    });
    const errorMessage = flowType === 'login' 
      ? '구글 로그인에 실패했습니다.'
      : '구글 캘린더 연동에 실패했습니다.';
    return NextResponse.redirect(
      new URL(`/login?error=google_oauth_error&message=${encodeURIComponent(errorMessage)}`, appBaseUrl || requestUrl.origin)
    );
  }

  // 코드가 없으면 에러
  if (!code) {
    const paramsForDebug = Object.fromEntries(requestUrl.searchParams.entries());
    console.error('구글 OAuth 콜백에 code가 없습니다:', {
      fullUrl: requestUrl.toString(),
      params: paramsForDebug,
      flowType,
    });

    const errorMessage = errorDescription
      ? `인증 코드를 받지 못했습니다. (${errorDescription})`
      : '인증 코드를 받지 못했습니다. 구글 인증이 취소되었거나 Redirect URI 설정을 확인해주세요.';
    const redirectUrl = new URL(
      `/login?error=oauth_error&message=${encodeURIComponent(errorMessage)}`,
      appBaseUrl || requestUrl.origin
    );
    if (process.env.NODE_ENV === 'development') {
      const hint = JSON.stringify(paramsForDebug).slice(0, 240);
      if (hint) redirectUrl.searchParams.set('debug_hint', hint);
    }
    return NextResponse.redirect(
      redirectUrl
    );
  }

  try {
    const supabase = await createClient();
    const serviceClient = createServiceClient();

    // OAuth2 클라이언트 생성
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      // 콜백 요청이 들어온 실제 도메인을 기준으로 redirectUri를 맞춥니다.
      // (NEXT_PUBLIC_APP_URL이 빌드 시점에 localhost로 박히는 문제를 방지)
      `${appBaseUrl || requestUrl.origin}/api/auth/callback/google`
    );

    // 인증 코드를 액세스 토큰으로 교환
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token) {
      throw new Error('액세스 토큰을 받지 못했습니다.');
    }

    // 토큰으로 사용자 정보 가져오기
    oauth2Client.setCredentials({
      access_token: tokens.access_token,
    });

    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    if (!userInfo.email) {
      throw new Error('사용자 이메일을 가져올 수 없습니다.');
    }

    // 로그인 플로우인 경우: Supabase에 사용자 생성/로그인 처리
    if (flowType === 'login') {
      // Auth Admin은 Service Role이 필요합니다 (프로덕션에서 anon으로는 실패함).
      let authUserId = await findAuthUserIdByEmail(serviceClient, userInfo.email);

      if (!authUserId) {
        const { data: newAuthUser, error: createAuthError } =
          await serviceClient.auth.admin.createUser({
            email: userInfo.email,
            email_confirm: true,
            user_metadata: {
              full_name: userInfo.name || '',
              avatar_url: userInfo.picture || '',
              provider: 'google',
            },
          });

        if (createAuthError || !newAuthUser.user) {
          if (createAuthError && isLikelyDuplicateAuthUserError(createAuthError)) {
            authUserId = await findAuthUserIdByEmail(serviceClient, userInfo.email);
          }
          if (!authUserId) {
            console.error('Supabase Auth 사용자 생성 실패:', createAuthError);
            throw new Error('사용자 생성에 실패했습니다.');
          }
        } else {
          authUserId = newAuthUser.user.id;
        }
      }

      // users 테이블에 사용자가 있는지 확인
      const { data: existingUser } = await serviceClient
        .from('users')
        .select('id, email, organization_id, role, calendar_refresh_token')
        .eq('id', authUserId)
        .single();

      // ─── refresh_token 자동 재시도 로직 ───
      // Google은 prompt: 'consent' 없이는 refresh_token을 발급하지 않음 (이미 승인된 경우)
      // DB에도 refresh_token이 없다면, prompt: 'consent'로 1회 재시도하여 반드시 확보
      const hasNewRefreshToken = !!tokens.refresh_token;
      const hasExistingRefreshToken = !!existingUser?.calendar_refresh_token;

      if (!hasNewRefreshToken && !hasExistingRefreshToken) {
        // refresh_token이 어디에도 없음 → prompt: 'consent'로 재시도
        console.log('[OAuth 콜백] refresh_token 없음 → force_consent로 재시도');
        
        // 먼저 access_token이라도 저장 (유저가 이미 존재하면)
        if (existingUser) {
          await serviceClient
            .from('users')
            .update({
              calendar_provider: 'google',
              calendar_access_token: tokens.access_token,
            })
            .eq('id', authUserId);
        }

        // prompt: 'consent'를 포함하여 다시 Google OAuth로 리다이렉트
        return NextResponse.redirect(
          new URL(`/api/auth/google?next=${encodeURIComponent(next)}&force_consent=true`, appBaseUrl || requestUrl.origin)
        );
      }

      if (!existingUser) {
        // users 테이블에 사용자 생성
        const { count: totalUsers } = await serviceClient
          .from('users')
          .select('*', { count: 'exact', head: true });

        // 기본 조직 찾기 또는 생성
        let { data: organization } = await serviceClient
          .from('organizations')
          .select('id')
          .limit(1)
          .maybeSingle();

        if (!organization) {
          const { data: newOrg, error: orgError } = await serviceClient
            .from('organizations')
            .insert({ name: 'VNTG Tech' })
            .select('id')
            .single();

          if (orgError || !newOrg) {
            throw new Error('조직 생성에 실패했습니다.');
          }
          organization = newOrg;
        }

        // 최초 사용자는 admin, 그 외는 recruiter로 설정
        const isVNTGEmail = userInfo.email.endsWith('@vntgcorp.com');
        const isFirstUser = (totalUsers || 0) === 0;
        const userRole = (isFirstUser || isVNTGEmail) ? 'admin' : 'recruiter';

        // 사용자 생성 (캘린더 토큰 포함)
        const { error: createUserError } = await serviceClient
          .from('users')
          .insert({
            id: authUserId,
            email: userInfo.email,
            organization_id: organization.id,
            role: userRole,
            calendar_provider: 'google',
            calendar_access_token: tokens.access_token,
            calendar_refresh_token: tokens.refresh_token,
          });

        if (createUserError) {
          console.error('users 테이블 사용자 생성 실패:', createUserError);
          throw new Error('사용자 생성에 실패했습니다.');
        }
      } else {
        // 기존 사용자의 캘린더 토큰 업데이트
        const updateData: {
          calendar_provider: string;
          calendar_access_token: string;
          calendar_refresh_token?: string;
        } = {
          calendar_provider: 'google',
          calendar_access_token: tokens.access_token,
        };

        // refresh_token 결정: 새 토큰 우선 → 기존 토큰 유지
        if (tokens.refresh_token) {
          updateData.calendar_refresh_token = tokens.refresh_token;
        } else if (existingUser.calendar_refresh_token) {
          updateData.calendar_refresh_token = existingUser.calendar_refresh_token;
        }

        const { error: updateError } = await serviceClient
          .from('users')
          .update(updateData)
          .eq('id', authUserId);

        if (updateError) {
          console.error('캘린더 토큰 업데이트 실패:', updateError);
          throw new Error('캘린더 연동 정보 저장에 실패했습니다.');
        }
      }

      // Supabase Auth 세션 생성 (매직 링크 방식)
      const publicBase = (appBaseUrl || requestUrl.origin).replace(/\/$/, '');
      // redirectTo는 Redirect URLs에 정확히 등록된 경로와 맞아야 합니다.
      // `/dashboard`만 넣으면 목록에 없을 때 Site URL(배포)로 폴백되는 경우가 있습니다.
      const postLoginTarget = `${publicBase}/auth/callback?next=${encodeURIComponent(next)}`;

      const { data: linkData, error: linkError } =
        await serviceClient.auth.admin.generateLink({
          type: 'magiclink',
          email: userInfo.email,
          options: {
            redirectTo: postLoginTarget,
          },
        });

      if (linkError || !linkData) {
        console.error('매직 링크 생성 실패:', linkError);
        return NextResponse.redirect(
          new URL(
            `/login?success=google_auth&message=${encodeURIComponent('구글 로그인이 완료되었습니다. 이메일로 로그인해주세요.')}`,
            appBaseUrl || requestUrl.origin
          )
        );
      }

      // 매직 링크의 action_link로 리다이렉트하여 자동 로그인
      if (linkData.properties?.action_link) {
        return NextResponse.redirect(linkData.properties.action_link);
      }

      return NextResponse.redirect(
        new URL(
          `/login?success=google_auth&message=${encodeURIComponent('구글 로그인이 완료되었습니다. 이메일로 로그인해주세요.')}`,
          appBaseUrl || requestUrl.origin
        )
      );
    } else {
      // ─── 캘린더 연동 플로우: 기존 사용자의 캘린더 토큰만 업데이트 ───
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      if (!authUser) {
        return NextResponse.redirect(
          new URL(`/login?error=auth_required&message=${encodeURIComponent('로그인이 필요합니다.')}`, appBaseUrl || requestUrl.origin)
        );
      }

      // ✅ 안전장치: "어떤 구글 계정으로 연동했는지"가 현재 로그인된 유저와 일치하는지 확인합니다.
      // - connect 플로우는 기존 로그인 세션을 유지한 채로 Google OAuth를 다시 타기 때문에,
      //   사용자가 실수로 다른 구글 계정을 선택하면 그 토큰이 users 테이블에 저장되어
      //   캘린더 이벤트가 '다른 계정 캘린더'에 생성되는 문제가 생길 수 있습니다.
      // - 따라서 Google userinfo.email 과 Supabase authUser.email 이 다르면 저장을 차단합니다.
      if (authUser.email && userInfo.email && authUser.email.toLowerCase() !== userInfo.email.toLowerCase()) {
        console.error('[Google OAuth][connect] 계정 불일치로 연동 차단', {
          authEmail: authUser.email,
          googleEmail: userInfo.email,
          userId: authUser.id,
        });

        return NextResponse.redirect(
          new URL(
            `/dashboard/connect-calendar?error=calendar_account_mismatch&message=${encodeURIComponent(
              `구글 캘린더 연동 계정이 현재 로그인 계정과 다릅니다. (로그인: ${authUser.email}, 선택한 구글: ${userInfo.email}) 올바른 계정으로 다시 연동해주세요.`
            )}`,
            appBaseUrl || requestUrl.origin
          )
        );
      }

      // 기존 refresh_token 조회
      const { data: existingUserData } = await serviceClient
        .from('users')
        .select('calendar_refresh_token')
        .eq('id', authUser.id)
        .single();

      // ─── refresh_token 자동 재시도 로직 (connect 플로우) ───
      // 로그인 플로우와 동일하게, DB 어디에도 refresh_token이 없다면
      // prompt: 'consent'를 강제로 띄워서 한 번 더 권한을 요청합니다.
      const hasNewRefreshToken = !!tokens.refresh_token;
      const hasExistingRefreshToken = !!existingUserData?.calendar_refresh_token;

      if (!hasNewRefreshToken && !hasExistingRefreshToken) {
        console.log('[OAuth 콜백][connect] refresh_token 없음 → force_consent로 재시도');

        // 캘린더 전용 OAuth 엔드포인트로 재요청 (type=connect 명시)
        return NextResponse.redirect(
          new URL(
            `/api/auth/google?next=${encodeURIComponent(next)}&type=connect&force_consent=true`,
            appBaseUrl || requestUrl.origin
          )
        );
      }

      const updateData: {
        calendar_provider: string;
        calendar_access_token: string;
        calendar_refresh_token?: string;
      } = {
        calendar_provider: 'google',
        calendar_access_token: tokens.access_token,
      };

      // refresh_token 결정: 새 토큰 우선 → 기존 토큰 유지
      if (tokens.refresh_token) {
        updateData.calendar_refresh_token = tokens.refresh_token;
      } else if (existingUserData?.calendar_refresh_token) {
        updateData.calendar_refresh_token = existingUserData.calendar_refresh_token;
      }

      const { error: updateError } = await serviceClient
        .from('users')
        .update(updateData)
        .eq('id', authUser.id);

      if (updateError) {
        console.error('구글 캘린더 토큰 저장 실패:', updateError);
        return NextResponse.redirect(
          new URL(
            `/dashboard?error=token_save_error&message=${encodeURIComponent('구글 캘린더 연동 정보 저장에 실패했습니다.')}`,
            appBaseUrl || requestUrl.origin
          )
        );
      }

      // 성공 시 대시보드로 리다이렉트
      return NextResponse.redirect(
        new URL(
          `${next}?success=calendar_connected&message=${encodeURIComponent('구글 캘린더가 성공적으로 연동되었습니다.')}`,
          appBaseUrl || requestUrl.origin
        )
      );
    }
  } catch (err: any) {
    console.error('구글 OAuth 콜백 처리 중 오류:', err);
    const errorMessage = flowType === 'login'
      ? '구글 로그인 처리 중 오류가 발생했습니다'
      : '구글 캘린더 연동 처리 중 오류가 발생했습니다';
    const base = appBaseUrl || requestUrl.origin;
    return NextResponse.redirect(buildOAuthErrorLoginUrl(base, errorMessage, err));
  }
}
