import { createClient } from '@/lib/supabase/server'
import { getJobPosts } from '@/actions/jobs'
import { getCandidates } from '@/actions/candidates'
import { JobsPageClient } from '@/components/jobs/JobsPageClient'

export default async function JobsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 개발 모드: 인증 체크 비활성화
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  if (!isDevelopment && !user) {
    return null
  }

  const jobs = await getJobPosts()
  const candidates = await getCandidates()

  return <JobsPageClient jobs={jobs} allJobs={jobs} candidates={candidates} />
}
