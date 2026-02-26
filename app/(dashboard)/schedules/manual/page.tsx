import { redirect } from 'next/navigation';

// 수동 조율 대시보드는 이제 /schedules 페이지의 탭으로 통합되었습니다.
// 이 페이지로 접근하면 자동으로 /schedules 페이지로 리다이렉트됩니다.
export default async function ManualSchedulesPage() {
  redirect('/schedules');
}
