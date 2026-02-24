import { getAIClient, generateText, AIProvider } from './client'
import { CalendarEvent } from '../calendar/google'
import { addDays, startOfDay, endOfDay, addMinutes, isWithinInterval, format } from 'date-fns'
import { isWeekday, isKoreanHoliday } from '../utils/korean-holidays'

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

  // Generate time slots (every 30 minutes during business hours 10-17)
  const slots: Array<{ date: Date; score: number }> = []
  let current = startOfDay(startDate)

  while (current <= endDate) {
    // 공휴일이 아닌 평일만 체크 (토요일/일요일 및 한국 공휴일 제외)
    const dayOfWeek = current.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6 // 일요일(0) 또는 토요일(6)
    
    if (isWeekend || isKoreanHoliday(current)) {
      current = addDays(current, 1)
      continue
    }

    const dayStart = startOfDay(current)

    // Business hours: 오전 10시(10)부터 오후 5시(17)까지
    for (let hour = 10; hour < 17; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const slot = new Date(dayStart)
        slot.setHours(hour, minute, 0, 0)

        if (slot >= startDate && slot <= endDate) {
          // 오후 시간대 선호 점수 계산 (12시 이후가 더 높은 점수)
          let score = 0
          if (hour >= 12) {
            // 오후 시간대: 12시~16시 (점수 10~14)
            score = hour
          } else {
            // 오전 시간대: 10시~11시 (점수 5~6)
            score = hour - 5
          }
          
          slots.push({ date: slot, score })
        }
      }
    }

    current = addDays(current, 1)
  }

  // Filter out busy times
  const availableSlots = slots.filter((slotData) => {
    const slot = slotData.date
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
  }).map(slotData => slotData.date)

  // 일정 겹침 방지를 위한 점수 계산 및 정렬
  // 오후 시간대를 선호하고, 선택된 일정과 겹치지 않도록 필터링
  const scoredSlots = availableSlots.map((slot) => {
    const hour = slot.getHours()
    let score = 0
    
    // 오후 시간대 선호 (12시 이후가 더 높은 점수)
    if (hour >= 12) {
      score = hour * 10 // 오후: 120점 이상
    } else {
      score = hour * 5 // 오전: 50점 이하
    }
    
    return { slot, score }
  })

  // 점수 순으로 정렬 (높은 점수 = 오후 시간대 우선)
  scoredSlots.sort((a, b) => b.score - a.score)

  // 겹치지 않는 일정 선택 (최소 30분 간격)
  const selectedSlots: Date[] = []
  const minIntervalMinutes = 30

  for (const { slot } of scoredSlots) {
    const slotEnd = addMinutes(slot, durationMinutes)
    
    // 이미 선택된 일정과 겹치는지 확인
    const isOverlapping = selectedSlots.some((selectedSlot) => {
      const selectedEnd = addMinutes(selectedSlot, durationMinutes)
      
      // 겹침 조건 체크:
      // 1. 새 일정의 시작 시간이 기존 일정의 시간 범위 내에 있는 경우
      // 2. 새 일정의 종료 시간이 기존 일정의 시간 범위 내에 있는 경우
      // 3. 새 일정이 기존 일정을 완전히 포함하는 경우
      // 4. 새 일정의 시작 시간이 기존 일정의 종료 시간과 너무 가까운 경우 (최소 간격)
      const overlaps = (
        (slot >= selectedSlot && slot < selectedEnd) ||
        (slotEnd > selectedSlot && slotEnd <= selectedEnd) ||
        (slot <= selectedSlot && slotEnd >= selectedEnd)
      )
      
      // 최소 간격 체크: 시작 시간이 기존 일정의 종료 시간으로부터 최소 간격 이내면 제외
      const timeDiff = Math.abs(slot.getTime() - selectedSlot.getTime())
      const endTimeDiff = Math.abs(slot.getTime() - selectedEnd.getTime())
      const tooClose = timeDiff < minIntervalMinutes * 60 * 1000 || endTimeDiff < minIntervalMinutes * 60 * 1000
      
      return overlaps || tooClose
    })
    
    if (!isOverlapping && selectedSlots.length < 5) {
      selectedSlots.push(slot)
    }
    
    if (selectedSlots.length >= 5) {
      break
    }
  }

  // Use AI to select best options (선택된 일정이 5개 미만인 경우에만 AI 사용)
  if (selectedSlots.length < 5) {
    const prompt = `다음 면접 일정 조율 요청을 분석하여 최적의 시간대 5개를 추천해주세요.

후보자: ${request.candidateName}
면접 단계: ${request.stageName}
면접관 수: ${request.interviewerIds.length}명
면접 시간: ${durationMinutes}분

가능한 시간대:
${availableSlots.slice(0, 50).map((slot, i) => `${i + 1}. ${format(slot, 'yyyy-MM-dd HH:mm')}`).join('\n')}

요구사항:
1. 면접관들의 일정이 모두 가능한 시간대 우선
2. 오후 시간대 우선 (12시 이후, 오전보다 오후 선호)
3. 시간대를 고르게 분산 (최소 30분 간격)
4. 한국 시간 기준
5. 공휴일 제외 (이미 필터링됨)

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
        const aiSelectedSlots = parsed
          .slice(0, 5 - selectedSlots.length)
          .map((item: any) => new Date(item.dateTime))
          .filter((slot: Date) => slot >= startDate && slot <= endDate)
        
        // AI가 선택한 일정도 겹침 체크 후 추가
        for (const aiSlot of aiSelectedSlots) {
          const slotEnd = addMinutes(aiSlot, durationMinutes)
          const isOverlapping = selectedSlots.some((selectedSlot) => {
            const selectedEnd = addMinutes(selectedSlot, durationMinutes)
            return (
              (aiSlot >= selectedSlot && aiSlot < selectedEnd) ||
              (slotEnd > selectedSlot && slotEnd <= selectedEnd) ||
              (aiSlot <= selectedSlot && slotEnd >= selectedEnd) ||
              (Math.abs(aiSlot.getTime() - selectedSlot.getTime()) < minIntervalMinutes * 60 * 1000)
            )
          })
          
          if (!isOverlapping && selectedSlots.length < 5) {
            selectedSlots.push(aiSlot)
          }
        }
      }
    } catch (error) {
      console.error('AI schedule recommendation failed, using fallback:', error)
    }
  }

  // 최종 결과 반환 (선택된 일정이 있으면 사용, 없으면 fallback)
  // 최종 필터링: 공휴일이 포함된 일정 제거
  const finalSlots = (selectedSlots.length > 0 
    ? selectedSlots 
    : availableSlots.slice(0, 5)
  ).filter((slot) => {
    // 공휴일 체크: 토요일/일요일 및 한국 공휴일 제외
    const dayOfWeek = slot.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    return !isWeekend && !isKoreanHoliday(slot)
  })

  return finalSlots.map((slot) => ({
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
