'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { createClient } from '@/lib/supabase/client';
import { sanitizeNextPath } from '@/lib/url/sanitize-next-path';

function parseHashTokens(hash: string): Record<string, string> {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const params = new URLSearchParams(raw);
  const out: Record<string, string> = {};
  params.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

/**
 * Supabase 인증 콜백(`/auth/callback`) 처리 (클라이언트)
 * - Next.js는 `useSearchParams()` 사용 페이지를 Suspense로 감싸야 빌드/프리렌더가 안정적입니다.
 *   → 실제 로직은 이 컴포넌트로 분리하고, `page.tsx`에서 Suspense로 감쌉니다.
 */
export function AuthCallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const next = sanitizeNextPath(searchParams.get('next'), '/dashboard');
      const redirectToLogin = (message: string) => {
        if (cancelled) return;
        setError(message);
        router.replace(`/login?error=oauth_error&message=${encodeURIComponent(message)}`);
      };

      try {
        // 이미 로그인 세션이 있으면 그대로 이동합니다.
        const sessionRes = await supabase.auth.getSession();
        if (sessionRes.data.session) {
          router.replace(next);
          return;
        }

        // 1) OAuth code 기반 흐름이 섞여있을 수 있으므로 우선 처리합니다.
        const code = searchParams.get('code');
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            console.error('[auth/callback] exchangeCodeForSession 실패:', exchangeError);
          }
        }

        // exchangeCodeForSession 후 세션 재확인
        const afterCodeSession = await supabase.auth.getSession();
        if (afterCodeSession.data.session) {
          router.replace(next);
          return;
        }

        // 2) Supabase magiclink는 보통 URL hash(#access_token=..., refresh_token=...)로 토큰을 전달합니다.
        const tokens = parseHashTokens(window.location.hash);
        const accessToken = tokens.access_token;
        const refreshToken = tokens.refresh_token;

        if (accessToken && refreshToken) {
          const { error: setSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (setSessionError) {
            console.error('[auth/callback] setSession 실패:', setSessionError);
          }
        } else if (tokens.token_hash) {
          // 일부 플로우(토큰 해시 기반) 호환을 위한 안전장치
          const tokenHash = tokens.token_hash;
          const otpType = tokens.type === 'signup' ? 'signup' : 'magiclink';
          const { error: verifyError } = await supabase.auth.verifyOtp({
            type: otpType,
            token_hash: tokenHash,
          });
          if (verifyError) {
            console.error('[auth/callback] verifyOtp 실패:', verifyError);
          }
        }

        // 최종 세션 확보 여부 확인
        const finalSession = await supabase.auth.getSession();
        if (finalSession.data.session) {
          // 토큰/코드가 남아있지 않게 URL을 정리합니다.
          const url = new URL(window.location.href);
          url.hash = '';
          url.searchParams.delete('code');
          window.history.replaceState({}, '', url.toString());

          router.replace(next);
          return;
        }

        redirectToLogin('인증 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
      } catch (err) {
        console.error('[auth/callback] 처리 중 오류:', err);
        redirectToLogin('인증 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [searchParams, router, supabase]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center">
        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : (
          <p className="text-sm text-neutral-600">인증 처리 중...</p>
        )}
      </div>
    </div>
  );
}
