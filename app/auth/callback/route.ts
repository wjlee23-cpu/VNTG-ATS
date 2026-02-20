import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * OAuth 콜백 처리 라우트
 * Supabase OAuth 로그인 후 리디렉트되는 경로
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') || '/dashboard';

  // 코드가 없으면 에러
  if (!code) {
    return NextResponse.redirect(
      new URL(`/login?error=oauth_error&message=인증 코드를 받지 못했습니다`, requestUrl.origin)
    );
  }

  const supabase = await createClient();

  try {
    // OAuth 세션 교환
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data.session) {
      console.error('OAuth 세션 교환 실패:', error);
      return NextResponse.redirect(
        new URL(`/login?error=session_error&message=${encodeURIComponent(error?.message || '세션 생성에 실패했습니다')}`, requestUrl.origin)
      );
    }

    // 사용자가 users 테이블에 있는지 확인
    let { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, organization_id, role')
      .eq('id', data.session.user.id)
      .single();

    // 사용자가 users 테이블에 없으면 자동으로 생성
    if (userError || !userData) {
      // Service Role Client를 사용하여 RLS 정책 우회 (조직 생성/조회용)
      const serviceClient = createServiceClient();

      // 전체 users 테이블의 사용자 수 확인 (최초 사용자 판단용)
      const { count: totalUsers } = await serviceClient
        .from('users')
        .select('*', { count: 'exact', head: true });

      // 기본 조직 찾기 또는 생성 (Service Role Client 사용)
      let { data: organization } = await serviceClient
        .from('organizations')
        .select('id')
        .limit(1)
        .maybeSingle();

      // 조직이 없으면 생성
      if (!organization) {
        const { data: newOrg, error: orgError } = await serviceClient
          .from('organizations')
          .insert({ name: 'VNTG Tech' })
          .select('id')
          .single();

        if (orgError || !newOrg) {
          console.error('조직 생성 실패:', orgError);
          await supabase.auth.signOut();
          return NextResponse.redirect(
            new URL(`/login?error=org_error&message=${encodeURIComponent('조직 생성에 실패했습니다. 관리자에게 문의하세요.')}`, requestUrl.origin)
          );
        }
        organization = newOrg;
      }

      // 최초 사용자는 admin, 그 외는 recruiter로 설정
      // 또는 특정 이메일 도메인(@vntgcorp.com)은 admin으로 설정
      const userEmail = data.session.user.email || '';
      const isVNTGEmail = userEmail.endsWith('@vntgcorp.com');
      const isFirstUser = (totalUsers || 0) === 0;
      const userRole = (isFirstUser || isVNTGEmail) ? 'admin' : 'recruiter';

      // 사용자 생성 (Service Role Client 사용하여 RLS 정책 우회)
      const { data: newUser, error: createError } = await serviceClient
        .from('users')
        .insert({
          id: data.session.user.id,
          email: userEmail,
          organization_id: organization.id,
          role: userRole,
        })
        .select('id, email, organization_id, role')
        .single();

      if (createError || !newUser) {
        console.error('사용자 생성 실패:', createError);
        await supabase.auth.signOut();
        return NextResponse.redirect(
          new URL(`/login?error=user_create_error&message=${encodeURIComponent('사용자 생성에 실패했습니다. 관리자에게 문의하세요.')}`, requestUrl.origin)
        );
      }

      userData = newUser;
    }

    // 성공 시 대시보드로 리다이렉트
    return NextResponse.redirect(new URL(next, requestUrl.origin));
  } catch (err) {
    console.error('OAuth 콜백 처리 중 오류:', err);
    return NextResponse.redirect(
      new URL(`/login?error=unknown_error&message=${encodeURIComponent('로그인 처리 중 오류가 발생했습니다')}`, requestUrl.origin)
    );
  }
}
