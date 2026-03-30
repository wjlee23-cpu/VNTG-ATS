import { Suspense } from 'react';
import { LoginPageClient } from './LoginPageClient';

/**
 * 로그인 페이지 (서버 컴포넌트)
 * - `useSearchParams()`를 사용하는 클라이언트 컴포넌트는 반드시 Suspense로 감싸야 빌드(프리렌더) 에러가 나지 않습니다.
 */
export default function LoginPage() {
  return (
    <Suspense fallback={<div className="w-full max-w-md" />}>
      <LoginPageClient />
    </Suspense>
  );
}
