'use client'

import { useState, useEffect } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ProcessStage } from '@/actions/processes'
import { StageEditor } from './StageEditor'

interface ProcessBuilderProps {
  initialStages: ProcessStage[]
  onSave: (stages: ProcessStage[]) => Promise<void>
  availableInterviewers: Array<{ id: string; email: string }>
}

export function ProcessBuilder({
  initialStages,
  onSave,
  availableInterviewers,
}: ProcessBuilderProps) {
  const [stages, setStages] = useState<ProcessStage[]>(initialStages)
  const [isSaving, setIsSaving] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(() => {
    setStages(initialStages)
  }, [initialStages])

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setStages((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id)
        const newIndex = items.findIndex((item) => item.id === over.id)

        const newStages = arrayMove(items, oldIndex, newIndex).map((stage, index) => ({
          ...stage,
          order: index,
        }))

        return newStages
      })
    }
  }

  function handleAddStage() {
    const newStage: ProcessStage = {
      id: crypto.randomUUID(),
      name: `새 단계 ${stages.length + 1}`,
      order: stages.length,
      interviewer_ids: [],
    }
    setStages([...stages, newStage])
  }

  function handleDeleteStage(stageId: string) {
    setStages(stages.filter((stage) => stage.id !== stageId).map((stage, index) => ({
      ...stage,
      order: index,
    })))
  }

  function handleUpdateStage(stageId: string, updates: Partial<ProcessStage>) {
    setStages(
      stages.map((stage) => (stage.id === stageId ? { ...stage, ...updates } : stage))
    )
  }

  async function handleSave() {
    setIsSaving(true)
    try {
      await onSave(stages)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">채용 프로세스 단계</h3>
        <div className="flex gap-2">
          <button
            onClick={handleAddStage}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            단계 추가
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {isSaving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={stages.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {stages.map((stage) => (
              <SortableStageItem
                key={stage.id}
                stage={stage}
                onUpdate={(updates) => handleUpdateStage(stage.id, updates)}
                onDelete={() => handleDeleteStage(stage.id)}
                availableInterviewers={availableInterviewers}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {stages.length === 0 && (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
          <p className="text-gray-500">단계를 추가하여 채용 프로세스를 구성하세요.</p>
        </div>
      )}
    </div>
  )
}

function SortableStageItem({
  stage,
  onUpdate,
  onDelete,
  availableInterviewers,
}: {
  stage: ProcessStage
  onUpdate: (updates: Partial<ProcessStage>) => void
  onDelete: () => void
  availableInterviewers: Array<{ id: string; email: string }>
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stage.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-2">
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab text-gray-400 hover:text-gray-600"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 8h16M4 16h16"
                />
              </svg>
            </button>
            <StageEditor
              stage={stage}
              onUpdate={onUpdate}
              availableInterviewers={availableInterviewers}
            />
          </div>
        </div>
        <button
          onClick={onDelete}
          className="ml-2 text-red-600 hover:text-red-800"
          type="button"
        >
          삭제
        </button>
      </div>
    </div>
  )
}
