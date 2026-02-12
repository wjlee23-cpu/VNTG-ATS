import { createClient } from '@/lib/supabase/server'
import { createProcess } from '@/actions/processes'
import { redirect } from 'next/navigation'
import { ProcessCreationForm } from '@/components/process/ProcessCreationForm'

export default async function NewProcessPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 개발 모드: 인증 체크 비활성화
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  if (!isDevelopment && !user) {
    redirect('/login')
  }

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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">새 프로세스 만들기</h1>
      <ProcessCreationForm availableInterviewers={interviewers || []} />
    </div>
  )
}
