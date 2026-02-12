import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { updateCandidateStatus } from '@/actions/candidates'
import { ArrowLeft, User } from 'lucide-react'
import Link from 'next/link'

interface CandidateHeaderProps {
  candidate: {
    id: string
    name: string
    email: string
    status: string
    job_posts?: {
      title: string
    }
  }
}

export function CandidateHeader({ candidate }: CandidateHeaderProps) {
  const statusVariant =
    candidate.status === 'pending'
      ? 'warning'
      : candidate.status === 'in_progress'
        ? 'primary'
        : candidate.status === 'confirmed'
          ? 'success'
          : 'danger'

  return (
    <div className="space-y-4">
      <Link
        href="/"
        className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
        style={{ fontFamily: 'Noto Sans KR, sans-serif' }}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        대시보드로 돌아가기
      </Link>

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#0248FF] text-white">
            <User className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
              {candidate.name}
            </h1>
            <p className="mt-1 text-sm text-gray-600" style={{ fontFamily: 'Roboto, sans-serif' }}>
              {candidate.email}
            </p>
            {candidate.job_posts && (
              <p className="mt-1 text-sm text-gray-500" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                {candidate.job_posts.title}
              </p>
            )}
          </div>
          <Badge variant={statusVariant}>{candidate.status}</Badge>
        </div>

        <div className="flex gap-2">
          {candidate.status === 'pending' && (
            <form action={updateCandidateStatus.bind(null, candidate.id, 'in_progress')}>
              <Button type="submit" variant="primary">
                Advance to Interview
              </Button>
            </form>
          )}
          <form action={updateCandidateStatus.bind(null, candidate.id, 'rejected')}>
            <Button type="submit" variant="outline">
              Archive
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
