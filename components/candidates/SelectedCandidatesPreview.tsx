'use client';

import type { Candidate } from '@/types/candidates';

interface SelectedCandidatesPreviewProps {
  candidates: Candidate[];
  count: number;
  label?: string;
  maxDisplay?: number;
  showEmail?: boolean;
}

/** Bulk 액션 모달에서 선택된 후보자 칩 목록 미리보기 */
export function SelectedCandidatesPreview({
  candidates,
  count,
  label = '선택된 후보자',
  maxDisplay = 8,
  showEmail = false,
}: SelectedCandidatesPreviewProps) {
  const slice = candidates.slice(0, maxDisplay);
  const rest = candidates.length - maxDisplay;

  return (
    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
      <p className="text-xs text-slate-500 mb-2 font-medium">
        {label} ({count}명)
      </p>
      <div className="flex flex-wrap gap-1.5">
        {slice.map((c) => (
          <span
            key={c.id}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-white rounded-md text-xs font-medium text-slate-700 border border-slate-200"
          >
            <span className="w-4 h-4 rounded-full bg-blue-50 text-[#5287FF] text-[10px] font-bold flex items-center justify-center flex-shrink-0">
              {c.name.charAt(0)}
            </span>
            {c.name}
            {showEmail && (
              <span className="text-slate-400 text-[10px]">{c.email}</span>
            )}
          </span>
        ))}
        {rest > 0 && (
          <span className="text-xs text-slate-500 px-2 py-0.5">
            +{rest}명
          </span>
        )}
      </div>
    </div>
  );
}
