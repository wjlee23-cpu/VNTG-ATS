import { getCandidateByToken } from '@/actions/candidates'
import { getScheduleOptions, confirmScheduleOption } from '@/actions/schedules'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ScheduleSelectionForm } from '@/components/candidate/ScheduleSelectionForm'
import { format } from 'date-fns'

export default async function CandidatePage({ params }: { params: { token: string } }) {
  const candidate = await getCandidateByToken(params.token)

  if (!candidate) {
    redirect('/login')
  }

  // Get pending schedules
  const supabase = await createClient()
  const { data: schedules } = await supabase
    .from('schedules')
    .select('*')
    .eq('candidate_id', candidate.id)
    .eq('status', 'pending')
    .eq('candidate_response', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)

  const schedule = schedules?.[0]

  if (!schedule) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-md">
          <h1 className="text-xl font-bold text-gray-900">안녕하세요, {candidate.name}님</h1>
          <p className="mt-2 text-gray-600">
            현재 선택 가능한 면접 일정이 없습니다. 담당자에게 문의해주세요.
          </p>
        </div>
      </div>
    )
  }

  const options = await getScheduleOptions(schedule.id)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-md p-4">
        <div className="rounded-lg bg-white p-6 shadow-md">
          <h1 className="text-2xl font-bold text-gray-900">면접 일정 선택</h1>
          <p className="mt-2 text-gray-600">
            안녕하세요, {candidate.name}님. 아래 일정 중 편하신 시간을 선택해주세요.
          </p>

          <ScheduleSelectionForm
            scheduleId={schedule.id}
            options={options.map((opt: any) => ({
              id: opt.id,
              scheduledAt: new Date(opt.scheduled_at),
            }))}
            candidateToken={params.token}
          />
        </div>
      </div>
    </div>
  )
}
