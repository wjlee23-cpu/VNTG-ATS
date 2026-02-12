'use client'

import { useState } from 'react'
import { confirmScheduleOption } from '@/actions/schedules'
import { format } from 'date-fns'

interface ScheduleSelectionFormProps {
  scheduleId: string
  options: Array<{ id: string; scheduledAt: Date }>
  candidateToken: string
}

const beverages = [
  '아메리카노',
  '라떼',
  '녹차',
  '홍차',
  '물',
  '선택 안 함',
]

export function ScheduleSelectionForm({
  scheduleId,
  options,
  candidateToken,
}: ScheduleSelectionFormProps) {
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null)
  const [beverage, setBeverage] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!selectedOptionId) {
      setError('일정을 선택해주세요.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await confirmScheduleOption(
        scheduleId,
        selectedOptionId,
        beverage && beverage !== '선택 안 함' ? beverage : undefined
      )

      setIsSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : '일정 선택에 실패했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSuccess) {
    return (
      <div className="mt-6 rounded-lg bg-green-50 p-4">
        <h2 className="text-lg font-semibold text-green-900">일정이 확정되었습니다!</h2>
        <p className="mt-2 text-green-700">
          선택하신 일정으로 면접이 예약되었습니다. 담당자가 곧 연락드리겠습니다.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">{error}</div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700">
          면접 일정 선택 *
        </label>
        <div className="mt-2 space-y-2">
          {options.map((option) => (
            <label
              key={option.id}
              className={`flex cursor-pointer items-center rounded-lg border-2 p-4 transition-colors ${
                selectedOptionId === option.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="scheduleOption"
                value={option.id}
                checked={selectedOptionId === option.id}
                onChange={(e) => setSelectedOptionId(e.target.value)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500"
              />
              <div className="ml-3">
                <div className="font-medium text-gray-900">
                  {format(option.scheduledAt, 'yyyy년 MM월 dd일 (EEE)')}
                </div>
                <div className="text-sm text-gray-600">
                  {format(option.scheduledAt, 'HH:mm')} 시작
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="beverage" className="block text-sm font-medium text-gray-700">
          음료 선호도 (선택사항)
        </label>
        <select
          id="beverage"
          value={beverage}
          onChange={(e) => setBeverage(e.target.value)}
          className="mt-2 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
        >
          <option value="">선택해주세요</option>
          {beverages.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={isSubmitting || !selectedOptionId}
        className="w-full rounded-md bg-blue-600 px-4 py-3 text-base font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? '확정 중...' : '일정 확정'}
      </button>
    </form>
  )
}
