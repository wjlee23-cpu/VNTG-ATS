import { useState } from 'react';
import { Calendar as CalendarIcon, Coffee, Droplet, Wine } from 'lucide-react';
import { Button } from '../ui/button';
import { VNTGSymbol } from '../vntg/VNTGSymbol';

const availableSlots = [
  { date: '2026-02-10', time: '10:00 AM', available: true },
  { date: '2026-02-10', time: '2:00 PM', available: true },
  { date: '2026-02-11', time: '11:00 AM', available: true },
  { date: '2026-02-11', time: '3:00 PM', available: false },
  { date: '2026-02-12', time: '9:00 AM', available: true },
  { date: '2026-02-12', time: '1:00 PM', available: true },
  { date: '2026-02-13', time: '10:00 AM', available: true },
  { date: '2026-02-13', time: '4:00 PM', available: true },
];

const drinks = [
  { id: 'coffee', name: 'Coffee', icon: Coffee },
  { id: 'tea', name: 'Tea', icon: Wine },
  { id: 'water', name: 'Water', icon: Droplet },
];

export function SchedulingPage() {
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [selectedDrink, setSelectedDrink] = useState<string | null>(null);

  const handleConfirm = () => {
    if (selectedSlot && selectedDrink) {
      alert(`인터뷰가 예약되었습니다!\n일시: ${selectedSlot}\n음료: ${selectedDrink}`);
    }
  };

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
                {availableSlots.map((slot, index) => (
                  <button
                    key={index}
                    onClick={() => slot.available && setSelectedSlot(`${slot.date} ${slot.time}`)}
                    disabled={!slot.available}
                    className={`w-full p-4 rounded-lg border-2 transition-all ${
                      selectedSlot === `${slot.date} ${slot.time}`
                        ? 'border-[#0248FF] bg-[#0248FF] text-white'
                        : slot.available
                        ? 'border-gray-200 hover:border-[#5287FF] hover:bg-gray-50'
                        : 'border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span style={{ fontFamily: 'Roboto, sans-serif' }}>
                        {new Date(slot.date).toLocaleDateString('ko-KR', {
                          month: 'long',
                          day: 'numeric',
                          weekday: 'short'
                        })}
                      </span>
                      <span style={{ fontFamily: 'Roboto, sans-serif' }}>{slot.time}</span>
                    </div>
                    {!slot.available && (
                      <div className="text-xs mt-1" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                        예약 불가
                      </div>
                    )}
                  </button>
                ))}
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
                  const Icon = drink.icon;
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
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        selectedDrink === drink.name ? 'bg-white' : 'bg-gray-100'
                      }`}>
                        <Icon
                          size={24}
                          className={selectedDrink === drink.name ? 'text-[#0248FF]' : 'text-gray-600'}
                        />
                      </div>
                      <span className="text-lg" style={{ fontFamily: 'Roboto, sans-serif' }}>
                        {drink.name}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-8 p-6 bg-gray-50 rounded-lg">
                <h3 className="text-sm mb-2" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                  선택한 정보
                </h3>
                <div className="text-sm text-gray-600 space-y-1" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                  <div>일정: {selectedSlot || '선택 안 됨'}</div>
                  <div>음료: {selectedDrink || '선택 안 됨'}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Confirm Button */}
          <div className="mt-12 text-center">
            <Button
              onClick={handleConfirm}
              disabled={!selectedSlot || !selectedDrink}
              className="bg-[#0248FF] hover:bg-[#0236cc] text-white px-12 py-6 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ fontFamily: 'Noto Sans KR, sans-serif' }}
            >
              인터뷰 확정하기
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
  );
}