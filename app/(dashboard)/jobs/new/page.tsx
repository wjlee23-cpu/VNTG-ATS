import { createClient } from '@/lib/supabase/server'
import { getProcesses } from '@/actions/processes'
import { createJobPost } from '@/actions/jobs'
import { redirect } from 'next/navigation'
import { JobPostForm } from '@/components/jobs/JobPostForm'

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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">새 채용 공고</h1>
      <JobPostForm processes={processes} />
    </div>
  )
}
