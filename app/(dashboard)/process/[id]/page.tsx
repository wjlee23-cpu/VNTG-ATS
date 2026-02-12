import { createClient } from '@/lib/supabase/server'
import { getProcess, updateProcess } from '@/actions/processes'
import { ProcessBuilder } from '@/components/process/ProcessBuilder'
import { redirect } from 'next/navigation'

export default async function ProcessPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 개발 모드: 인증 체크 비활성화
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  if (!isDevelopment && !user) {
    redirect('/login')
  }

  const process = await getProcess(params.id)
  const stages = (process.stages as any) || []

  // Get available interviewers
  const { data: userData } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  const { data: interviewers } = await supabase
    .from('users')
    .select('id, email')
    .eq('organization_id', userData?.organization_id)
    .in('role', ['interviewer', 'recruiter', 'admin'])

  async function handleSave(stages: any[]) {
    'use server'
    await updateProcess(params.id, { stages })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{process.name}</h1>
        <p className="mt-1 text-sm text-gray-600">채용 프로세스를 구성하고 관리하세요.</p>
      </div>

      <ProcessBuilder
        initialStages={stages}
        onSave={handleSave}
        availableInterviewers={interviewers || []}
      />
    </div>
  )
}
