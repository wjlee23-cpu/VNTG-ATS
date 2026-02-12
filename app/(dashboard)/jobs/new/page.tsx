import { createClient } from '@/lib/supabase/server'
import { getProcesses } from '@/actions/processes'
import { redirect } from 'next/navigation'
import { JobPostingBuilder } from '@/components/jobs/JobPostingBuilder'

export default async function NewJobPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 개발 모드: 인증 체크 비활성화
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  if (!isDevelopment && !user) {
    redirect('/login')
  }

  const processes = await getProcesses()

  return <JobPostingBuilder processes={processes} />
}
