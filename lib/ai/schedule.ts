import { CalendarEvent } from '../calendar/google'
import { addDays, startOfDay, addMinutes, isAfter, isBefore, isEqual } from 'date-fns'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'
import { isKoreanHoliday } from '../utils/korean-holidays'
import { 
  SCORING_WEIGHTS, 
  BUSINESS_HOURS, 
  SLOT_INTERVAL_MINUTES, 
  MIN_SLOT_INTERVAL_MINUTES, 
  MAX_SCHEDULE_OPTIONS,
} from './schedule-constants'

// KST 타임존 상수
const KST_TIMEZONE = 'Asia/Seoul'

export interface ScheduleOption {
  scheduledAt: Date
  duration: number
  availableInterviewers: string[]
  missingInterviewers?: string[] // 누락된 면접관 목록 (부분적 충돌 시)
  isPartialConflict?: boolean // 부분적 충돌 여부
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
  /**
   * 허용할 시간대 목록 (가능시간)
   * - 지정된 경우, 이 구간 내의 슬롯만 생성
   * - 미지정 시 BUSINESS_HOURS(10:00~17:00)를 기본 허용으로 사용
   */
  allowedTimeRanges?: Array<{
    startHour: number
    startMinute: number
    endHour: number
    endMinute: number
  }>
  /**
   * 제외할 시간대 목록
   * - 예: 점심시간(11:30~12:30) 등
   * - startHour/startMinute ~ endHour/endMinute 구간과 겹치는 슬롯은 생성하지 않음
   * - 지정되지 않은 경우 빈 배열 (제외 시간 없음)
   */
  excludedTimeRanges?: Array<{
    startHour: number
    startMinute: number
    endHour: number
    endMinute: number
  }>
  /**
   * 면접관 선호 시간대
   * - morning: 10:00~12:00(점심 11:30~12:30 제외)
   * - afternoon: 13:00~17:00
   * - none: 선호 없음
   */
  interviewerPreferences?: Record<string, 'morning' | 'afternoon' | 'none'>
}

/**
 * 면접관별 busy time을 시간순으로 정렬하고 겹치는 시간대를 병합
 */
function mergeBusyTimes(busyTimes: CalendarEvent[]): Array<{ start: Date; end: Date }> {
  if (busyTimes.length === 0) return []
  
  // 시간순으로 정렬
  const sorted = [...busyTimes].sort((a, b) => {
    const aStart = new Date(a.start.dateTime).getTime()
    const bStart = new Date(b.start.dateTime).getTime()
    return aStart - bStart
  })
  
  // 겹치는 시간대 병합
  const merged: Array<{ start: Date; end: Date }> = []
  
  for (const busy of sorted) {
    const start = new Date(busy.start.dateTime)
    const end = new Date(busy.end.dateTime)
    
    if (merged.length === 0) {
      merged.push({ start, end })
      continue
    }
    
    const last = merged[merged.length - 1]
    
    // 겹치거나 인접한 경우 병합
    if (isBefore(start, last.end) || isEqual(start, last.end)) {
      if (isAfter(end, last.end)) {
        last.end = end
      }
    } else {
      merged.push({ start, end })
    }
  }
  
  return merged
}

/**
 * KST(Asia/Seoul) 기준으로 자정(00:00) 시각의 UTC Date를 반환
 */
function getKstStartOfDayUtc(date: Date): Date {
  const kst = toZonedTime(date, KST_TIMEZONE)
  const kstStart = startOfDay(kst)
  return fromZonedTime(kstStart, KST_TIMEZONE)
}

/**
 * 슬롯이 특정 허용(allowed) 구간 안에 있는지 확인 (KST 기준)
 */
function isInAllowedRangesKst(
  hour: number,
  minute: number,
  allowed: Array<{ startHour: number; startMinute: number; endHour: number; endMinute: number }> | undefined
): boolean {
  // allowed가 없거나 빈 배열이면 BUSINESS_HOURS를 기본 허용 구간으로 사용
  const ranges = (allowed && allowed.length > 0)
    ? allowed
    : [{ startHour: BUSINESS_HOURS.start, startMinute: 0, endHour: BUSINESS_HOURS.end, endMinute: 0 }]

  const total = hour * 60 + minute
  return ranges.some(r => {
    const s = r.startHour * 60 + r.startMinute
    const e = r.endHour * 60 + r.endMinute
    return total >= s && total < e
  })
}

/**
 * 모든 면접관의 busy time을 하나의 타임라인으로 병합하고,
 * 각 시간대에 대해 가능한 면접관을 추적
 * 
 * 현재 구조에서는 busyTimes가 모든 면접관의 busy time을 포함하므로,
 * 각 시간 슬롯에 대해 어떤 면접관이 가능한지 계산
 */
function findAvailableSlotsOptimized(
  busyTimes: CalendarEvent[],
  interviewerIds: string[],
  startDate: Date,
  endDate: Date,
  durationMinutes: number,
  allowPartialConflict: boolean,
  minAvailableInterviewers: number,
  allowedTimeRanges: Array<{
    startHour: number
    startMinute: number
    endHour: number
    endMinute: number
  }> | undefined,
  excludedTimeRanges: Array<{
    startHour: number
    startMinute: number
    endHour: number
    endMinute: number
  }>
): Array<{
  slot: Date
  slotEnd: Date
  availableInterviewers: string[]
  missingInterviewers: string[]
  isPartialConflict: boolean
}> {
  // Busy time을 시간순으로 정렬 및 병합
  const mergedBusyTimes = mergeBusyTimes(busyTimes)
  
  // 모든 가능한 슬롯 생성 (30분 간격, 비즈니스 시간 내)
  const slots: Array<{
    slot: Date
    slotEnd: Date
    availableInterviewers: string[]
    missingInterviewers: string[]
    isPartialConflict: boolean
  }> = []
  
  let current = getKstStartOfDayUtc(startDate)
  
  while (current <= endDate) {
    const currentKst = toZonedTime(current, KST_TIMEZONE)
    const dayOfWeek = currentKst.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    
    if (isWeekend || isKoreanHoliday(currentKst)) {
      current = addDays(current, 1)
      continue
    }
    
    const dayStartUtc = getKstStartOfDayUtc(current)
    
    // 비즈니스 시간 내에서 30분 간격으로 슬롯 생성
    for (let hour = BUSINESS_HOURS.start; hour < BUSINESS_HOURS.end; hour++) {
      for (let minute = 0; minute < 60; minute += SLOT_INTERVAL_MINUTES) {
        // KST 기준 슬롯 생성 후 UTC로 변환
        const slotKst = toZonedTime(dayStartUtc, KST_TIMEZONE)
        slotKst.setHours(hour, minute, 0, 0)
        const slot = fromZonedTime(slotKst, KST_TIMEZONE)

        if (slot < startDate || slot > endDate) continue

        // 허용/제외 시간대는 KST 기준
        const slotLocalHour = slotKst.getHours()
        const slotLocalMinute = slotKst.getMinutes()

        // 허용 시간대 밖이면 스킵
        if (!isInAllowedRangesKst(slotLocalHour, slotLocalMinute, allowedTimeRanges)) {
          continue
        }

        // 슬롯 종료 시각(로컬 KST) 계산
        const slotStartMinutes = slotLocalHour * 60 + slotLocalMinute
        const slotEndLocalMinutes = slotStartMinutes + durationMinutes

        // 제외 구간과의 부분 겹침 포함 여부 판단
        const isExcluded = excludedTimeRanges.some(range => {
          const rangeStartMinutes = range.startHour * 60 + range.startMinute
          const rangeEndMinutes = range.endHour * 60 + range.endMinute
          // [slotStart, slotEnd) 와 [rangeStart, rangeEnd) 교집합이 있으면 제외
          return slotStartMinutes < rangeEndMinutes && slotEndLocalMinutes > rangeStartMinutes
        })

        if (isExcluded) {
          continue
        }

        const slotEnd = addMinutes(slot, durationMinutes)
        
        // 이 슬롯에 대해 가능한 면접관 찾기
        // 현재 구조에서는 모든 busy time을 모든 면접관에 적용
        // 실제로는 면접관별로 분리되어야 하지만, 일단 모든 면접관이 가능하다고 가정
        // busy time과 겹치지 않으면 모든 면접관이 가능
        let isSlotBusy = false
        
        for (const busy of mergedBusyTimes) {
          // 슬롯이 busy time과 겹치는지 확인
          if (
            (isAfter(slot, busy.start) && isBefore(slot, busy.end)) ||
            (isAfter(slotEnd, busy.start) && isBefore(slotEnd, busy.end)) ||
            (isBefore(slot, busy.start) && isAfter(slotEnd, busy.end)) ||
            isEqual(slot, busy.start) ||
            isEqual(slotEnd, busy.end)
          ) {
            isSlotBusy = true
            break
          }
        }
        
        // 슬롯이 busy time과 겹치지 않으면 모든 면접관이 가능
        const availableInterviewers = isSlotBusy ? [] : [...interviewerIds]
        const missingInterviewers = isSlotBusy ? [...interviewerIds] : []
        const isPartialConflict = false // 현재 구조에서는 부분적 충돌 감지 불가
        
        // 최소 면접관 수 이상인 경우만 추가
        if (availableInterviewers.length >= minAvailableInterviewers) {
          slots.push({
            slot,
            slotEnd,
            availableInterviewers,
            missingInterviewers,
            isPartialConflict,
          })
        }
      }
    }
    
    current = addDays(current, 1)
  }
  
  return slots
}


/**
 * 슬롯의 점수 계산
 */
function calculateSlotScore(
  slot: Date,
  availableCount: number,
  totalInterviewers: number,
  allowPartialConflict: boolean
): number {
  const hour = slot.getHours()
  let score = 0
  
  // 시간대별 기본 점수
  if (hour >= SCORING_WEIGHTS.timeOfDay.afternoon.range[0]) {
    // 오후 시간대
    score = SCORING_WEIGHTS.timeOfDay.afternoon.base + (hour - SCORING_WEIGHTS.timeOfDay.afternoon.range[0])
  } else {
    // 오전 시간대
    score = SCORING_WEIGHTS.timeOfDay.morning.base + (hour - SCORING_WEIGHTS.timeOfDay.morning.range[0])
  }
  
  // 모든 면접관 가능 보너스
  if (availableCount === totalInterviewers) {
    score += SCORING_WEIGHTS.allInterviewersBonus
  } else if (allowPartialConflict) {
    // 부분적 충돌 허용 시 가능한 면접관 수에 비례한 점수
    score += availableCount * SCORING_WEIGHTS.partialConflictMultiplier
  }
  
  // 요일별 선호도 보너스
  const dayOfWeek = slot.getDay()
  const dayNames: Array<keyof typeof SCORING_WEIGHTS.dayOfWeek> = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
  ]
  
  if (dayOfWeek >= 1 && dayOfWeek <= 5) {
    const dayName = dayNames[dayOfWeek - 1]
    score += SCORING_WEIGHTS.dayOfWeek[dayName]
  }
  
  return score
}

/**
 * 슬롯 필터링 및 정렬
 */
function filterAndSortSlots(
  slots: Array<{
    slot: Date
    slotEnd: Date
    availableInterviewers: string[]
    missingInterviewers: string[]
    isPartialConflict: boolean
  }>,
  totalInterviewers: number,
  minAvailableInterviewers: number,
  allowPartialConflict: boolean,
  durationMinutes: number
): Array<{
  slot: Date
  score: number
  availableInterviewers: string[]
  missingInterviewers: string[]
  isPartialConflict: boolean
}> {
  // 최소 면접관 수 필터링
  const filtered = slots.filter(
    slot => slot.availableInterviewers.length >= minAvailableInterviewers
  )
  
  // missingInterviewers 계산
  const slotsWithMissing = filtered.map(slot => {
    const missing = totalInterviewers > slot.availableInterviewers.length
      ? Array.from({ length: totalInterviewers }, (_, i) => i.toString())
          .filter(id => !slot.availableInterviewers.includes(id))
      : []
    
    return {
      ...slot,
      missingInterviewers: missing,
      isPartialConflict: missing.length > 0,
    }
  })
  
  // 점수 계산 및 정렬
  const scored = slotsWithMissing.map(slot => ({
    ...slot,
    score: calculateSlotScore(
      slot.slot,
      slot.availableInterviewers.length,
      totalInterviewers,
      allowPartialConflict
    ),
  }))
  
  // 점수 순으로 정렬 (높은 점수 우선)
  scored.sort((a, b) => b.score - a.score)
  
  // 겹치지 않는 슬롯 선택 (최소 간격 유지, 최대 개수 제한)
  const selected: Array<{
    slot: Date
    score: number
    availableInterviewers: string[]
    missingInterviewers: string[]
    isPartialConflict: boolean
  }> = []
  
  for (const slotData of scored) {
    if (selected.length >= MAX_SCHEDULE_OPTIONS) break
    
    const isOverlapping = selected.some(selectedSlot => {
      const selectedEnd = addMinutes(selectedSlot.slot, durationMinutes)
      const slotEnd = slotData.slotEnd
      
      // 겹침 체크
      const overlaps = (
        (isAfter(slotData.slot, selectedSlot.slot) && isBefore(slotData.slot, selectedEnd)) ||
        (isAfter(slotEnd, selectedSlot.slot) && isBefore(slotEnd, selectedEnd)) ||
        (isBefore(slotData.slot, selectedSlot.slot) && isAfter(slotEnd, selectedEnd))
      )
      
      // 최소 간격 체크
      const timeDiff = Math.abs(slotData.slot.getTime() - selectedSlot.slot.getTime())
      const endTimeDiff = Math.abs(slotData.slot.getTime() - selectedEnd.getTime())
      const minIntervalMs = MIN_SLOT_INTERVAL_MINUTES * 60 * 1000
      const tooClose = timeDiff < minIntervalMs || endTimeDiff < minIntervalMs
      
      return overlaps || tooClose
    })
    
    if (!isOverlapping) {
      selected.push(slotData)
    }
  }
  
  return selected
}

/**
 * 면접 일정 조율 메인 함수
 * 최적화된 알고리즘: busy time 병합 후 슬롯 생성
 */
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
    minAvailableInterviewers = interviewerIds.length,
    allowedTimeRanges,
    excludedTimeRanges = [],
    interviewerPreferences,
  } = request

  // 최적화된 알고리즘으로 슬롯 생성
  const slots = findAvailableSlotsOptimized(
    busyTimes,
    interviewerIds,
    startDate,
    endDate,
    durationMinutes,
    allowPartialConflict,
    minAvailableInterviewers,
    allowedTimeRanges,
    excludedTimeRanges
  )

  // 면접관 선호(오전/오후) 반영
  const slotsWithPreferences = slots.map(s => {
    if (!interviewerPreferences) return s
    const kst = toZonedTime(s.slot, KST_TIMEZONE)
    const h = kst.getHours()
    const m = kst.getMinutes()
    const inMorning = (h < 12) && !(h === 11 && m >= 30) // 10:00~11:30
    const inAfternoon = h >= 13 // 13:00~17:00

    const filteredAvailable = s.availableInterviewers.filter(id => {
      const pref = interviewerPreferences[id] || 'none'
      if (pref === 'none') return true
      if (pref === 'morning') return inMorning
      if (pref === 'afternoon') return inAfternoon
      return true
    })
    const missing = interviewerIds.filter(id => !filteredAvailable.includes(id))
    return {
      ...s,
      availableInterviewers: filteredAvailable,
      missingInterviewers: missing,
      isPartialConflict: missing.length > 0,
    }
  })

  // 슬롯 필터링 및 정렬
  const filteredAndSorted = filterAndSortSlots(
    slotsWithPreferences,
    interviewerIds.length,
    minAvailableInterviewers,
    allowPartialConflict,
    durationMinutes
  )

  // 최종 필터링: 공휴일 제거 및 결과 변환
  const finalSlots = filteredAndSorted
    .filter(slotData => {
      const dayOfWeek = toZonedTime(slotData.slot, KST_TIMEZONE).getDay()
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
      const kst = toZonedTime(slotData.slot, KST_TIMEZONE)
      return !isWeekend && !isKoreanHoliday(kst)
    })
    .map(slotData => ({
      scheduledAt: slotData.slot,
      duration: durationMinutes,
      availableInterviewers: slotData.availableInterviewers,
      missingInterviewers: slotData.missingInterviewers,
      isPartialConflict: slotData.isPartialConflict,
    }))

  return finalSlots
}

