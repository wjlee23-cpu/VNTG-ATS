'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createProcess, ProcessStage } from '@/actions/processes'

interface ProcessCreationFormProps {
  availableInterviewers: Array<{ id: string; email: string }>
}

export function ProcessCreationForm({ availableInterviewers }: ProcessCreationFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [stages, setStages] = useState<ProcessStage[]>([])

  function handleAddStage() {
    const newStage: ProcessStage = {
      id: crypto.randomUUID(),
      name: `단계 ${stages.length + 1}`,
      order: stages.length,
      interviewer_ids: [],
    }
    setStages([...stages, newStage])
  }

  function handleDeleteStage(stageId: string) {
    setStages(stages.filter((s) => s.id !== stageId).map((s, i) => ({ ...s, order: i })))
  }

  function handleUpdateStage(stageId: string, updates: Partial<ProcessStage>) {
    setStages(stages.map((s) => (s.id === stageId ? { ...s, ...updates } : s)))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    if (!name.trim()) {
      setError('프로세스 이름을 입력해주세요.')
      setIsSubmitting(false)
      return
    }

    if (stages.length === 0) {
      setError('최소 하나의 단계를 추가해주세요.')
      setIsSubmitting(false)
      return
    }

    try {
      const process = await createProcess({ name, stages })
      router.push(`/process/${process.id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '프로세스 생성에 실패했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">{error}</div>
      )}

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          프로세스 이름 *
        </label>
        <input
          type="text"
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-700">단계</label>
          <button
            type="button"
            onClick={handleAddStage}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            + 단계 추가
          </button>
        </div>

        <div className="space-y-2">
          {stages.map((stage) => (
            <div key={stage.id} className="rounded-lg border bg-white p-4">
              <div className="mb-2">
                <input
                  type="text"
                  value={stage.name}
                  onChange={(e) => handleUpdateStage(stage.id, { name: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  placeholder="단계 이름"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {availableInterviewers.map((interviewer) => (
                  <label
                    key={interviewer.id}
                    className="flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={stage.interviewer_ids?.includes(interviewer.id) || false}
                      onChange={(e) => {
                        const currentIds = stage.interviewer_ids || []
                        const newIds = e.target.checked
                          ? [...currentIds, interviewer.id]
                          : currentIds.filter((id) => id !== interviewer.id)
                        handleUpdateStage(stage.id, { interviewer_ids: newIds })
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>{interviewer.email}</span>
                  </label>
                ))}
              </div>
              <button
                type="button"
                onClick={() => handleDeleteStage(stage.id)}
                className="mt-2 text-xs text-red-600 hover:text-red-800"
              >
                삭제
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? '생성 중...' : '생성'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          취소
        </button>
      </div>
    </form>
  )
}
