import { cn } from '@/components/ui/utils';
import { Check, CalendarCheck } from 'lucide-react';
import { formatPipelineConfirmedBadge } from '@/utils/schedule-format';

export type CandidatePipelineStepKey =
  | 'new'
  | 'resume'
  | 'competency'
  | 'technical'
  | 'first'
  | 'reference'
  | 'second'
  | 'offer';

type PipelineStep = {
  key: CandidatePipelineStepKey;
  label: string;
  stageId: string;
};

const PIPELINE_STEPS: PipelineStep[] = [
  { key: 'new', label: '신규', stageId: 'stage-1' },
  { key: 'resume', label: '서류', stageId: 'stage-2' },
  { key: 'competency', label: '역량', stageId: 'stage-3' },
  { key: 'technical', label: '기술', stageId: 'stage-4' },
  { key: 'first', label: '1차', stageId: 'stage-5' },
  { key: 'reference', label: '레퍼', stageId: 'stage-6' },
  { key: 'second', label: '2차', stageId: 'stage-7' },
  { key: 'offer', label: '오퍼', stageId: 'stage-8' },
];

function normalizeStageId(stageId: string | null | undefined) {
  if (!stageId) return 'stage-1';
  return stageId;
}

function getStageIndex(stageId: string | null | undefined) {
  const normalized = normalizeStageId(stageId);
  const idx = PIPELINE_STEPS.findIndex((s) => s.stageId === normalized);
  return idx === -1 ? 0 : idx;
}

export interface CandidatePipelineProps {
  /** 후보자의 현재 단계 (필수) */
  currentStageId: string | null;
  /** 후보자의 최종 상태 (rejected면 R을 우선 처리) */
  status?: string | null;
  /**
   * (선택) 불합격이 발생한 단계가 별도로 존재하면 우선 사용
   * - 데이터가 없으면 currentStageId를 fallback으로 사용
   */
  rejectedStageId?: string | null;
  /** 확정된 일정이 있는 경우: 파란 체크 노드/말풍선 표시용 */
  confirmedSchedule?: { stageId: string; scheduledAt: string } | null;
  className?: string;
}

export function CandidatePipeline({
  currentStageId,
  status,
  rejectedStageId,
  confirmedSchedule = null,
  className,
}: CandidatePipelineProps) {
  const isRejected = status === 'rejected';
  const waitingIndex = getStageIndex(currentStageId);
  const rejectedIndex = isRejected
    ? getStageIndex(rejectedStageId ?? currentStageId)
    : -1;

  return (
    <div className={cn('relative flex items-center w-full max-w-[320px] pt-4', className)}>
      <div className="absolute top-1/2 left-0 w-full h-[2px] bg-neutral-100 -translate-y-1/2 z-0 mt-2" />

      <div className="relative z-10 flex justify-between w-full mt-4">
        {PIPELINE_STEPS.map((step, idx) => {
          const isBeforeWaiting = !isRejected && idx < waitingIndex;
          const isWaiting = !isRejected && idx === waitingIndex;
          const isBeforeRejected = isRejected && idx < rejectedIndex;
          const isRejectedStep = isRejected && idx === rejectedIndex;

          const isConfirmedNode =
            !!confirmedSchedule &&
            confirmedSchedule.stageId === step.stageId &&
            !isRejected;

          const badgeClassName = cn(
            'w-5 h-5 rounded-full flex items-center justify-center text-[9px]',
            isConfirmedNode
              ? 'bg-blue-500 text-white font-black shadow-[0_0_0_3px_rgba(59,130,246,0.15)] ring-2 ring-white'
              : isBeforeWaiting || isBeforeRejected
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-600 font-bold'
                : isWaiting
                  ? 'bg-white border-2 border-neutral-900 text-neutral-900 font-black shadow-[0_0_0_3px_rgba(0,0,0,0.05)]'
                  : isRejectedStep
                    ? 'bg-red-50 border border-red-200 text-red-600 font-bold'
                    : 'bg-white border border-neutral-200',
          );

          const labelClassName = cn(
            'text-[8px]',
            isConfirmedNode
              ? 'font-extrabold text-blue-600'
              : isWaiting
                ? 'font-extrabold text-neutral-900'
                : isRejectedStep
                  ? 'font-extrabold text-red-500'
                  : isBeforeWaiting || isBeforeRejected
                    ? 'font-bold text-neutral-400'
                    : 'font-medium text-neutral-300',
          );

          const letter = isRejectedStep ? 'R' : isWaiting ? 'W' : isBeforeWaiting || isBeforeRejected ? 'P' : '';

          return (
            <div key={step.key} className={cn('flex flex-col items-center gap-1', isConfirmedNode && 'relative')}>
              {isConfirmedNode && confirmedSchedule?.scheduledAt ? (
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-neutral-900 text-white text-[10px] font-bold px-2 py-1 rounded shadow-md flex items-center gap-1 whitespace-nowrap">
                  <CalendarCheck className="w-3 h-3 text-emerald-400" />
                  {formatPipelineConfirmedBadge(confirmedSchedule.scheduledAt)}
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-r-[4px] border-t-[4px] border-l-transparent border-r-transparent border-t-neutral-900" />
                </div>
              ) : null}

              <div className={badgeClassName}>
                {isConfirmedNode ? <Check className="w-3 h-3" /> : letter}
              </div>
              <span className={labelClassName}>{step.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
