"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  format,
  isBefore,
  startOfDay,
  isWithinInterval,
  isAfter,
} from "date-fns";
import { ko } from "date-fns/locale";
import { cn } from "./utils";
import { buttonVariants } from "./button";

interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

interface DateRangePickerProps {
  selected?: DateRange;
  onSelect?: (range: DateRange) => void;
  disabled?: (date: Date) => boolean;
  numberOfMonths?: number;
  className?: string;
}

export function DateRangePicker({
  selected,
  onSelect,
  disabled,
  numberOfMonths = 2,
  className,
}: DateRangePickerProps) {
  const [currentMonth, setCurrentMonth] = React.useState(new Date());
  const [hoveredDate, setHoveredDate] = React.useState<Date | null>(null);

  // 오늘 날짜 (시간 제거)
  const today = startOfDay(new Date());

  // 현재 표시할 달들
  const months = Array.from({ length: numberOfMonths }, (_, i) => 
    addMonths(currentMonth, i)
  );

  // 날짜 클릭 핸들러
  const handleDateClick = (date: Date) => {
    if (disabled && disabled(date)) return;

    if (!selected?.from || (selected.from && selected.to)) {
      // 시작일 선택 또는 리셋
      onSelect?.({ from: date, to: undefined });
    } else if (selected.from && !selected.to) {
      // 종료일 선택
      if (isBefore(date, selected.from)) {
        // 종료일이 시작일보다 이전이면 시작일로 변경
        onSelect?.({ from: date, to: undefined });
      } else {
        // 정상적인 종료일 선택
        onSelect?.({ from: selected.from, to: date });
      }
    }
  };

  // 날짜가 선택 범위에 포함되는지 확인
  const isInRange = (date: Date) => {
    if (!selected?.from) return false;
    if (selected.to) {
      // 시작일과 종료일이 같으면 범위로 표시하지 않음
      if (isSameDay(selected.from, selected.to)) return false;
      return isWithinInterval(date, { start: selected.from, end: selected.to });
    }
    if (hoveredDate && selected.from && !isSameDay(selected.from, hoveredDate)) {
      const start = isBefore(selected.from, hoveredDate) ? selected.from : hoveredDate;
      const end = isAfter(selected.from, hoveredDate) ? selected.from : hoveredDate;
      return isWithinInterval(date, { start, end });
    }
    return false;
  };

  // 날짜가 범위의 시작인지 확인
  const isRangeStart = (date: Date) => {
    return selected?.from && isSameDay(date, selected.from);
  };

  // 날짜가 범위의 끝인지 확인
  const isRangeEnd = (date: Date) => {
    return selected?.to && isSameDay(date, selected.to);
  };

  // 달력 그리드 생성
  const getCalendarDays = (month: Date) => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // 일요일 시작
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  };

  // 요일 헤더 (일요일부터)
  const weekDays = ["일", "월", "화", "수", "목", "금", "토"];

  return (
    <div className={cn("block", className)}>
      <div className={cn(
        "flex",
        numberOfMonths === 1 ? "justify-center" : "",
        numberOfMonths > 1 ? "flex-col md:flex-row gap-8" : ""
      )}>
        {months.map((month, monthIndex) => {
          const days = getCalendarDays(month);
          
          return (
            <div key={monthIndex} className="flex-shrink-0 w-[280px]">
              {/* 월 헤더 및 네비게이션 - 중앙 정렬 및 절대 위치 화살표 */}
              <div className="relative flex items-center justify-center h-10 w-[280px] mb-4">
                {/* 왼쪽 화살표 (첫 번째 달에만 표시) */}
                {monthIndex === 0 && (
                  <button
                    type="button"
                    onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                    className={cn(
                      buttonVariants({ variant: "outline" }),
                      "absolute left-0 h-7 w-7 p-0 opacity-50 hover:opacity-100"
                    )}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                )}
                
                {/* 월 텍스트 - 정중앙 고정 */}
                <h3 className="text-sm font-semibold text-slate-900">
                  {format(month, "yyyy년 M월", { locale: ko })}
                </h3>
                
                {/* 오른쪽 화살표 (마지막 달에만 표시) */}
                {monthIndex === months.length - 1 && (
                  <button
                    type="button"
                    onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                    className={cn(
                      buttonVariants({ variant: "outline" }),
                      "absolute right-0 h-7 w-7 p-0 opacity-50 hover:opacity-100"
                    )}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* 요일 헤더 - 7열 그리드 고정 */}
              <div className="grid grid-cols-7 w-max mb-2">
                {weekDays.map((day, index) => (
                  <div
                    key={index}
                    className="text-slate-400 font-medium text-[0.8rem] w-10 h-10 flex items-center justify-center"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* 날짜 그리드 - 7열 그리드 고정 */}
              <div className="grid grid-cols-7 w-max">
                {days.map((date, dateIndex) => {
                  const isCurrentMonth = isSameMonth(date, month);
                  const isToday = isSameDay(date, today);
                  const isDisabled = disabled ? disabled(date) : false;
                  const isSelected = isRangeStart(date) || isRangeEnd(date);
                  const inRange = isInRange(date);
                  const isRangeStartDate = isRangeStart(date);
                  const isRangeEndDate = isRangeEnd(date);

                  return (
                    <button
                      key={dateIndex}
                      type="button"
                      onClick={() => handleDateClick(date)}
                      onMouseEnter={() => setHoveredDate(date)}
                      onMouseLeave={() => setHoveredDate(null)}
                      disabled={isDisabled}
                      className={cn(
                        "w-10 h-10 flex items-center justify-center text-sm transition-colors cursor-pointer",
                        !isCurrentMonth && "text-slate-300",
                        isCurrentMonth && !isSelected && !inRange && "text-slate-700",
                        isDisabled && "text-slate-300 opacity-50 cursor-not-allowed",
                        // 일반 날짜 hover 효과 (범위 안에 있지 않은 경우)
                        !isDisabled && !isSelected && !inRange && "hover:bg-slate-100 hover:text-slate-900 rounded-full",
                        // 범위 내 날짜 스타일 (중간 기간)
                        inRange && !isRangeStartDate && !isRangeEndDate && "bg-blue-50 text-[#5287FF] rounded-none",
                        // 범위 시작일
                        isRangeStartDate && selected?.to && !isRangeEndDate && "bg-[#5287FF] text-white font-bold rounded-full shadow-sm",
                        // 범위 종료일
                        isRangeEndDate && !isRangeStartDate && "bg-[#5287FF] text-white font-bold rounded-full shadow-sm",
                        // 시작일과 종료일이 같은 경우 (단일 날짜 선택)
                        isRangeStartDate && isRangeEndDate && "bg-[#5287FF] text-white font-bold rounded-full shadow-sm",
                        // 시작일만 선택된 경우
                        isRangeStartDate && !selected?.to && "bg-[#5287FF] text-white font-bold rounded-full shadow-sm",
                        // 오늘 날짜 (선택되지 않은 경우)
                        isToday && !isSelected && !inRange && "bg-slate-100 text-blue-600 font-bold rounded-full"
                      )}
                    >
                      {format(date, "d")}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
