'use client';

import {
  Check,
  Archive,
  MoreHorizontal,
} from 'lucide-react';
import { getStageNameByStageId } from '@/constants/stages';
import { cn } from '@/components/ui/utils';
import type { Candidate } from '@/types/candidates';
import { CandidatePipeline } from '@/components/candidates/CandidatePipeline';

interface CandidatesTableProps {
  candidates: Candidate[];
  selectedStage: string;
  selectedCandidateId: string | null;
  selectedIds: Set<string>;
  isAllSelected: boolean;
  isSomeSelected: boolean;
  getStageName: (stageId: string | null) => string;
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
            <th className="px-4 py-3 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
              Exp. (경력)
            </th>
            <th className="px-4 py-3 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider min-w-[280px]">
              전형 진행 현황 (Pipeline)
            </th>
            <th className="px-4 py-3 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
              AI Match
            </th>
            <th className="px-4 py-3 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
              Applied
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
  onRowClick,
  onToggleSelect,
  onArchiveClick,
  onConfirmHire,
}: CandidatesTableRowProps) {
  const stageName = getStageName(candidate.current_stage_id);
  const matchScore = candidate.ai_score ?? 0;
  const showConfirmHire =
    getStageNameByStageId(candidate.current_stage_id) === 'Offer';

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
        candidate.status === 'rejected' && 'bg-red-50/20',
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
      <td className="px-4 py-3">
        <p className="text-sm font-semibold text-neutral-600">
          {candidate.experience ||
            candidate.parsed_data?.experience ||
            (parseInt(candidate.id.replace(/[^0-9]/g, '').slice(-1) || '0', 10) % 3 === 0
              ? '신입'
              : parseInt(candidate.id.replace(/[^0-9]/g, '').slice(-1) || '1', 10) % 3 === 1
                ? '3년'
                : '5년')}
        </p>
      </td>
      <td className="px-4 py-3">
        <CandidatePipeline
          currentStageId={candidate.current_stage_id}
          status={candidate.status}
          rejectedStageId={
            // 불합격 발생 단계 데이터가 별도로 있으면 우선 사용 (없으면 currentStageId fallback)
            (candidate as any)?.rejected_stage_id ||
            (candidate as any)?.rejectedStageId ||
            (candidate as any)?.rejected_at_stage_id ||
            null
          }
        />
      </td>
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
