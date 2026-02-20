import { getSchedulesByDateRange } from '@/api/queries/schedules';
import { CalendarClient } from './CalendarClient';

export default async function CalendarPage() {
  // 이번 달의 시작과 끝 날짜
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const schedulesResult = await getSchedulesByDateRange(startDate, endDate);
  const schedules = schedulesResult.data || [];
  const error = schedulesResult.error;

  return (
    <CalendarClient 
      initialSchedules={schedules}
      error={error}
    />
  );
}
