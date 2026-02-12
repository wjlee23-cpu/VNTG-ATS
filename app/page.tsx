import { createClient } from '@/lib/supabase/server'
import { getCandidates } from '@/actions/candidates'
import { getJobPosts } from '@/actions/jobs'
import { KanbanBoard } from '@/components/dashboard/KanbanBoard'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { LogoutButton } from '@/components/dashboard/LogoutButton'

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

  // 개발 모드에서 user가 없을 때 mock user 사용
  const displayUser = user || { email: 'dev@example.com' }

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
    // 데이터베이스 에러는 무시 (개발 초기 단계)
    console.error('Error loading data:', error)
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white shadow-sm">
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center border-b px-6">
            <h1 className="text-xl font-bold text-gray-900">RecruitOps</h1>
          </div>
          <nav className="flex-1 space-y-1 px-3 py-4">
            <Link
              href="/"
              className="block rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              대시보드
            </Link>
            <Link
              href="/jobs"
              className="block rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              채용 공고
            </Link>
            <Link
              href="/candidates"
              className="block rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              후보자
            </Link>
          </nav>
          <div className="border-t p-4">
            <div className="mb-2 text-sm text-gray-600">{displayUser.email}</div>
            {user && <LogoutButton />}
            {!user && isDevelopment && (
              <div className="text-xs text-yellow-600">개발 모드 (인증 없음)</div>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
              <p className="mt-1 text-sm text-gray-600">
                {candidates.length}명의 후보자, {jobs.length}개의 채용 공고
              </p>
            </div>

            {candidatesWithDetails.length > 0 ? (
              <KanbanBoard candidates={candidatesWithDetails} />
            ) : (
              <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
                <p className="text-gray-500">아직 후보자가 없습니다.</p>
                <Link
                  href="/jobs/new"
                  className="mt-4 inline-block text-blue-600 hover:text-blue-700"
                >
                  첫 채용 공고 만들기
                </Link>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
