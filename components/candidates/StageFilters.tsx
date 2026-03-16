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
    <div className="mb-6 overflow-x-auto">
      <div className="bg-slate-100 p-1 rounded-lg inline-flex gap-1 min-w-max">
        {RECRUITMENT_STAGES.map((stage) => {
          const count =
            stage.id === 'all' ? totalCount : stageCounts[stage.name] || 0;
          const isSelected = selectedStage === stage.id;
          return (
            <button
              key={stage.id}
              onClick={() => onStageChange(stage.id)}
              className={`
                px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-all
                ${
                  isSelected
                    ? 'bg-white shadow-sm text-foreground'
                    : 'text-slate-600 hover:bg-slate-50/50'
                }
              `}
            >
              {stage.label}
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
