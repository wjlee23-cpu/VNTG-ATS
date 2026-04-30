import { Suspense } from 'react';

import { AuthCallbackClient } from '@/components/auth/AuthCallbackClient';

/**
 * Supabase 인증 콜백(`/auth/callback`)
 * - `useSearchParams()`는 CSR bailout 규칙 때문에 Suspense boundary가 필요합니다.
 */
export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-6">
          <p className="text-sm text-neutral-600">인증 처리 중...</p>
        </div>
      }
    >
      <AuthCallbackClient />
    </Suspense>
  );
}

