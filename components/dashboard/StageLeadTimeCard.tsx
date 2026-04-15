'use client';

import { AlertTriangle } from 'lucide-react';

export type StageLeadTimeRow = {
  id: string;
  label: string;
  days: number;
};

type StageLeadTimeCardProps = {
  stages: StageLeadTimeRow[];
  totalDays: number;
  summaryLine: string;
};

export function StageLeadTimeCard({ stages, totalDays, summaryLine }: StageLeadTimeCardProps) {
  const maxDays = Math.max(...stages.map((s) => s.days), 0);
  const bottleneckId =
    maxDays > 0 ? stages.find((s) => s.days === maxDays)?.id ?? stages[0]?.id : undefined;

  return (
    <div className="bg-white rounded-2xl p-6 sm:p-8 border border-neutral-200 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.05)] flex flex-col relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-orange-400 to-transparent opacity-50" />

      <div className="flex items-center justify-between mb-8 shrink-0">
        <div>
          <h2 className="text-sm font-bold text-neutral-900 uppercase tracking-wider mb-1">
            단계별 소요 시간 (리드타임)
          </h2>
          <p className="text-[10px] font-medium text-neutral-400">{summaryLine}</p>
        </div>
        <span className="text-xs font-bold text-neutral-900 bg-neutral-100 px-2 py-1 rounded-md border border-neutral-200">
          {'\uCD1D'} {totalDays.toFixed(1)}일
        </span>
      </div>

      <div className="flex-1 flex flex-col justify-center space-y-5">
        {stages.map((stage) => {
          const isBottleneck = stage.id === bottleneckId && maxDays > 0;
          const barPct = maxDays > 0 ? Math.round((stage.days / maxDays) * 100) : 0;

          return (
            <div key={stage.id} className="flex items-center gap-4 group">
              <div className="w-24 text-right relative">
                <span
                  className={`text-[11px] font-bold uppercase tracking-wider ${
                    isBottleneck
                      ? 'text-orange-600'
                      : 'text-neutral-500 group-hover:text-neutral-900 transition-colors'
                  }`}
                >
                  {stage.label}
                </span>
                {isBottleneck && (
                  <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-orange-500" />
                )}
              </div>
              <div className="flex-1 flex items-center min-w-0">
                <div
                  className={`h-5 rounded-r-sm transition-all duration-500 ${
                    isBottleneck
                      ? 'bg-orange-200 border-r-2 border-orange-500'
                      : 'bg-neutral-200'
                  }`}
                  style={{ width: `${barPct}%` }}
                />
                <span
                  className={`ml-2 text-xs font-extrabold shrink-0 flex items-center gap-1 ${
                    isBottleneck ? 'text-orange-600' : 'text-neutral-900'
                  }`}
                >
                  {stage.days.toFixed(1)}일
                  {isBottleneck && <AlertTriangle className="w-3 h-3" />}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
