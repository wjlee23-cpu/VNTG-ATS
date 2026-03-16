'use client';

import { Check, X, ArrowRightCircle, Mail, Archive } from 'lucide-react';

interface BulkActionBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onBulkMove: () => void;
  onBulkEmail: () => void;
  onBulkArchive: () => void;
}

/** 선택된 후보자에 대한 일괄 액션 플로팅 바 */
export function BulkActionBar({
  selectedCount,
  onClearSelection,
  onBulkMove,
  onBulkEmail,
  onBulkArchive,
}: BulkActionBarProps) {
  return (
    <div className="fixed bottom-6 left-1/2 z-50 bulk-action-bar-enter">
      <div className="flex items-center gap-2 bg-slate-900 text-white rounded-xl px-4 py-2.5 shadow-2xl shadow-slate-900/30 border border-slate-700">
        <div className="flex items-center gap-2 pr-3 border-r border-slate-700">
          <div className="w-6 h-6 rounded-md bg-[#5287FF] flex items-center justify-center">
            <Check className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-medium whitespace-nowrap">
            {selectedCount}명 선택
          </span>
          <button
            onClick={onClearSelection}
            className="ml-1 p-1 rounded-md hover:bg-slate-700 transition-colors"
            title="선택 해제"
          >
            <X className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
        <div className="flex items-center gap-1.5 pl-1">
          <button
            onClick={onBulkMove}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors whitespace-nowrap"
          >
            <ArrowRightCircle className="w-4 h-4 text-violet-400" />
            전형 이동
          </button>
          <button
            onClick={onBulkEmail}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors whitespace-nowrap"
          >
            <Mail className="w-4 h-4 text-sky-400" />
            이메일
          </button>
          <button
            onClick={onBulkArchive}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors whitespace-nowrap"
          >
            <Archive className="w-4 h-4 text-orange-400" />
            아카이브
          </button>
        </div>
      </div>
    </div>
  );
}
