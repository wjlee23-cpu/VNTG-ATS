import { getAllScheduleProgress } from '@/api/queries/schedules';
import { SchedulesClient } from './SchedulesClient';
import { getCurrentUser } from '@/api/utils/auth';
import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export default async function SchedulesPage() {
  // 관리자 또는 리크루터 권한 확인
  const user = await getCurrentUser();
  if (user.role !== 'admin' && user.role !== 'recruiter') {
    redirect('/dashboard');
  }

  const isAdmin = user.role === 'admin';
  const supabase = isAdmin ? createServiceClient() : await createClient();

  // 모든 면접 일정 진행상황 조회
  const result = await getAllScheduleProgress();
  const schedules = result.data || [];

  // 수동 조율 관련 데이터 조회
  // 재조율이 필요한 일정 조회
  const { data: needsRescheduling } = await supabase
    .from('schedules')
    .select(`
      *,
      candidates (
        id,
        name,
        email,
        job_posts (
          id,
          title
        )
      )
    `)
    .or('needs_rescheduling.eq.true,workflow_status.eq.needs_rescheduling')
    .order('created_at', { ascending: false });

  // 수동 조율로 생성/수정된 일정 조회
  const { data: manualSchedules } = await supabase
    .from('schedules')
    .select(`
      *,
      candidates (
        id,
        name,
        email,
        job_posts (
          id,
          title
        )
      )
    `)
    .eq('manual_override', true)
    .order('updated_at', { ascending: false })
    .limit(20);

  // 확정된 일정 중 수정 가능한 일정 조회
  const { data: confirmedSchedules } = await supabase
    .from('schedules')
    .select(`
      *,
      candidates (
        id,
        name,
        email,
        job_posts (
          id,
          title
        )
      )
    `)
    .eq('workflow_status', 'confirmed')
    .order('scheduled_at', { ascending: false })
    .limit(20);

  return (
    <SchedulesClient
      initialSchedules={schedules}
      needsRescheduling={needsRescheduling || []}
      manualSchedules={manualSchedules || []}
      confirmedSchedules={confirmedSchedules || []}
    />
  );
}
