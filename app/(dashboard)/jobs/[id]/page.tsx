import { createClient } from '@/lib/supabase/server'
import { getJobPost } from '@/actions/jobs'
import { getCandidates } from '@/actions/candidates'
import { KanbanBoard } from '@/components/dashboard/KanbanBoard'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function JobDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 개발 모드: 인증 체크 비활성화
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  if (!isDevelopment && !user) {
    redirect('/login')
  }

  const job = await getJobPost(params.id)
  const candidates = await getCandidates(params.id)

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
      <div className="flex items-center justify-between">
        <div>
          <Link href="/jobs" className="text-sm text-gray-600 hover:text-gray-900">
            ← 채용 공고 목록
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">{job.title}</h1>
          {job.description && (
            <p className="mt-1 text-sm text-gray-600">{job.description}</p>
          )}
        </div>
        <Link
          href={`/jobs/${params.id}/candidates/new`}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          후보자 추가
        </Link>
      </div>

      <KanbanBoard candidates={candidatesWithDetails} jobPostId={params.id} />
    </div>
  )
}
