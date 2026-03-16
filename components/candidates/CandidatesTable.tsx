'use client';

import { Check, Archive, CheckCircle2 } from 'lucide-react';
import { getStageNameByStageId } from '@/constants/stages';
import { CANDIDATE_STATUS_CONFIG } from '@/constants/candidates';
import { cn } from '@/components/ui/utils';
import type { Candidate } from '@/types/candidates';

type StatusConfig = {
  label: string;
  dotColor: string;
  bgColor: string;
  textColor: string;
};

interface CandidatesTableProps {
  candidates: Candidate[];
  selectedStage: string;
  selectedCandidateId: string | null;
  selectedIds: Set<string>;
  isAllSelected: boolean;
  isSomeSelected: boolean;
  getStageName: (stageId: string | null) => string;
  getStatusConfig: (status: string) => StatusConfig;
  onRowClick: (candidateId: string) => void;
  onToggleSelect: (candidateId: string, e?: React.MouseEvent) => void;
  onToggleSelectAll: () => void;
  onArchiveClick: (candidate: { id: string; name: string }) => void;
  onConfirmHire: (candidateId: string) => void;
}

/** 후보자 목록 테이블 (헤더 + 행) */
export function CandidatesTable({
  candidates,
  selectedStage,
  selectedCandidateId,
  selectedIds,
  isAllSelected,
  isSomeSelected,
  getStageName,
  getStatusConfig,
  onRowClick,
  onToggleSelect,
  onToggleSelectAll,
  onArchiveClick,
  onConfirmHire,
}: CandidatesTableProps) {
  return (
    <div className="overflow-hidden border border-slate-200 rounded-xl">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="w-12 px-4 py-4">
                <button
                  onClick={onToggleSelectAll}
                  className={cn(
                    'w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-150',
                    isAllSelected
                      ? 'bg-[#5287FF] border-[#5287FF]'
                      : isSomeSelected
                        ? 'bg-[#5287FF]/20 border-[#5287FF]'
                        : 'border-slate-300 hover:border-slate-400',
                  )}
                >
                  {isAllSelected && <Check className="w-3 h-3 text-white" />}
                  {!isAllSelected && isSomeSelected && (
                    <div className="w-2 h-0.5 bg-[#5287FF] rounded-full" />
                  )}
                </button>
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                CANDIDATE
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                POSITION
              </th>
              {selectedStage === 'all' && (
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  STAGE
                </th>
              )}
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                MATCH
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                APPLIED
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                STATUS
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider" />
            </tr>
          </thead>
          <tbody>
            {candidates.map((candidate) => (
              <CandidatesTableRow
                key={candidate.id}
                candidate={candidate}
                selectedStage={selectedStage}
                selectedCandidateId={selectedCandidateId}
                isChecked={selectedIds.has(candidate.id)}
                getStageName={getStageName}
                getStatusConfig={getStatusConfig}
                onRowClick={onRowClick}
                onToggleSelect={onToggleSelect}
                onArchiveClick={onArchiveClick}
                onConfirmHire={onConfirmHire}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface CandidatesTableRowProps {
  candidate: Candidate;
  selectedStage: string;
  selectedCandidateId: string | null;
  isChecked: boolean;
  getStageName: (stageId: string | null) => string;
  getStatusConfig: (status: string) => StatusConfig;
  onRowClick: (candidateId: string) => void;
  onToggleSelect: (candidateId: string, e?: React.MouseEvent) => void;
  onArchiveClick: (candidate: { id: string; name: string }) => void;
  onConfirmHire: (candidateId: string) => void;
}

function CandidatesTableRow({
  candidate,
  selectedStage,
  selectedCandidateId,
  isChecked,
  getStageName,
  getStatusConfig,
  onRowClick,
  onToggleSelect,
  onArchiveClick,
  onConfirmHire,
}: CandidatesTableRowProps) {
  const stageName = getStageName(candidate.current_stage_id);
  const matchScore = candidate.ai_score ?? 0;
  const statusCfg = getStatusConfig(candidate.status);
  const showConfirmHire =
    getStageNameByStageId(candidate.current_stage_id) === 'Offer';

  return (
    <tr
      onClick={() => onRowClick(candidate.id)}
      className={cn(
        'cursor-pointer transition-colors border-b border-slate-100/50',
        isChecked ? 'bg-blue-50/60 hover:bg-blue-50/80' : 'hover:bg-blue-50/40',
        selectedCandidateId === candidate.id && 'bg-blue-50/30',
      )}
    >
      <td className="w-12 px-4 py-4">
        <button
          onClick={(e) => onToggleSelect(candidate.id, e)}
          className={cn(
            'w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-150',
            isChecked ? 'bg-[#5287FF] border-[#5287FF]' : 'border-slate-300 hover:border-[#5287FF]',
          )}
        >
          {isChecked && <Check className="w-3 h-3 text-white" />}
        </button>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-50 text-[#5287FF] font-medium flex items-center justify-center flex-shrink-0">
            {candidate.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="font-medium text-foreground truncate">
              {candidate.name}
            </div>
            <div className="text-sm text-muted-foreground truncate">
              {candidate.email}
            </div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="text-sm text-foreground">
          <div className="font-medium">
            {candidate.job_posts?.title || '알 수 없음'}
          </div>
          <div className="text-muted-foreground text-xs mt-1">Seoul, Korea</div>
        </div>
      </td>
      {selectedStage === 'all' && (
        <td className="px-6 py-4">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
            {stageName}
          </span>
        </td>
      )}
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          {matchScore > 0 ? (
            <>
              <div className="flex-1 bg-slate-100 rounded-full h-2 max-w-[100px]">
                <div
                  className="bg-gradient-to-r from-[#0248FF] to-[#5287FF] h-2 rounded-full transition-all"
                  style={{ width: `${matchScore}%` }}
                />
              </div>
              <span className="text-sm font-semibold text-foreground">
                {matchScore}
              </span>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">-</span>
          )}
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="text-sm text-muted-foreground">
          {new Date(candidate.created_at).toISOString().split('T')[0]}
        </div>
      </td>
      <td className="px-6 py-4">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border',
            statusCfg.bgColor,
            statusCfg.textColor,
          )}
        >
          <span className={cn('w-1.5 h-1.5 rounded-full', statusCfg.dotColor)} />
          {statusCfg.label}
        </span>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          {showConfirmHire && (
            <button
              onClick={async (e) => {
                e.stopPropagation();
                if (
                  !confirm(
                    '입사 확정 처리하시겠습니까? 입사 확정된 후보자는 입사확정 필터에서 조회할 수 있습니다.',
                  )
                ) {
                  return;
                }
                onConfirmHire(candidate.id);
              }}
              className="p-1.5 hover:bg-green-100 rounded-lg transition-colors"
              title="입사 확정"
            >
              <CheckCircle2 size={16} className="text-green-600" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onArchiveClick({ id: candidate.id, name: candidate.name });
            }}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
            title="아카이브"
          >
            <Archive size={16} className="text-slate-400" />
          </button>
        </div>
      </td>
    </tr>
  );
}
