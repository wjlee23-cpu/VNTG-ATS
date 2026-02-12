'use client'

import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import { CandidateCard } from './CandidateCard'
import { StageColumn } from './StageColumn'
import { updateCandidateStage } from '@/actions/candidates'

interface Candidate {
  id: string
  name: string
  email: string
  status: string
  current_stage_id: string | null
  job_posts: {
    id: string
    title: string
    processes: {
      stages: any
    }
  }
}

interface KanbanBoardProps {
  candidates: Candidate[]
  jobPostId?: string
}

export function KanbanBoard({ candidates, jobPostId }: KanbanBoardProps) {
  const [localCandidates, setLocalCandidates] = useState(candidates)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor)
  )

  // Extract stages from the first candidate's job post process
  const stages = candidates[0]?.job_posts?.processes?.stages || []
  const sortedStages = [...stages].sort((a: any, b: any) => a.order - b.order)

  // Group candidates by stage
  const candidatesByStage = sortedStages.reduce((acc: Record<string, Candidate[]>, stage: any) => {
    acc[stage.id] = localCandidates.filter(
      (c) => c.current_stage_id === stage.id
    )
    return acc
  }, {})

  // Candidates without a stage
  const unassignedCandidates = localCandidates.filter((c) => !c.current_stage_id)

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event

    if (!over) return

    const candidateId = active.id as string
    const targetStageId = over.id as string

    // Don't update if dropped in the same stage
    const candidate = localCandidates.find((c) => c.id === candidateId)
    if (candidate?.current_stage_id === targetStageId) return

    // Optimistic update
    setLocalCandidates((prev) =>
      prev.map((c) =>
        c.id === candidateId ? { ...c, current_stage_id: targetStageId } : c
      )
    )

    try {
      await updateCandidateStage(candidateId, targetStageId)
    } catch (error) {
      // Revert on error
      setLocalCandidates(candidates)
      console.error('Failed to update candidate stage:', error)
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {/* Unassigned column */}
        {unassignedCandidates.length > 0 && (
          <StageColumn
            stage={{ id: 'unassigned', name: '미할당', order: -1 }}
            candidates={unassignedCandidates}
          />
        )}

        {/* Stage columns */}
        {sortedStages.map((stage: any) => (
          <StageColumn
            key={stage.id}
            stage={stage}
            candidates={candidatesByStage[stage.id] || []}
          />
        ))}
      </div>
    </DndContext>
  )
}
