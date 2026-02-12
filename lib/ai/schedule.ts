import { getAIClient, generateText, AIProvider } from './client'
import { CalendarEvent } from '../calendar/google'
import { addDays, startOfDay, endOfDay, addMinutes, isWithinInterval, format } from 'date-fns'

export interface ScheduleOption {
  scheduledAt: Date
  duration: number
  availableInterviewers: string[]
}

export interface ScheduleRequest {
  candidateName: string
  stageName: string
  interviewerIds: string[]
  busyTimes: CalendarEvent[]
  startDate: Date
  endDate: Date
  durationMinutes?: number
}

export async function findAvailableTimeSlots(
  request: ScheduleRequest,
  provider: AIProvider = 'openai'
): Promise<ScheduleOption[]> {
  const { busyTimes, interviewerIds, startDate, endDate, durationMinutes = 60 } = request

  // Generate time slots (every 30 minutes during business hours 9-18)
  const slots: Date[] = []
  let current = startOfDay(startDate)

  while (current <= endDate) {
    const dayStart = startOfDay(current)
    const dayEnd = endOfDay(current)

    // Business hours: 9 AM to 6 PM
    for (let hour = 9; hour < 18; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const slot = new Date(dayStart)
        slot.setHours(hour, minute, 0, 0)

        if (slot >= startDate && slot <= endDate) {
          slots.push(slot)
        }
      }
    }

    current = addDays(current, 1)
  }

  // Filter out busy times
  const availableSlots = slots.filter((slot) => {
    const slotEnd = addMinutes(slot, durationMinutes)

    return !busyTimes.some((busy) => {
      const busyStart = new Date(busy.start.dateTime)
      const busyEnd = new Date(busy.end.dateTime)

      return (
        (slot >= busyStart && slot < busyEnd) ||
        (slotEnd > busyStart && slotEnd <= busyEnd) ||
        (slot <= busyStart && slotEnd >= busyEnd)
      )
    })
  })

  // Use AI to select best options
  const prompt = `다음 면접 일정 조율 요청을 분석하여 최적의 시간대 5개를 추천해주세요.

후보자: ${request.candidateName}
면접 단계: ${request.stageName}
면접관 수: ${request.interviewerIds.length}명
면접 시간: ${durationMinutes}분

가능한 시간대:
${availableSlots.slice(0, 50).map((slot, i) => `${i + 1}. ${format(slot, 'yyyy-MM-dd HH:mm')}`).join('\n')}

요구사항:
1. 면접관들의 일정이 모두 가능한 시간대 우선
2. 평일 오전 시간대 우선 (9-12시)
3. 시간대를 고르게 분산
4. 한국 시간 기준

응답 형식: JSON 배열로 시간대 5개를 반환하세요. 각 항목은 {"dateTime": "YYYY-MM-DDTHH:mm:ss", "reason": "선택 이유"} 형식입니다.`

  try {
    const aiResponse = await generateText(provider, prompt, {
      maxTokens: 1000,
      temperature: 0.7,
    })

    // Parse AI response
    const jsonMatch = aiResponse.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return parsed
        .slice(0, 5)
        .map((item: any) => ({
          scheduledAt: new Date(item.dateTime),
          duration: durationMinutes,
          availableInterviewers: interviewerIds,
        }))
        .filter((opt: ScheduleOption) => opt.scheduledAt >= startDate && opt.scheduledAt <= endDate)
    }
  } catch (error) {
    console.error('AI schedule recommendation failed, using fallback:', error)
  }

  // Fallback: return first 5 available slots
  return availableSlots.slice(0, 5).map((slot) => ({
    scheduledAt: slot,
    duration: durationMinutes,
    availableInterviewers: interviewerIds,
  }))
}

export async function generateScheduleMessage(
  candidateName: string,
  options: ScheduleOption[],
  provider: AIProvider = 'openai'
): Promise<string> {
  const prompt = `다음 면접 일정 옵션을 후보자에게 보낼 친절하고 전문적인 이메일 메시지를 작성해주세요.

후보자 이름: ${options[0].scheduledAt}
면접 일정 옵션:
${options.map((opt, i) => `${i + 1}. ${format(opt.scheduledAt, 'yyyy년 MM월 dd일 HH:mm')} (${opt.duration}분)`).join('\n')}

요구사항:
- 한국어로 작성
- 친절하고 전문적인 톤
- 일정 선택을 요청
- 간결하고 명확하게
- 이메일 본문 형식 (인사말, 본문, 마무리 포함)`

  const message = await generateText(provider, prompt, {
    maxTokens: 500,
    temperature: 0.8,
  })

  return message
}
