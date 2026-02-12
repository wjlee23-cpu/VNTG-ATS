'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createScheduleRequest } from '@/actions/schedules'
import { format } from 'date-fns'

interface ScheduleRequestFormProps {
  candidateId: string
  stageId: string
  defaultStartDate: Date
  defaultEndDate: Date
}

export function ScheduleRequestForm({
  candidateId,
  stageId,
  defaultStartDate,
  defaultEndDate,
}: ScheduleRequestFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const startDate = new Date(formData.get('startDate') as string)
    const endDate = new Date(formData.get('endDate') as string)
    const durationMinutes = parseInt(formData.get('durationMinutes') as string) || 60

    try {
      const result = await createScheduleRequest({
        candidateId,
        stageId,
        startDate,
        endDate,
        durationMinutes,
      })

      alert(`일정 조율이 완료되었습니다. ${result.options.length}개의 옵션이 생성되었습니다.`)
      router.push(`/candidates/${candidateId}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '일정 조율에 실패했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">{error}</div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">
            시작 날짜 *
          </label>
          <input
            type="date"
            id="startDate"
            name="startDate"
            required
            defaultValue={format(defaultStartDate, 'yyyy-MM-dd')}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">
            종료 날짜 *
          </label>
          <input
            type="date"
            id="endDate"
            name="endDate"
            required
            defaultValue={format(defaultEndDate, 'yyyy-MM-dd')}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label htmlFor="durationMinutes" className="block text-sm font-medium text-gray-700">
          면접 시간 (분) *
        </label>
        <input
          type="number"
          id="durationMinutes"
          name="durationMinutes"
          required
          min={30}
          max={180}
          step={30}
          defaultValue={60}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
        />
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? '일정 조율 중...' : '일정 조율 실행'}
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
