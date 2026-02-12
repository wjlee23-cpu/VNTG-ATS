import { createClient } from '@/lib/supabase/server'
import { getProcess, updateProcess } from '@/actions/processes'
import { WorkflowBuilder } from '@/components/process/WorkflowBuilder'
import { redirect } from 'next/navigation'

export default async function ProcessPage({ params }: { params: Promise<{ id: string }> }) {
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

  const process = await getProcess(id)
  const stages = (process.stages as any) || []

  // Get available interviewers
  const { data: userData } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user?.id)
    .single()

  const { data: interviewers } = await supabase
    .from('users')
    .select('id, email')
    .eq('organization_id', userData?.organization_id)
    .in('role', ['interviewer', 'recruiter', 'admin'])

  async function handleSave(stages: any[]) {
    'use server'
    await updateProcess(id, { stages })
  }

  return (
    <WorkflowBuilder
      initialStages={stages}
      onSave={handleSave}
      availableInterviewers={interviewers || []}
      jobPostTitle={process.name}
    />
  )
}
