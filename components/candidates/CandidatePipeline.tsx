import { cn } from '@/components/ui/utils';

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
  className?: string;
}

export function CandidatePipeline({
  currentStageId,
  status,
  rejectedStageId,
  className,
}: CandidatePipelineProps) {
  const isRejected = status === 'rejected';
  const waitingIndex = getStageIndex(currentStageId);
  const rejectedIndex = isRejected
    ? getStageIndex(rejectedStageId ?? currentStageId)
    : -1;

  return (
    <div className={cn('relative flex items-center w-full max-w-[320px]', className)}>
      <div className="absolute top-1/2 left-0 w-full h-[2px] bg-neutral-100 -translate-y-1/2 z-0" />

      <div className="relative z-10 flex justify-between w-full">
        {PIPELINE_STEPS.map((step, idx) => {
          const isBeforeWaiting = !isRejected && idx < waitingIndex;
          const isWaiting = !isRejected && idx === waitingIndex;
          const isBeforeRejected = isRejected && idx < rejectedIndex;
          const isRejectedStep = isRejected && idx === rejectedIndex;

          const badgeClassName = cn(
            'w-5 h-5 rounded-full flex items-center justify-center text-[9px]',
            isBeforeWaiting || isBeforeRejected
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-600 font-bold'
              : isWaiting
                ? 'bg-white border-2 border-neutral-900 text-neutral-900 font-black shadow-[0_0_0_3px_rgba(0,0,0,0.05)]'
                : isRejectedStep
                  ? 'bg-red-50 border border-red-200 text-red-600 font-bold'
                  : 'bg-white border border-neutral-200',
          );

          const labelClassName = cn(
            'text-[8px]',
            isWaiting
              ? 'font-extrabold text-neutral-900'
              : isRejectedStep
                ? 'font-extrabold text-red-500'
                : isBeforeWaiting || isBeforeRejected
                  ? 'font-bold text-neutral-400'
                  : 'font-medium text-neutral-300',
          );

          const letter = isRejectedStep ? 'R' : isWaiting ? 'W' : isBeforeWaiting || isBeforeRejected ? 'P' : '';

          return (
            <div key={step.key} className="flex flex-col items-center gap-1">
              <div className={badgeClassName}>{letter}</div>
              <span className={labelClassName}>{step.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
