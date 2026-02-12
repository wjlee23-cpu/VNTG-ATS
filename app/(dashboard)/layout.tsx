import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardLayoutClient } from '@/components/dashboard/DashboardLayoutClient'
import { ConditionalLayoutWrapper } from '@/components/dashboard/ConditionalLayoutWrapper'
import { getCandidates } from '@/actions/candidates'
import { getJobPosts } from '@/actions/jobs'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 개발 모드: 인증 체크 비활성화
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  if (!isDevelopment && !user) {
    redirect('/login')
  }

  // 개발 모드에서 user가 없을 때 mock user 사용
  const displayUser = user || { email: 'dev@example.com' }

  // 상단바를 위한 데이터 가져오기
  let candidates: any[] = []
  let jobs: any[] = []
  
  try {
    candidates = await getCandidates()
    jobs = await getJobPosts()
  } catch (error) {
    // 개발 모드: 에러를 조용히 처리
    if (isDevelopment) {
      console.warn('Development mode: Error loading data for top nav:', error)
    }
  }

  return (
    <ConditionalLayoutWrapper
      userEmail={displayUser.email}
      hasUser={!!user}
      isDevelopment={isDevelopment}
      candidates={candidates}
      jobs={jobs}
    >
      {children}
    </ConditionalLayoutWrapper>
  )
}
