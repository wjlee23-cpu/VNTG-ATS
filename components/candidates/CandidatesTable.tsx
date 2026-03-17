'use client';

import {
  Check,
  Archive,
  CheckCircle2,
  CircleDashed,
  AlertCircle,
  Clock,
  XCircle,
  MoreHorizontal,
} from 'lucide-react';
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
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-neutral-100">
            <th className="w-12 px-5 py-3">
              <input
                type="checkbox"
                className="custom-checkbox cursor-pointer"
                checked={isAllSelected}
                onChange={onToggleSelectAll}
              />
            </th>
            <th className="px-4 py-3 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
              Candidate
            </th>
            <th className="px-4 py-3 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
              Position
            </th>
            {selectedStage === 'all' && (
              <th className="px-4 py-3 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                Stage
              </th>
            )}
            <th className="px-4 py-3 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
              AI Match
            </th>
            <th className="px-4 py-3 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
              Applied
            </th>
            <th className="px-4 py-3 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
              Status
            </th>
            <th className="px-4 py-3 w-16"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100/60">
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

  // Status 아이콘 매핑
  const statusIconMap: Record<
    string,
    { icon: React.ComponentType<{ className?: string }>; color: string }
  > = {
    in_progress: { icon: CircleDashed, color: 'text-blue-500' },
    issue: { icon: AlertCircle, color: 'text-orange-500' },
    pending: { icon: Clock, color: 'text-amber-500' },
    confirmed: { icon: CheckCircle2, color: 'text-emerald-500' },
    rejected: { icon: XCircle, color: 'text-rose-500' },
  };

  const StatusIcon = statusIconMap[candidate.status]?.icon || CircleDashed;
  const statusColor =
    statusIconMap[candidate.status]?.color || 'text-neutral-500';

  // AI Match Score 색상 결정
  const getMatchScoreColor = (score: number) => {
    if (score >= 88) return 'text-emerald-500';
    if (score >= 58) return 'text-amber-500';
    return 'text-neutral-300';
  };

  // 날짜 포맷팅 (Mar 11, 2026 형식)
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  return (
    <tr
      onClick={() => onRowClick(candidate.id)}
      className={cn(
        'group hover:bg-neutral-50/50 transition-colors cursor-pointer',
        isChecked && 'bg-neutral-50/40',
      )}
    >
      <td className="px-5 py-3">
        <input
          type="checkbox"
          className="custom-checkbox cursor-pointer"
          checked={isChecked}
          onChange={(e) => {
            e.stopPropagation();
            onToggleSelect(candidate.id, e as any);
          }}
          onClick={(e) => e.stopPropagation()}
        />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full border border-neutral-200 bg-[#FCFCFC] text-neutral-600 flex items-center justify-center text-xs font-medium">
            {candidate.name.charAt(0)}
          </div>
          <div>
            <p className="text-sm font-semibold text-neutral-900">
              {candidate.name}
            </p>
            <p className="text-xs text-neutral-400">{candidate.email}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <p className="text-sm font-medium text-neutral-700">
          {candidate.job_posts?.title || 'Unknown'}
        </p>
        <p className="text-xs text-neutral-400">Seoul, Korea</p>
      </td>
      {selectedStage === 'all' && (
        <td className="px-4 py-3">
          <span className="px-2.5 py-1 rounded bg-[#FCFCFC] border border-neutral-200/80 text-xs font-medium text-neutral-600">
            {stageName}
          </span>
        </td>
      )}
      <td className="px-4 py-3">
        {matchScore > 0 ? (
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'relative w-6 h-6 flex items-center justify-center',
                getMatchScoreColor(matchScore),
              )}
            >
              <svg
                className="w-full h-full transform -rotate-90"
                viewBox="0 0 36 36"
              >
                <path
                  className="text-neutral-100"
                  strokeWidth="3"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  strokeDasharray={`${matchScore}, 100`}
                  strokeWidth="3"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
            </div>
            <span
              className={cn(
                'text-sm font-semibold',
                matchScore >= 88
                  ? 'text-neutral-900 font-bold'
                  : 'text-neutral-700',
              )}
            >
              {matchScore}
            </span>
          </div>
        ) : (
          <span className="text-sm text-neutral-300 ml-2">-</span>
        )}
      </td>
      <td className="px-4 py-3">
        <p className="text-sm text-neutral-500">
          {formatDate(candidate.created_at)}
        </p>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <StatusIcon className={`w-3.5 h-3.5 ${statusColor}`} />
          <span className="text-xs font-medium text-neutral-700">
            {statusCfg.label}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100">
          {showConfirmHire && (
            <button
              onClick={async (e) => {
                e.stopPropagation();
                if (
                  !confirm(
                    '입사 확정 처리하시겠습니까? 입사 확정된 후보자는 Hired 필터에서 조회할 수 있습니다.',
                  )
                ) {
                  return;
                }
                onConfirmHire(candidate.id);
              }}
              className="p-1.5 text-neutral-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
              title="Confirm Hire"
            >
              <Check className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onArchiveClick({ id: candidate.id, name: candidate.name });
            }}
            className="p-1.5 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-colors"
            title="Archive"
          >
            <Archive className="w-4 h-4" />
          </button>
          {!showConfirmHire && (
            <button
              className="p-1.5 text-neutral-300 hover:text-neutral-900 transition-colors"
              title="More"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
