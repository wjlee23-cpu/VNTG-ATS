'use client';

import { Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ArchiveFilter = 'active' | 'archived' | 'confirmed';

interface CandidatesHeaderProps {
  archiveFilter: ArchiveFilter;
  onArchiveFilterChange: (filter: ArchiveFilter) => void;
  activeCandidatesCount: number;
  onAddCandidateClick: () => void;
}

/** 후보자 페이지 상단: 제목, 필터 탭(Active/Archived/입사확정), Add Candidate 버튼 */
export function CandidatesHeader({
  archiveFilter,
  onArchiveFilterChange,
  activeCandidatesCount,
  onAddCandidateClick,
}: CandidatesHeaderProps) {
  const countLabel =
    archiveFilter === 'archived'
      ? `${activeCandidatesCount} archived candidates`
      : archiveFilter === 'confirmed'
        ? `${activeCandidatesCount} confirmed candidates`
        : `${activeCandidatesCount} active candidates`;

  return (
    <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
      <div className="flex items-center gap-3">
        <Users className="w-8 h-8 text-foreground" />
        <h1 className="text-3xl font-bold text-foreground">Candidates</h1>
        <span className="bg-blue-50 text-[#5287FF] rounded-full px-3 py-1 text-sm font-medium">
          {countLabel}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex gap-2">
          <Button
            onClick={() => onArchiveFilterChange('active')}
            variant="outline"
            className={`h-10 px-4 border-slate-200 text-slate-600 hover:bg-slate-50 ${
              archiveFilter === 'active' ? 'bg-slate-50 border-slate-300' : ''
            }`}
          >
            Active
          </Button>
          <Button
            onClick={() => onArchiveFilterChange('archived')}
            variant="outline"
            className={`h-10 px-4 border-slate-200 text-slate-600 hover:bg-slate-50 ${
              archiveFilter === 'archived' ? 'bg-slate-50 border-slate-300' : ''
            }`}
          >
            Archived
          </Button>
          <Button
            onClick={() => onArchiveFilterChange('confirmed')}
            variant="outline"
            className={`h-10 px-4 border-slate-200 text-slate-600 hover:bg-slate-50 ${
              archiveFilter === 'confirmed' ? 'bg-slate-50 border-slate-300' : ''
            }`}
          >
            입사확정
          </Button>
        </div>
        <Button
          onClick={onAddCandidateClick}
          className="h-10 bg-gradient-to-r from-[#0248FF] to-[#5287FF] hover:from-[#0248FF]/90 hover:to-[#5287FF]/90 text-white border-0"
        >
          <Users className="w-4 h-4 mr-2" />
          Add Candidate
        </Button>
      </div>
    </div>
  );
}
