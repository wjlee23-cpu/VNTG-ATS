import { createClient } from '@/lib/supabase/server'
import { getCandidates } from '@/actions/candidates'
import { getJobPosts } from '@/actions/jobs'
import { MainDashboard } from '@/components/dashboard/MainDashboard'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 개발 모드: 인증 체크 비활성화
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  if (!isDevelopment && !user) {
    redirect('/login')
  }

  const candidates = await getCandidates()
  const jobs = await getJobPosts()

  // Fetch full candidate data with job post and process info
  const candidatesWithDetails = await Promise.all(
    candidates.map(async (candidate: any) => {
      const { data: jobPost } = await supabase
        .from('job_posts')
        .select('*, processes(*)')
        .eq('id', candidate.job_post_id)
        .single()

      return {
        ...candidate,
        job_posts: jobPost,
      }
    })
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
          대시보드
        </h1>
        <p className="mt-1 text-sm text-gray-600" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
          {candidates.length}명의 후보자, {jobs.length}개의 채용 공고
        </p>
      </div>

      <MainDashboard candidates={candidatesWithDetails} jobs={jobs} />
    </div>
  )
}
