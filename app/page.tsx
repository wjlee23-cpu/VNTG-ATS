import { createClient } from '@/lib/supabase/server'
import { getCandidates } from '@/actions/candidates'
import { getJobPosts } from '@/actions/jobs'
import { CandidateDashboard } from '@/components/dashboard/CandidateDashboard'
import { redirect } from 'next/navigation'

export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 개발 모드: 인증 체크 비활성화
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  if (!isDevelopment && !user) {
    redirect('/login')
  }

  let candidates: any[] = []
  let jobs: any[] = []
  let candidatesWithDetails: any[] = []

  try {
    candidates = await getCandidates()
    jobs = await getJobPosts()

    // Fetch full candidate data with job post and process info
    candidatesWithDetails = await Promise.all(
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
  } catch (error) {
    // 개발 모드: 에러를 조용히 처리 (인증 없이도 동작 가능)
    if (isDevelopment) {
      console.warn('Development mode: Error loading data (this is expected without auth):', error)
    } else {
      console.error('Error loading data:', error)
    }
  }

  return <CandidateDashboard candidates={candidatesWithDetails} jobs={jobs} />
}
