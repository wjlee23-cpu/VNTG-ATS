'use client';

import { Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/components/ui/utils';

interface ScheduleFiltersProps {
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  dateRange?: { from: Date | null; to: Date | null };
  onDateRangeChange?: (range: { from: Date | null; to: Date | null }) => void;
  className?: string;
}

const statusOptions = [
  { value: 'all', label: '전체' },
  { value: 'pending_interviewers', label: '면접관 대기' },
  { value: 'pending_candidate', label: '후보자 대기' },
  { value: 'confirmed', label: '확정됨' },
  { value: 'cancelled', label: '취소됨' },
  { value: 'needs_rescheduling', label: '재조율 필요' },
];

export function ScheduleFilters({
  statusFilter,
  onStatusFilterChange,
  searchQuery,
  onSearchChange,
  className,
}: ScheduleFiltersProps) {
  const hasActiveFilters = statusFilter !== 'all' || searchQuery.length > 0;

  const clearFilters = () => {
    onStatusFilterChange('all');
    onSearchChange('');
  };

  return (
    <div className={cn('bg-white rounded-xl border border-slate-200 p-4 shadow-sm', className)}>
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        {/* 검색 입력 */}
        <div className="flex-1 w-full sm:w-auto min-w-0">
          <div className="relative">
            <Input
              type="text"
              placeholder="후보자 이름 또는 이메일 검색..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 pr-10"
            />
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* 상태 필터 */}
        <div className="w-full sm:w-auto">
          <Select value={statusFilter} onValueChange={onStatusFilterChange}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="상태 필터" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 필터 초기화 버튼 */}
        {hasActiveFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={clearFilters}
            className="w-full sm:w-auto"
          >
            <X className="w-4 h-4 mr-2" />
            필터 초기화
          </Button>
        )}
      </div>
    </div>
  );
}
