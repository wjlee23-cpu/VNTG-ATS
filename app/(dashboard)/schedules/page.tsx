import { getAllScheduleProgress } from '@/api/queries/schedules';
import { SchedulesClient } from './SchedulesClient';
import { getCurrentUser } from '@/api/utils/auth';
import { redirect } from 'next/navigation';

export default async function SchedulesPage() {
  // 관리자 권한 확인
  const user = await getCurrentUser();
  if (user.role !== 'admin') {
    redirect('/dashboard');
  }

  // 모든 면접 일정 진행상황 조회
  const result = await getAllScheduleProgress();
  const schedules = result.data || [];

  return <SchedulesClient initialSchedules={schedules} />;
}
