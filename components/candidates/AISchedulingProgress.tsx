'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Clock, ChevronDown, ChevronUp, CheckCircle, AlertCircle } from 'lucide-react'

interface Interviewer {
  id: string
  name: string
  email: string
  status: 'accepted' | 'pending' | 'rejected'
}

interface AISchedulingProgressProps {
  schedule?: {
    id: string
    status: string
    interviewers?: Interviewer[]
    progress?: {
      step: number
      total: number
      accepted: number
    }
  }
}

const schedulingSteps = [
  { id: 1, label: 'Internal Sync', description: '내부 조율 중' },
  { id: 2, label: 'Sent to Candidate', description: '후보자에게 발송됨' },
  { id: 3, label: 'Reschedule Requested', description: '재조율 요청' },
  { id: 4, label: 'Confirmed', description: '확정됨' },
]

export function AISchedulingProgress({ schedule }: AISchedulingProgressProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Mock data if no schedule provided
  const displaySchedule = schedule || {
    id: '1',
    status: 'internal_sync',
    interviewers: [
      { id: '1', name: 'John Doe', email: 'john@example.com', status: 'accepted' as const },
      { id: '2', name: 'Jane Smith', email: 'jane@example.com', status: 'accepted' as const },
      { id: '3', name: 'Bob Johnson', email: 'bob@example.com', status: 'pending' as const },
    ],
    progress: {
      step: 1,
      total: 3,
      accepted: 2,
    },
  }

  const currentStep = schedulingSteps.find((s) => s.id === displaySchedule.progress?.step) || schedulingSteps[0]
  const progressPercentage = displaySchedule.progress
    ? (displaySchedule.progress.accepted / displaySchedule.progress.total) * 100
    : 0

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      {/* Header - Always Visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Clock className="h-5 w-5 text-[#0248FF]" />
          <div>
            <h3 className="font-semibold text-gray-900" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
              AI Scheduling Progress
            </h3>
            <p className="text-sm text-gray-500" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
              {currentStep.description}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="primary">
            Step {currentStep.id}: {currentStep.label} - {displaySchedule.progress?.accepted || 0}/
            {displaySchedule.progress?.total || 0} Accepted
          </Badge>
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* Body - Conditional Rendering */}
      {isExpanded && (
        <div className="border-t border-gray-200 p-4 space-y-4">
          {/* Progress Bar */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                진행률
              </span>
              <span className="text-sm text-gray-500" style={{ fontFamily: 'Roboto, sans-serif' }}>
                {Math.round(progressPercentage)}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full bg-[#0248FF] transition-all"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>

          {/* Interviewer List */}
          <div>
            <h4 className="mb-2 text-sm font-medium text-gray-700" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
              면접관 목록
            </h4>
            <div className="space-y-2">
              {displaySchedule.interviewers?.map((interviewer) => (
                <div
                  key={interviewer.id}
                  className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 p-3"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900" style={{ fontFamily: 'Roboto, sans-serif' }}>
                      {interviewer.name}
                    </p>
                    <p className="text-xs text-gray-500" style={{ fontFamily: 'Roboto, sans-serif' }}>
                      {interviewer.email}
                    </p>
                  </div>
                  {interviewer.status === 'accepted' ? (
                    <div className="flex items-center gap-1 text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-xs font-medium" style={{ fontFamily: 'Roboto, sans-serif' }}>
                        Accepted
                      </span>
                    </div>
                  ) : interviewer.status === 'pending' ? (
                    <Badge variant="warning">Pending</Badge>
                  ) : (
                    <Badge variant="danger">Rejected</Badge>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <Button
              variant="primary"
              className="w-full"
              disabled={progressPercentage < 100}
            >
              Send Options to Candidate
            </Button>
            {progressPercentage < 100 && (
              <div className="flex items-start gap-2 rounded-md bg-yellow-50 border border-yellow-200 p-3">
                <AlertCircle className="h-5 w-5 flex-shrink-0 text-yellow-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-800" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                    모든 면접관의 승인이 필요합니다
                  </p>
                  <p className="text-xs text-yellow-700 mt-1" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                    후보자에게 일정 옵션을 보내기 전에 모든 면접관이 승인해야 합니다.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
