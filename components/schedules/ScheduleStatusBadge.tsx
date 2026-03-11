'use client';

import { CheckCircle2, Clock, AlertCircle, XCircle, AlertTriangle, User } from 'lucide-react';
import { cn } from '@/components/ui/utils';

interface ScheduleStatusBadgeProps {
  status: 'pending_interviewers' | 'pending_candidate' | 'confirmed' | 'cancelled' | 'needs_rescheduling' | null;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const statusConfig = {
  pending_interviewers: {
    label: '면접관 수락 대기',
    bgColor: 'bg-amber-100',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-200',
    icon: Clock,
    iconColor: 'text-amber-600',
  },
  pending_candidate: {
    label: '후보자 선택 대기',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200',
    icon: User,
    iconColor: 'text-blue-600',
  },
  confirmed: {
    label: '확정됨',
    bgColor: 'bg-emerald-100',
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-200',
    icon: CheckCircle2,
    iconColor: 'text-emerald-600',
  },
  cancelled: {
    label: '취소됨',
    bgColor: 'bg-slate-100',
    textColor: 'text-slate-700',
    borderColor: 'border-slate-200',
    icon: XCircle,
    iconColor: 'text-slate-600',
  },
  needs_rescheduling: {
    label: '재조율 필요',
    bgColor: 'bg-rose-100',
    textColor: 'text-rose-700',
    borderColor: 'border-rose-200',
    icon: AlertTriangle,
    iconColor: 'text-rose-600',
  },
  null: {
    label: '상태 불명',
    bgColor: 'bg-slate-100',
    textColor: 'text-slate-700',
    borderColor: 'border-slate-200',
    icon: AlertCircle,
    iconColor: 'text-slate-600',
  },
};

const sizeConfig = {
  sm: {
    padding: 'px-2 py-0.5',
    text: 'text-xs',
    icon: 'w-3 h-3',
  },
  md: {
    padding: 'px-2.5 py-1',
    text: 'text-sm',
    icon: 'w-4 h-4',
  },
  lg: {
    padding: 'px-3 py-1.5',
    text: 'text-base',
    icon: 'w-5 h-5',
  },
};

export function ScheduleStatusBadge({
  status,
  showIcon = true,
  size = 'md',
  className,
}: ScheduleStatusBadgeProps) {
  const config = statusConfig[status || 'null'];
  const sizeStyles = sizeConfig[size];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium border',
        config.bgColor,
        config.textColor,
        config.borderColor,
        sizeStyles.padding,
        sizeStyles.text,
        className
      )}
    >
      {showIcon && <Icon className={cn(sizeStyles.icon, config.iconColor)} />}
      <span>{config.label}</span>
    </span>
  );
}
