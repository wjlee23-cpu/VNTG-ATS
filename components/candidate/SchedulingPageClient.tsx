'use client'

import { useState } from 'react'
import { Calendar as CalendarIcon, Coffee, Droplet, Wine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { VNTGSymbol } from '@/components/vntg/VNTGSymbol'
import { confirmScheduleOption } from '@/actions/schedules'
import { format } from 'date-fns'

interface SchedulingPageClientProps {
  candidate: any
  scheduleId: string
  options: Array<{ id: string; scheduledAt: Date }>
  candidateToken: string
}

export function SchedulingPageClient({
  candidate,
  scheduleId,
  options,
  candidateToken,
}: SchedulingPageClientProps) {
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [selectedDrink, setSelectedDrink] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const drinks = [
    { id: 'coffee', name: 'Coffee', icon: Coffee },
    { id: 'tea', name: 'Tea', icon: Wine },
    { id: 'water', name: 'Water', icon: Droplet },
  ]

  const handleConfirm = async () => {
    if (!selectedSlot || !selectedDrink) {
      alert('일정과 음료를 모두 선택해주세요.')
      return
    }

    setIsSubmitting(true)
    try {
      const optionId = selectedSlot
      await confirmScheduleOption(scheduleId, optionId, selectedDrink)
      alert('인터뷰가 예약되었습니다!')
      window.location.reload()
    } catch (error) {
      console.error('Failed to confirm schedule:', error)
      alert('일정 확정에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="absolute top-20 left-20">
          <VNTGSymbol size={120} className="text-[#0248FF]" />
        </div>
        <div className="absolute bottom-20 right-20">
          <VNTGSymbol size={120} className="text-[#0248FF]" />
        </div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <VNTGSymbol size={200} className="text-[#0248FF]" />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl w-full relative z-10">
        {/* Header */}
        <div className="text-center mb-12">
          <VNTGSymbol size={60} className="text-[#0248FF] mx-auto mb-6" />
          <h1 className="text-5xl mb-4" style={{ fontFamily: 'Roboto, sans-serif' }}>
            Welcome, Game-Changer
          </h1>
          <p className="text-xl text-gray-600" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
            당신과의 만남을 기대합니다. 편한 시간을 선택해주세요.
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white border-2 rounded-2xl shadow-lg p-12">
          <div className="grid grid-cols-2 gap-12">
            {/* Left: Calendar */}
            <div>
              <div className="flex items-center gap-3 mb-6">
                <CalendarIcon className="text-[#0248FF]" size={28} />
                <h2 className="text-2xl" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                  인터뷰 일정 선택
                </h2>
              </div>
              <div className="space-y-3">
                {options.map((option) => {
                  const dateStr = format(option.scheduledAt, 'yyyy-MM-dd')
                  const timeStr = format(option.scheduledAt, 'h:mm a')
                  const slotKey = `${option.id}`
                  return (
                    <button
                      key={option.id}
                      onClick={() => setSelectedSlot(slotKey)}
                      className={`w-full p-4 rounded-lg border-2 transition-all ${
                        selectedSlot === slotKey
                          ? 'border-[#0248FF] bg-[#0248FF] text-white'
                          : 'border-gray-200 hover:border-[#5287FF] hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span style={{ fontFamily: 'Roboto, sans-serif' }}>
                          {format(option.scheduledAt, 'MMMM d일 (EEE)', { locale: require('date-fns/locale/ko') })}
                        </span>
                        <span style={{ fontFamily: 'Roboto, sans-serif' }}>{timeStr}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Right: Drink Selection */}
            <div>
              <div className="flex items-center gap-3 mb-6">
                <Coffee className="text-[#0248FF]" size={28} />
                <h2 className="text-2xl" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                  환영 음료 선택
                </h2>
              </div>
              <p className="text-gray-600 mb-6" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                인터뷰 시작 전 즐기실 음료를 선택해주세요.
              </p>
              <div className="space-y-4">
                {drinks.map((drink) => {
                  const Icon = drink.icon
                  return (
                    <button
                      key={drink.id}
                      onClick={() => setSelectedDrink(drink.name)}
                      className={`w-full p-6 rounded-lg border-2 transition-all flex items-center gap-4 ${
                        selectedDrink === drink.name
                          ? 'border-[#0248FF] bg-[#0248FF] text-white'
                          : 'border-gray-200 hover:border-[#5287FF] hover:bg-gray-50'
                      }`}
                    >
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center ${
                          selectedDrink === drink.name ? 'bg-white' : 'bg-gray-100'
                        }`}
                      >
                        <Icon
                          size={24}
                          className={selectedDrink === drink.name ? 'text-[#0248FF]' : 'text-gray-600'}
                        />
                      </div>
                      <span className="text-lg" style={{ fontFamily: 'Roboto, sans-serif' }}>
                        {drink.name}
                      </span>
                    </button>
                  )
                })}
              </div>

              <div className="mt-8 p-6 bg-gray-50 rounded-lg">
                <h3 className="text-sm mb-2" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                  선택한 정보
                </h3>
                <div className="text-sm text-gray-600 space-y-1" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                  <div>
                    일정:{' '}
                    {selectedSlot
                      ? format(
                          options.find((opt) => selectedSlot === opt.id)?.scheduledAt || new Date(),
                          'yyyy년 M월 d일 h:mm a'
                        )
                      : '선택 안 됨'}
                  </div>
                  <div>음료: {selectedDrink || '선택 안 됨'}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Confirm Button */}
          <div className="mt-12 text-center">
            <Button
              onClick={handleConfirm}
              disabled={!selectedSlot || !selectedDrink || isSubmitting}
              className="bg-[#0248FF] hover:bg-[#0236cc] text-white px-12 py-6 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ fontFamily: 'Noto Sans KR, sans-serif' }}
            >
              {isSubmitting ? '처리 중...' : '인터뷰 확정하기'}
            </Button>
            <div className="mt-4">
              <button
                onClick={() => alert('재조율 요청이 접수되었습니다. 담당자가 새로운 시간대를 제안해드리겠습니다.')}
                className="text-gray-500 hover:text-gray-700 text-sm underline"
                style={{ fontFamily: 'Noto Sans KR, sans-serif' }}
              >
                None of these times work? Request Reschedule
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
