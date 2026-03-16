'use client';

import { ARCHIVE_REASONS } from '@/constants/archive-reasons';
import type { CandidateWithArchiveReason } from '@/types/candidates';

interface ArchiveReasonFiltersProps {
  selectedReason: string;
  onReasonChange: (reasonId: string) => void;
  archivedCandidates: CandidateWithArchiveReason[];
  totalCount: number;
}

/** Archived 필터일 때 아카이브 사유별 탭 */
export function ArchiveReasonFilters({
  selectedReason,
  onReasonChange,
  archivedCandidates,
  totalCount,
}: ArchiveReasonFiltersProps) {
  return (
    <div className="mb-6 overflow-x-auto">
      <div className="bg-slate-100 p-1 rounded-lg inline-flex gap-1 min-w-max">
        <button
          onClick={() => onReasonChange('all')}
          className={`
            px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-all
            ${
              selectedReason === 'all'
                ? 'bg-white shadow-sm text-foreground'
                : 'text-slate-600 hover:bg-slate-50/50'
            }
          `}
        >
          All Reasons
          {totalCount > 0 && (
            <span
              className={`ml-2 ${selectedReason === 'all' ? 'text-foreground' : 'text-slate-500'}`}
            >
              ({totalCount})
            </span>
          )}
        </button>
        {ARCHIVE_REASONS.map((reason) => {
          const count = archivedCandidates.filter(
            (c) => c.archive_reason === reason.id,
          ).length;
          const isSelected = selectedReason === reason.id;
          return (
            <button
              key={reason.id}
              onClick={() => onReasonChange(reason.id)}
              className={`
                px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-all
                ${
                  isSelected
                    ? 'bg-white shadow-sm text-foreground'
                    : 'text-slate-600 hover:bg-slate-50/50'
                }
              `}
            >
              {reason.label}
              {count > 0 && (
                <span
                  className={`ml-2 ${isSelected ? 'text-foreground' : 'text-slate-500'}`}
                >
                  ({count})
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
