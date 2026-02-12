import { createClient } from '@/lib/supabase/server'
import { getJobPost } from '@/actions/jobs'
import { createCandidate } from '@/actions/candidates'
import { redirect } from 'next/navigation'
import { CandidateForm } from '@/components/candidates/CandidateForm'

export default async function NewCandidatePage({ params }: { params: Promise<{ id: string }> }) {
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">새 후보자 추가</h1>
        <p className="mt-1 text-sm text-gray-600">{job.title}</p>
      </div>
      <CandidateForm jobPostId={id} />
    </div>
  )
}
