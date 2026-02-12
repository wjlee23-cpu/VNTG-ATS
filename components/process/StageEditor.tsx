'use client'

import { useState } from 'react'
import { ProcessStage } from '@/actions/processes'

interface StageEditorProps {
  stage: ProcessStage
  onUpdate: (updates: Partial<ProcessStage>) => void
  availableInterviewers: Array<{ id: string; email: string }>
}

export function StageEditor({ stage, onUpdate, availableInterviewers }: StageEditorProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(stage.name)

  function handleNameChange(newName: string) {
    setName(newName)
    onUpdate({ name: newName })
  }

  function handleInterviewerToggle(interviewerId: string) {
    const currentIds = stage.interviewer_ids || []
    const newIds = currentIds.includes(interviewerId)
      ? currentIds.filter((id) => id !== interviewerId)
      : [...currentIds, interviewerId]

    onUpdate({ interviewer_ids: newIds })
  }

  return (
    <div className="flex-1">
      <div className="mb-2">
        {isEditing ? (
          <input
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            onBlur={() => setIsEditing(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setIsEditing(false)
              }
            }}
            className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            autoFocus
          />
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            className="text-left font-medium text-gray-900 hover:text-blue-600"
          >
            {stage.name}
          </button>
        )}
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-700">면접관 선택:</label>
        <div className="flex flex-wrap gap-2">
          {availableInterviewers.map((interviewer) => (
            <label
              key={interviewer.id}
              className="flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-xs"
            >
              <input
                type="checkbox"
                checked={stage.interviewer_ids?.includes(interviewer.id) || false}
                onChange={() => handleInterviewerToggle(interviewer.id)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-gray-700">{interviewer.email}</span>
            </label>
          ))}
        </div>
        {availableInterviewers.length === 0 && (
          <p className="text-xs text-gray-500">사용 가능한 면접관이 없습니다.</p>
        )}
      </div>
    </div>
  )
}
