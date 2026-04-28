import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // OAuth 콜백 경로는 인증 체크 제외
  const isAuthCallback = request.nextUrl.pathname.startsWith('/auth/callback');
  
  // 공개 경로 목록 (인증 없이 접근 가능)
  const publicPaths = ['/login', '/signup', '/candidate', '/api', '/auth/callback'];
  const isPublicPath = publicPaths.some(path => request.nextUrl.pathname.startsWith(path));
  
  // 루트 경로는 랜딩 페이지이므로 공개 경로로 처리
  const isRootPath = request.nextUrl.pathname === '/';
  
  // 개발 모드: 인증 체크 비활성화
  const isDevelopment = process.env.NODE_ENV === 'development'

  // 보호된 경로 목록
  const isProtectedPath =
    request.nextUrl.pathname.startsWith('/dashboard') || 
    request.nextUrl.pathname.startsWith('/candidates') ||
    request.nextUrl.pathname.startsWith('/jobs') ||
    request.nextUrl.pathname.startsWith('/calendar') ||
    request.nextUrl.pathname.startsWith('/analytics') ||
    request.nextUrl.pathname.startsWith('/offers') ||
    request.nextUrl.pathname.startsWith('/team') ||
    request.nextUrl.pathname.startsWith('/templates') ||
    request.nextUrl.pathname.startsWith('/settings') ||
    request.nextUrl.pathname.startsWith('/jd-requests');

  const isAuthPage =
    request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/signup');

  // ✅ 체감 속도 개선: 매 요청마다 세션 조회를 하지 않고, “필요한 경우에만” 호출합니다.
  // - 보호된 경로(프로덕션) 접근 시
  // - 로그인/회원가입 페이지에서 “이미 로그인된 사용자” 리다이렉트 판단 시
  const shouldCheckAuth =
    !isDevelopment &&
    !isAuthCallback &&
    (
      (isProtectedPath && !isPublicPath && !isRootPath) ||
      isAuthPage
    );

  let user: any = null;
  if (shouldCheckAuth) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              request.cookies.set(name, value)
            )
            response = NextResponse.next({
              request,
            })
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()
    user = authUser

    // Google 캘린더 refresh_token 없으면 대시보드(연동 페이지 제외) 접근 시 연동으로 유도
    const path = request.nextUrl.pathname
    const isDashboardConnectCalendar = path.startsWith('/dashboard/connect-calendar')
    if (
      authUser &&
      path.startsWith('/dashboard') &&
      !isDashboardConnectCalendar
    ) {
      const { data: userRow } = await supabase
        .from('users')
        .select('calendar_refresh_token')
        .eq('id', authUser.id)
        .maybeSingle()

      if (!userRow?.calendar_refresh_token) {
        return NextResponse.redirect(
          new URL('/dashboard/connect-calendar?from=session_gate', request.url)
        )
      }
    }
  }
  
  // 프로덕션 모드에서만 대시보드 경로 보호
  if (!isDevelopment && !isPublicPath && !isRootPath) {
    // 대시보드 및 보호된 경로 접근 시 인증 확인
    if (isProtectedPath) {
      if (!user) {
        return NextResponse.redirect(new URL('/', request.url))
      }
    }
  }

  // 로그인된 사용자가 인증 페이지에 접근하면 루트로 리다이렉트
  if ((request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/signup')) && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
