import { Suspense } from 'react';
import { ConnectCalendarPageClient } from './ConnectCalendarPageClient';

/**
 * 구글 캘린더 연동 페이지 (서버 컴포넌트)
 * - `useSearchParams()`를 사용하는 클라이언트 컴포넌트는 Suspense로 감싸야 빌드(프리렌더) 에러가 나지 않습니다.
 */
export default function ConnectCalendarPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <ConnectCalendarPageClient />
    </Suspense>
  );
}
