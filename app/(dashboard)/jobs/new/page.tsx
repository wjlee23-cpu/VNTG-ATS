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

  let processes: any[] = []
  
  try {
    processes = await getProcesses()
  } catch (error) {
    // 개발 모드: 에러를 조용히 처리 (테이블이 없을 수 있음)
    if (isDevelopment) {
      console.warn('Development mode: Error loading processes (this is expected if table does not exist):', error)
    } else {
      console.error('Error loading processes:', error)
    }
  }

  return <JobPostingBuilder processes={processes || []} />
}
