import { createClient } from '@/lib/supabase/server'
import { getCandidate } from '@/actions/candidates'
import { createScheduleRequest } from '@/actions/schedules'
import { redirect } from 'next/navigation'
import { ScheduleRequestForm } from '@/components/schedule/ScheduleRequestForm'
import { addDays } from 'date-fns'

export default async function SchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 개발 모드: 인증 체크 비활성화
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  if (!isDevelopment && !user) {
    redirect('/login')
  }

  const candidate = await getCandidate(id)
  const jobPost = candidate.job_posts as any
  const process = jobPost?.processes
  const stages = (process?.stages as any) || []
  const currentStage = stages.find((s: any) => s.id === candidate.current_stage_id)

  if (!currentStage) {
    return (
      <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4">
        <p className="text-yellow-800">
          현재 단계가 설정되지 않았습니다. 먼저 후보자를 단계에 할당해주세요.
        </p>
      </div>
    )
  }

  const defaultStartDate = new Date()
  const defaultEndDate = addDays(defaultStartDate, 14)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">면접 일정 조율</h1>
        <p className="mt-1 text-sm text-gray-600">
          {candidate.name}님의 {currentStage.name} 일정을 조율합니다.
        </p>
      </div>

      <ScheduleRequestForm
        candidateId={id}
        stageId={currentStage.id}
        defaultStartDate={defaultStartDate}
        defaultEndDate={defaultEndDate}
      />
    </div>
  )
}
