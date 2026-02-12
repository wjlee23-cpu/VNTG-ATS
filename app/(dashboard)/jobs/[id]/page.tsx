import { createClient } from '@/lib/supabase/server'
import { getJobPost } from '@/actions/jobs'
import { getProcesses } from '@/actions/processes'
import { JobPostingBuilder } from '@/components/jobs/JobPostingBuilder'
import { redirect } from 'next/navigation'

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
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

  const job = await getJobPost(id)
  
  if (!job) {
    redirect('/jobs')
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

  return (
    <JobPostingBuilder 
      processes={processes || []} 
      jobId={id}
      initialJob={{
        title: job.title,
        description: job.description,
        department: 'Product', // TODO: department 필드가 있다면 사용
        processes: job.processes,
      }}
    />
  )
}
