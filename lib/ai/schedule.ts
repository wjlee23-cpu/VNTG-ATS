import { CalendarEvent } from '../calendar/google'
import { addDays, startOfDay, addMinutes } from 'date-fns'
import { isKoreanHoliday } from '../utils/korean-holidays'

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
  allowPartialConflict?: boolean // 부분적 충돌 허용 옵션 (면접관 중 일부만 가능해도 제안)
  minAvailableInterviewers?: number // 최소 필요한 면접관 수 (기본값: 모든 면접관)
}

export async function findAvailableTimeSlots(
  request: ScheduleRequest
): Promise<ScheduleOption[]> {
  const { 
    busyTimes, 
    interviewerIds, 
    startDate, 
    endDate, 
    durationMinutes = 60,
    allowPartialConflict = false,
    minAvailableInterviewers = interviewerIds.length
  } = request

  // Generate time slots (every 30 minutes during business hours 10-17)
  const slots: Array<{ date: Date; score: number; availableCount: number }> = []
  let current = startOfDay(startDate)

  while (current <= endDate) {
    // 공휴일이 아닌 평일만 체크 (토요일/일요일 및 한국 공휴일 제외)
    const dayOfWeek = current.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6 // 일요일(0) 또는 토요일(6)
    
    // 공휴일 체크 강화
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
          // 해당 시간대에 바쁜 면접관 수 계산
          const slotEnd = addMinutes(slot, durationMinutes)
          let busyCount = 0
          
          for (const busy of busyTimes) {
            const busyStart = new Date(busy.start.dateTime)
            const busyEnd = new Date(busy.end.dateTime)
            
            const isBusy = (
              (slot >= busyStart && slot < busyEnd) ||
              (slotEnd > busyStart && slotEnd <= busyEnd) ||
              (slot <= busyStart && slotEnd >= busyEnd)
            )
            
            if (isBusy) {
              busyCount++
            }
          }
          
          const availableCount = interviewerIds.length - busyCount
          
          // 최소 필요한 면접관 수 이상인 경우만 추가
          if (availableCount >= minAvailableInterviewers) {
            // 오후 시간대 선호 점수 계산 (12시 이후가 더 높은 점수)
            let score = 0
            if (hour >= 12) {
              // 오후 시간대: 12시~16시 (점수 10~14)
              score = hour
            } else {
              // 오전 시간대: 10시~11시 (점수 5~6)
              score = hour - 5
            }
            
            // 가능한 면접관 수에 따른 보너스 점수 (모든 면접관이 가능하면 더 높은 점수)
            if (availableCount === interviewerIds.length) {
              score += 20 // 모든 면접관 가능 보너스
            } else if (allowPartialConflict) {
              score += availableCount * 2 // 부분적 충돌 허용 시 가능한 면접관 수에 비례한 점수
            }
            
            slots.push({ date: slot, score, availableCount })
          }
        }
      }
    }

    current = addDays(current, 1)
  }

  // 일정 겹침 방지를 위한 점수 계산 및 정렬
  // 오후 시간대를 선호하고, 선택된 일정과 겹치지 않도록 필터링
  const scoredSlots = slots.map((slotData) => {
    const slot = slotData.date
    const hour = slot.getHours()
    let score = slotData.score // 이미 계산된 점수 사용
    
    // 추가 점수: 요일별 선호도 (화요일~목요일 선호)
    const dayOfWeek = slot.getDay()
    if (dayOfWeek >= 2 && dayOfWeek <= 4) {
      score += 10 // 화요일~목요일 보너스
    }
    
    return { slot, score, availableCount: slotData.availableCount }
  })

  // 점수 순으로 정렬 (높은 점수 = 오후 시간대 우선)
  scoredSlots.sort((a, b) => b.score - a.score)

  // 겹치지 않는 일정 선택 (최소 30분 간격, 최대 5개)
  const selectedSlots: Date[] = []
  const minIntervalMinutes = 30

  for (const { slot } of scoredSlots) {
    // 최대 5개까지만 선택
    if (selectedSlots.length >= 5) {
      break
    }

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
    
    if (!isOverlapping) {
      selectedSlots.push(slot)
    }
  }

  // 최종 필터링: 공휴일이 포함된 일정 제거
  const finalSlots = selectedSlots.filter((slot) => {
    // 공휴일 체크: 토요일/일요일 및 한국 공휴일 제외
    const dayOfWeek = slot.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    return !isWeekend && !isKoreanHoliday(slot)
  })

  // 최종 결과 반환 시 가능한 면접관 정보 포함
  return finalSlots.map((slot) => {
    // 해당 슬롯의 availableCount 찾기
    const slotData = slots.find(s => s.date.getTime() === slot.getTime())
    const availableCount = slotData?.availableCount || interviewerIds.length
    
    return {
      scheduledAt: slot,
      duration: durationMinutes,
      availableInterviewers: interviewerIds.slice(0, availableCount), // 가능한 면접관만 포함
    }
  })
}

