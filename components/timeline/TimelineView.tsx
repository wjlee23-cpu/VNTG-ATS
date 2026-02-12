'use client'

import { formatDate } from '@/lib/utils'
import { format } from 'date-fns'

interface TimelineEvent {
  id: string
  type: string
  content: any
  created_by: string | null
  created_at: string
  users?: {
    email: string
  } | null
}

interface TimelineViewProps {
  events: TimelineEvent[]
}

const eventIcons: Record<string, string> = {
  system_log: '📋',
  schedule_created: '📅',
  schedule_confirmed: '✅',
  stage_changed: '🔄',
}

const eventLabels: Record<string, string> = {
  system_log: '시스템 로그',
  schedule_created: '일정 생성',
  schedule_confirmed: '일정 확정',
  stage_changed: '단계 변경',
}

export function TimelineView({ events }: TimelineViewProps) {
  if (events.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
        <p className="text-gray-500" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
          타임라인 이벤트가 없습니다.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {events.map((event, index) => (
        <div key={event.id} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0248FF]/10 text-lg">
              {eventIcons[event.type] || '📌'}
            </div>
            {index < events.length - 1 && (
              <div className="mt-2 h-full w-0.5 bg-gray-200" />
            )}
          </div>
          <div className="flex-1 rounded-lg border border-gray-200 bg-white p-4 hover:border-[#5287FF] transition-colors">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-medium text-gray-900" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                  {eventLabels[event.type] || event.type}
                </h4>
                {event.content?.message && (
                  <p className="mt-1 text-sm text-gray-600" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                    {event.content.message}
                  </p>
                )}
                {event.content?.stage_id && (
                  <p className="mt-1 text-sm text-gray-600" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                    단계 ID: {event.content.stage_id}
                  </p>
                )}
                {event.content?.scheduled_at && (
                  <p className="mt-1 text-sm text-gray-600" style={{ fontFamily: 'Roboto, sans-serif' }}>
                    일정: {format(new Date(event.content.scheduled_at), 'yyyy-MM-dd HH:mm')}
                  </p>
                )}
              </div>
              <div className="text-right text-xs text-gray-500" style={{ fontFamily: 'Roboto, sans-serif' }}>
                <div>{formatDate(event.created_at)}</div>
                {event.users && (
                  <div className="mt-1">{event.users.email}</div>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
