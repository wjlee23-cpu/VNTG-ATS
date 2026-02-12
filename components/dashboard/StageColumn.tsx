'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CandidateCard } from './CandidateCard'

interface StageColumnProps {
  stage: { id: string; name: string; order: number }
  candidates: Array<{
    id: string
    name: string
    email: string
    status: string
    current_stage_id: string | null
    job_posts: {
      id: string
      title: string
    }
  }>
}

export function StageColumn({ stage, candidates }: StageColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
  })

  return (
    <div
      ref={setNodeRef}
      className={`flex h-full min-w-[280px] flex-col rounded-lg border-2 bg-gray-50 p-4 ${
        isOver ? 'border-[#0248FF] bg-[#0248FF]/5' : 'border-gray-200'
      }`}
    >
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-900" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
          {stage.name}
        </h3>
        <p className="text-xs text-gray-500" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
          {candidates.length}명
        </p>
      </div>

      <SortableContext items={candidates.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2">
          {candidates.map((candidate) => (
            <CandidateCard key={candidate.id} candidate={candidate} />
          ))}
        </div>
      </SortableContext>

      {candidates.length === 0 && (
        <div className="flex flex-1 items-center justify-center text-sm text-gray-400" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
          후보자를 여기로 드래그하세요
        </div>
      )}
    </div>
  )
}
