'use client';

import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/components/ui/utils';

interface ScheduleProgressBarProps {
  status: 'pending_interviewers' | 'pending_candidate' | 'confirmed' | 'cancelled' | 'needs_rescheduling' | null;
  className?: string;
}

const steps = [
  { key: 'pending_interviewers', label: '면접관 수락 대기' },
  { key: 'pending_candidate', label: '후보자 선택 대기' },
  { key: 'confirmed', label: '확정됨' },
] as const;

export function ScheduleProgressBar({ status, className }: ScheduleProgressBarProps) {
  // 현재 단계 인덱스 찾기
  const getCurrentStepIndex = () => {
    if (!status) return -1;
    if (status === 'cancelled' || status === 'needs_rescheduling') return -1;
    return steps.findIndex((step) => step.key === status);
  };

  const currentStepIndex = getCurrentStepIndex();

  return (
    <div className={cn('relative py-4', className)}>
      {/* 배경 선 (Track) - 얇고 우아하게 */}
      <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-slate-100 -translate-y-1/2" />

      {/* 진행된 선 (Fill) - 브랜드 컬러 */}
      {currentStepIndex >= 0 && (
        <div
          className="absolute top-1/2 left-0 h-[2px] bg-brand-main -translate-y-1/2 transition-all duration-300"
          style={{
            width: currentStepIndex === 0 ? '0%' : currentStepIndex === 1 ? '50%' : '100%',
          }}
        />
      )}

      {/* 단계 노드들 */}
      <div className="relative flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = currentStepIndex > index;
          const isCurrent = currentStepIndex === index;
          const isPending = currentStepIndex < index;

          return (
            <div key={step.key} className="flex flex-col items-center flex-1 relative z-10">
              {/* 타임라인 노드 */}
              <div
                className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200',
                  isCompleted
                    ? 'bg-brand-main text-white shadow-sm'
                    : isCurrent
                    ? 'bg-white border-2 border-brand-main ring-4 ring-brand-main/10'
                    : 'bg-white border-2 border-slate-200'
                )}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : isCurrent ? (
                  <div className="w-2 h-2 rounded-full bg-brand-main" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-slate-300" />
                )}
              </div>

              {/* 노드 텍스트 */}
              <span
                className={cn(
                  'text-xs font-medium mt-3 whitespace-nowrap transition-colors',
                  isCurrent
                    ? 'text-brand-main font-bold'
                    : isCompleted
                    ? 'text-slate-600'
                    : 'text-slate-400'
                )}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
