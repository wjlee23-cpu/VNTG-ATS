import { getCandidateByToken } from '@/actions/candidates'
import { getScheduleOptions, confirmScheduleOption } from '@/actions/schedules'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SchedulingPageClient } from '@/components/candidate/SchedulingPageClient'
import { format } from 'date-fns'

export default async function CandidatePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const candidate = await getCandidateByToken(token)

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
      <div className="flex min-h-screen items-center justify-center bg-white p-4">
        <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-md">
          <h1 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Roboto, sans-serif' }}>
            안녕하세요, {candidate.name}님
          </h1>
          <p className="mt-2 text-gray-600" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
            현재 선택 가능한 면접 일정이 없습니다. 담당자에게 문의해주세요.
          </p>
        </div>
      </div>
    )
  }

  const options = await getScheduleOptions(schedule.id)

  return (
    <SchedulingPageClient
      candidate={candidate}
      scheduleId={schedule.id}
      options={options.map((opt: any) => ({
        id: opt.id,
        scheduledAt: new Date(opt.scheduled_at),
      }))}
      candidateToken={token}
    />
  )
}
