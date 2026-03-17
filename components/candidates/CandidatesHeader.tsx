'use client';

import { Plus } from 'lucide-react';

type ArchiveFilter = 'active' | 'archived' | 'confirmed';

interface CandidatesHeaderProps {
  archiveFilter: ArchiveFilter;
  onArchiveFilterChange: (filter: ArchiveFilter) => void;
  activeCandidatesCount: number;
  onAddCandidateClick: () => void;
}

/** 후보자 페이지 상단: 제목, 필터 탭(Active/Archived/Hired), Add Candidate 버튼 */
export function CandidatesHeader({
  archiveFilter,
  onArchiveFilterChange,
  activeCandidatesCount,
  onAddCandidateClick,
}: CandidatesHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-10">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Candidates</h1>
        <span className="px-2 py-0.5 bg-neutral-100 text-neutral-500 border border-neutral-200 rounded-md text-xs font-medium">
          {activeCandidatesCount}
        </span>
      </div>
      
      <div className="flex items-center gap-3">
        <div className="flex p-1 bg-neutral-200/40 rounded-lg border border-neutral-200/50">
          <button
            onClick={() => onArchiveFilterChange('active')}
            className={`px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors rounded-md ${
              archiveFilter === 'active'
                ? 'font-semibold bg-white text-neutral-900 shadow-[0_1px_3px_rgba(0,0,0,0.05)]'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => onArchiveFilterChange('archived')}
            className={`px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors rounded-md ${
              archiveFilter === 'archived'
                ? 'font-semibold bg-white text-neutral-900 shadow-[0_1px_3px_rgba(0,0,0,0.05)]'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            Archived
          </button>
          <button
            onClick={() => onArchiveFilterChange('confirmed')}
            className={`px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors rounded-md ${
              archiveFilter === 'confirmed'
                ? 'font-semibold bg-white text-neutral-900 shadow-[0_1px_3px_rgba(0,0,0,0.05)]'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            Hired
          </button>
        </div>
        
        <button
          onClick={onAddCandidateClick}
          className="flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-lg text-sm font-medium hover:bg-neutral-800 transition-all shadow-[0_2px_8px_rgba(0,0,0,0.08)] active:scale-[0.98]"
        >
          <Plus className="w-4 h-4 text-neutral-300" />
          Add Candidate
        </button>
      </div>
    </div>
  );
}
