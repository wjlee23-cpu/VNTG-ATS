'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Link from 'next/link'

interface CandidateCardProps {
  candidate: {
    id: string
    name: string
    email: string
    status: string
    job_posts: {
      id: string
      title: string
    }
  }
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-[#0248FF]/10 text-[#0248FF]',
  confirmed: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  issue: 'bg-orange-100 text-orange-800',
}

const statusLabels: Record<string, string> = {
  pending: '대기',
  in_progress: '진행중',
  confirmed: '확정',
  rejected: '거절',
  issue: '이슈',
}

export function CandidateCard({ candidate }: CandidateCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: candidate.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-grab rounded-lg border bg-white p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing"
    >
      <Link href={`/candidates/${candidate.id}`}>
        <div className="space-y-2">
          <div className="flex items-start justify-between">
            <h4 className="font-medium text-gray-900" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
              {candidate.name}
            </h4>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                statusColors[candidate.status] || statusColors.pending
              }`}
              style={{ fontFamily: 'Noto Sans KR, sans-serif' }}
            >
              {statusLabels[candidate.status] || candidate.status}
            </span>
          </div>
          <p className="text-sm text-gray-600" style={{ fontFamily: 'Roboto, sans-serif' }}>
            {candidate.email}
          </p>
          <p className="text-xs text-gray-500" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
            {candidate.job_posts.title}
          </p>
        </div>
      </Link>
    </div>
  )
}
