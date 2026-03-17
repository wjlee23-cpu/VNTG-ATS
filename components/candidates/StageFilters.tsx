'use client';

import { RECRUITMENT_STAGES } from '@/constants/stages';

interface StageFiltersProps {
  selectedStage: string;
  onStageChange: (stageId: string) => void;
  stageCounts: Record<string, number>;
  totalCount: number;
}

/** Active 필터일 때 단계별 탭 (All Stages, New Application, ...) */
export function StageFilters({
  selectedStage,
  onStageChange,
  stageCounts,
  totalCount,
}: StageFiltersProps) {
  return (
    <div className="px-2 flex overflow-x-auto border-b border-neutral-100">
      {RECRUITMENT_STAGES.map((stage) => {
        const count =
          stage.id === 'all' ? totalCount : stageCounts[stage.name] || 0;
        const isSelected = selectedStage === stage.id;
        return (
          <button
            key={stage.id}
            onClick={() => onStageChange(stage.id)}
            className={`px-4 py-3 border-b-2 whitespace-nowrap transition-colors ${
              isSelected
                ? 'border-neutral-900 text-sm font-semibold text-neutral-900'
                : 'border-transparent text-sm font-medium text-neutral-500 hover:text-neutral-900'
            }`}
          >
            {stage.label}
            <span className={isSelected ? 'text-neutral-400 font-normal ml-1' : 'ml-1 opacity-60'}>
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
