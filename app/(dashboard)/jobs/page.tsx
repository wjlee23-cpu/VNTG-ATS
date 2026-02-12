import { createClient } from '@/lib/supabase/server'
import { getJobPosts } from '@/actions/jobs'
import { getProcesses } from '@/actions/processes'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'

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
  const processes = await getProcesses()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">채용 공고</h1>
        <Link
          href="/jobs/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          새 공고 만들기
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {jobs.map((job: any) => (
          <Link
            key={job.id}
            href={`/jobs/${job.id}`}
            className="rounded-lg border bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
          >
            <h3 className="text-lg font-semibold text-gray-900">{job.title}</h3>
            {job.description && (
              <p className="mt-2 text-sm text-gray-600 line-clamp-2">{job.description}</p>
            )}
            <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
              <span>{formatDate(job.created_at)}</span>
              <span>{job.processes?.name || '프로세스 없음'}</span>
            </div>
          </Link>
        ))}
      </div>

      {jobs.length === 0 && (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <p className="text-gray-500">아직 채용 공고가 없습니다.</p>
          <Link
            href="/jobs/new"
            className="mt-4 inline-block text-blue-600 hover:text-blue-700"
          >
            첫 공고 만들기
          </Link>
        </div>
      )}
    </div>
  )
}
