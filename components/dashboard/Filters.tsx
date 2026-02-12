'use client'

import { Badge } from '@/components/ui/badge'

interface FiltersProps {
  selectedStage?: string
  selectedPosition?: string
  selectedSource?: string
  selectedSchedulingStatus?: string
  onStageChange?: (stage: string) => void
  onPositionChange?: (position: string) => void
  onSourceChange?: (source: string) => void
  onSchedulingStatusChange?: (status: string) => void
  stages?: Array<{ id: string; name: string }>
  positions?: Array<{ id: string; title: string }>
  sources?: string[]
}

const schedulingStatuses = [
  { id: 'internal_sync', label: 'Internal Sync', step: 1 },
  { id: 'sent_to_candidate', label: 'Sent to Candidate', step: 2 },
  { id: 'reschedule_requested', label: 'Reschedule Requested', step: 3 },
  { id: 'confirmed', label: 'Confirmed', step: 4 },
]

export function Filters({
  selectedStage,
  selectedPosition,
  selectedSource,
  selectedSchedulingStatus,
  onStageChange,
  onPositionChange,
  onSourceChange,
  onSchedulingStatusChange,
  stages = [],
  positions = [],
  sources = [],
}: FiltersProps) {
  return (
    <div className="space-y-6" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
      {/* Stage Filter */}
      {stages.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-700">Stage</h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onStageChange?.('')}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                !selectedStage
                  ? 'bg-[#0248FF] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              전체
            </button>
            {stages.map((stage) => (
              <button
                key={stage.id}
                onClick={() => onStageChange?.(stage.id)}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  selectedStage === stage.id
                    ? 'bg-[#0248FF] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {stage.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Position Filter */}
      {positions.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-700">Position</h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onPositionChange?.('')}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                !selectedPosition
                  ? 'bg-[#0248FF] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              전체
            </button>
            {positions.map((position) => (
              <button
                key={position.id}
                onClick={() => onPositionChange?.(position.id)}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  selectedPosition === position.id
                    ? 'bg-[#0248FF] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {position.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Source Filter */}
      {sources.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-700">Source</h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onSourceChange?.('')}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                !selectedSource
                  ? 'bg-[#0248FF] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              전체
            </button>
            {sources.map((source) => (
              <button
                key={source}
                onClick={() => onSourceChange?.(source)}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  selectedSource === source
                    ? 'bg-[#0248FF] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {source}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* AI Scheduling Status Filter */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-gray-700">AI Scheduling Status</h3>
        <div className="space-y-2">
          {schedulingStatuses.map((status) => (
            <button
              key={status.id}
              onClick={() => onSchedulingStatusChange?.(status.id)}
              className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                selectedSchedulingStatus === status.id
                  ? 'bg-[#0248FF] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span>{status.label}</span>
                <Badge variant="secondary" className="text-xs">
                  Step {status.step}
                </Badge>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
