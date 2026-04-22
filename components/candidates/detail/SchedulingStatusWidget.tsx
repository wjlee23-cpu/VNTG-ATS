'use client';

// VNTG Design System 2.0 - 일정 조율 현황 위젯
// - 첨부 HTML(Active/Empty) 디자인을 1:1로 이식합니다.
// - currentActiveSchedule 유무에 따라 조건부 렌더링합니다.
// - 상단 미니 파이프라인은 공고 stage 목록을 기반으로 동적으로 생성합니다.

import { CalendarClock, CalendarOff, Clock, ExternalLink, RefreshCw, Trash2 } from 'lucide-react';
import {
  formatConfirmedDateLine,
  formatConfirmedTimeRange,
  formatDdayBadge,
} from '@/utils/schedule-format';

type StageLike = {
  id: string;
  name?: string | null;
  order?: number | null;
};

type FixedPipelineStep = {
  stageId: string;
  label: string;
};

// Candidates 화면의 `CandidatePipeline`과 동일한 전체 채용 프로세스 단계(고정 8단계)
const FIXED_PIPELINE_STEPS: FixedPipelineStep[] = [
  { stageId: 'stage-1', label: '신규' },
  { stageId: 'stage-2', label: '서류' },
  { stageId: 'stage-3', label: '역량' },
  { stageId: 'stage-4', label: '기술' },
  { stageId: 'stage-5', label: '1차' },
  { stageId: 'stage-6', label: '레퍼' },
  { stageId: 'stage-7', label: '2차' },
  { stageId: 'stage-8', label: '오퍼' },
];

export type SchedulingWorkflowStatus =
  | 'pending_interviewers'
  | 'pending_candidate'
  | 'regenerating'
  | 'confirmed'
  | 'cancelled'
  | 'needs_rescheduling'
  | null;

export type CurrentActiveScheduleLike = {
  id: string;
  stage_id?: string | null;
  workflow_status: SchedulingWorkflowStatus;
  scheduled_at?: string | null;
  duration_minutes?: number | null;
  interviewers?: Array<{
    id: string;
    email: string;
    name: string | null;
    avatar_url: string | null;
  }> | null;
} | null;

interface SchedulingStatusWidgetProps {
  // 현재 진행 중인 스케줄(없으면 Empty 렌더링)
  currentActiveSchedule: CurrentActiveScheduleLike | undefined;
  // 후보자의 현재 전형(파이프라인의 검은 점 위치)
  currentStageId: string;
  currentStageName: string;
  // (레거시) 공고의 전형 단계 목록: 이제는 고정 파이프라인을 쓰지만, 외부 호출 호환을 위해 유지합니다.
  stages?: StageLike[] | null;
  // 액션 제어
  canManageCandidate: boolean;
  onCheckSchedule?: (scheduleId: string) => void;
  onDeleteSchedule?: (scheduleId: string) => void;
  scheduleActionLoadingId?: string | null;
}

function getActiveStepKey(
  workflowStatus: SchedulingWorkflowStatus,
): 'generate' | 'interviewers' | 'candidate' | 'confirmed' {
  // 사용자가 체감하는 “현재 진행 단계”를 가장 직관적으로 표시합니다.
  if (workflowStatus === 'confirmed') return 'confirmed';
  if (workflowStatus === 'pending_candidate' || workflowStatus === 'needs_rescheduling') return 'candidate';
  if (workflowStatus === 'pending_interviewers' || workflowStatus === 'regenerating') return 'interviewers';
  // cancelled/알 수 없음은 생성 단계로 되돌립니다.
  return 'generate';
}

function getActiveStepCopy(
  workflowStatus: SchedulingWorkflowStatus,
): { title: string; subtitle?: string | null } {
  // HTML의 톤을 유지하되, 실제 데이터가 없는 부분(참석자 이름 등)은 안전한 문구로 대체합니다.
  switch (workflowStatus) {
    case 'regenerating':
      return { title: '면접관 응답 반영 중', subtitle: '응답을 반영해 최적 옵션을 다시 만들고 있어요.' };
    case 'pending_interviewers':
      return { title: '면접관 응답 대기', subtitle: '면접관들의 수락/거절 응답을 기다리고 있어요.' };
    case 'needs_rescheduling':
      return { title: '후보자 선택 대기', subtitle: '전원 수락 옵션이 없어 재조율이 필요해요.' };
    case 'pending_candidate':
      return { title: '후보자 선택 대기', subtitle: '면접관 응답이 완료되어 후보자 선택을 기다리고 있어요.' };
    case 'confirmed':
      return { title: '최종 확정', subtitle: '일정이 확정되었습니다.' };
    case 'cancelled':
      return { title: '조율 중단', subtitle: '일정 조율이 취소되었습니다.' };
    default:
      return { title: '진행 상태 확인 중', subtitle: '상태를 확인하는 중이에요.' };
  }
}

type VerticalStepKey = 'generate' | 'interviewers' | 'candidate' | 'confirmed';

type VerticalStep = {
  key: VerticalStepKey;
  title: string;
  subtitle?: string | null;
};

const VERTICAL_STEPS: VerticalStep[] = [
  { key: 'generate', title: '최적 일정 옵션 생성' },
  { key: 'interviewers', title: '면접관 응답 대기' },
  { key: 'candidate', title: '후보자 선택 대기' },
  { key: 'confirmed', title: '최종 확정' },
];

function getVerticalStepIndex(key: VerticalStepKey) {
  const idx = VERTICAL_STEPS.findIndex((s) => s.key === key);
  return idx === -1 ? 0 : idx;
}

function MiniPipeline({
  currentStageId,
}: {
  currentStageId: string;
}) {
  // ✅ 공통 영역: Candidates의 Pipeline과 동일한 전체 단계를 고정으로 렌더링합니다.
  const list = FIXED_PIPELINE_STEPS;
  const currentIndex = list.findIndex((s) => s.stageId === currentStageId);
  const safeCurrentIndex = currentIndex >= 0 ? currentIndex : 0;

  return (
    <div className="flex items-center w-full mb-3 px-1">
      {list.map((step, idx) => {
        const isCurrent = idx === safeCurrentIndex;
        const isDone = idx < safeCurrentIndex;

        return (
          <span key={step.stageId} className="contents">
            <span
              className={[
                isCurrent
                  ? 'w-2.5 h-2.5 rounded-full bg-neutral-900 ring-2 ring-neutral-900/20 relative z-10 shadow-sm'
                  : isDone
                    ? 'w-1.5 h-1.5 rounded-full bg-emerald-500'
                    : 'w-1.5 h-1.5 rounded-full bg-neutral-200',
              ].join(' ')}
              aria-hidden="true"
              // ✅ UX: 각 단계에 마우스를 올리면 단계명이 보이게 합니다.
              title={step.label}
            />
            {idx < list.length - 1 && (
              <span
                className={[
                  'flex-1 h-[2px]',
                  isDone ? 'bg-emerald-100' : 'bg-neutral-100',
                ].join(' ')}
                aria-hidden="true"
              />
            )}
          </span>
        );
      })}
    </div>
  );
}

export function SchedulingStatusWidget({
  currentActiveSchedule,
  currentStageId,
  currentStageName,
  stages,
  canManageCandidate,
  onCheckSchedule,
  onDeleteSchedule,
  scheduleActionLoadingId = null,
}: SchedulingStatusWidgetProps) {
  const hasSchedule = !!currentActiveSchedule;
  const scheduleId = currentActiveSchedule?.id ?? null;
  const workflowStatus = currentActiveSchedule?.workflow_status ?? null;

  // 버튼 로딩/비활성화 정책
  const isActionLoading = !!(scheduleId && scheduleActionLoadingId && scheduleActionLoadingId === scheduleId);
  const canRefresh = canManageCandidate && hasSchedule && !!onCheckSchedule && !isActionLoading;
  const canDelete = canManageCandidate && hasSchedule && !!onDeleteSchedule && !isActionLoading;

  const activeStep = getActiveStepKey(workflowStatus);
  const activeCopy = getActiveStepCopy(workflowStatus);
  const activeStepIndex = getVerticalStepIndex(activeStep);

  const confirmedScheduledAt = currentActiveSchedule?.scheduled_at ?? null;
  const confirmedDurationMinutes = currentActiveSchedule?.duration_minutes ?? null;
  const confirmedInterviewers = currentActiveSchedule?.interviewers ?? null;

  const confirmedDateLine =
    workflowStatus === 'confirmed' && confirmedScheduledAt
      ? formatConfirmedDateLine(confirmedScheduledAt)
      : null;
  const confirmedTimeRange =
    workflowStatus === 'confirmed' && confirmedScheduledAt
      ? formatConfirmedTimeRange(confirmedScheduledAt, confirmedDurationMinutes)
      : null;
  const confirmedDday =
    workflowStatus === 'confirmed' && confirmedScheduledAt ? formatDdayBadge(confirmedScheduledAt) : null;

  return (
    <div className="pt-5 border-t border-neutral-200/60 flex-1 flex flex-col mt-6">
      <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider mb-4 flex items-center gap-1.5">
        <CalendarClock className="w-3.5 h-3.5 text-neutral-500" />
        일정 조율 현황
      </h3>

      <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm flex-1 flex flex-col relative overflow-hidden group">
        {/* 공통: 미니 파이프라인 + 현재 전형 */}
        <div className="mb-4">
          <MiniPipeline currentStageId={currentStageId} />
          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-0.5">
            현재 전형 단계
          </p>
          <p className="text-sm font-extrabold text-neutral-900">{currentStageName}</p>
        </div>

        <hr className={hasSchedule ? 'border-neutral-100 mb-4' : 'border-neutral-100 mb-6'} />

        {/* 조건부 렌더링: 스케줄 없으면 Empty */}
        {!hasSchedule ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-2 pb-4">
            <div className="w-12 h-12 bg-neutral-50 border border-neutral-100 rounded-full flex items-center justify-center mb-4">
              <CalendarOff className="w-5 h-5 text-neutral-300" />
            </div>
            <p className="text-sm font-bold text-neutral-900 mb-1.5">등록된 일정이 없습니다</p>
            <p className="text-xs text-neutral-500 leading-relaxed">
              상단의 <strong className="text-neutral-700">"일정 등록"</strong> 버튼을 눌러
              <br />
              새로운 면접 조율을 시작할 수 있습니다.
            </p>
          </div>
        ) : workflowStatus === 'confirmed' ? (
          <>
            {/* ✅ Confirmed: 세로 스텝퍼 대신 “확정 티켓 UI” 렌더링 */}
            <div className="relative bg-neutral-900 rounded-xl p-4 text-white shadow-[0_8px_16px_rgba(0,0,0,0.15)] overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-blue-500/30 to-transparent rounded-bl-full" />

              <div className="flex justify-between items-start mb-3 relative z-10">
                <span className="px-2 py-0.5 bg-white/10 border border-white/10 rounded text-[10px] font-bold uppercase tracking-widest text-neutral-300">
                  최종 확정
                </span>
                {confirmedDday ? (
                  <span className="px-2 py-0.5 bg-emerald-500 text-white rounded text-[10px] font-extrabold shadow-sm animate-pulse">
                    {confirmedDday}
                  </span>
                ) : null}
              </div>

              <div className="relative z-10 mt-1">
                <p className="text-xl font-extrabold tracking-tight mb-0.5">
                  {confirmedDateLine || '일정 확정'}
                </p>
                <p className="text-sm font-medium text-neutral-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  {confirmedTimeRange || '시간 정보 없음'}
                </p>
              </div>

              <div className="relative z-10 mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex -space-x-2">
                    {(Array.isArray(confirmedInterviewers) ? confirmedInterviewers : [])
                      .slice(0, 6)
                      .map((inv) => {
                        const displayName = (inv?.name || inv?.email || '').trim() || '면접관';
                        const initial = displayName.charAt(0);
                        const avatarUrl = inv?.avatar_url || '';
                        return (
                          <div
                            key={inv.id}
                            className="relative group/avatar cursor-pointer"
                          >
                            {avatarUrl ? (
                              <img
                                src={avatarUrl}
                                alt={displayName}
                                className="w-6 h-6 rounded-full border-2 border-neutral-900 shadow-sm relative z-10 group-hover/avatar:z-20 transition-transform group-hover/avatar:scale-110 object-cover"
                              />
                            ) : (
                              <div className="w-6 h-6 rounded-full border-2 border-neutral-900 shadow-sm relative z-10 bg-white/10 text-white flex items-center justify-center text-[11px] font-extrabold group-hover/avatar:z-20 transition-transform group-hover/avatar:scale-110">
                                {initial || 'I'}
                              </div>
                            )}

                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-white text-neutral-900 text-[10px] font-bold rounded shadow-lg opacity-0 invisible group-hover/avatar:opacity-100 group-hover/avatar:visible transition-all whitespace-nowrap z-30">
                              {displayName}
                              <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-r-[4px] border-t-[4px] border-l-transparent border-r-transparent border-t-white" />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest">
                  Interviewers
                </span>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <button
                className="w-full flex items-center justify-center gap-2 bg-neutral-50 border border-neutral-200 text-neutral-700 rounded-lg py-2 px-3 text-xs font-semibold hover:bg-neutral-100 hover:text-neutral-900 transition-colors shadow-sm active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => scheduleId && onCheckSchedule?.(scheduleId)}
                disabled={!canRefresh}
                title={canRefresh ? '진행 상태를 최신으로 맞춥니다.' : '진행 상태를 새로고칠 수 없습니다.'}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                캘린더 상세 보기
              </button>

              <button
                className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-medium text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => {
                  if (!scheduleId || !onDeleteSchedule) return;
                  if (!confirm('이 일정을 취소할까요? 되돌릴 수 없습니다.')) return;
                  if (!confirm('정말 취소할까요? 캘린더 일정도 함께 정리될 수 있어요.')) return;
                  onDeleteSchedule(scheduleId);
                }}
                disabled={!canDelete}
                title={canDelete ? '일정을 취소합니다.' : '취소할 수 없습니다.'}
              >
                <CalendarOff className="w-3 h-3" />
                일정 취소
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Active: 조율 스텝 (단일 단계 배열 기반 렌더링 - 중복/순서 혼선 방지) */}
            <div className="relative border-l-2 border-neutral-100 ml-2 space-y-4 flex-1">
              {VERTICAL_STEPS.map((step, idx) => {
                const isDone = idx < activeStepIndex;
                const isActive = idx === activeStepIndex;

                const title = isActive ? activeCopy.title : step.title;
                const subtitle = isActive ? activeCopy.subtitle : step.subtitle;

                return (
                  <div key={step.key} className="relative pl-5">
                    <div className="absolute -left-[7px] top-0.5 flex items-center justify-center">
                      {isActive ? (
                        <>
                          {/* 현재 단계에만 맥박 효과를 줍니다. */}
                          {activeStep !== 'generate' && (
                            <span className="absolute inline-flex h-3 w-3 rounded-full bg-blue-400 opacity-75 animate-ping" />
                          )}
                          <span className="relative inline-flex rounded-full h-[12px] w-[12px] bg-blue-500 border-2 border-white shadow-sm" />
                        </>
                      ) : isDone ? (
                        <span className="w-[12px] h-[12px] rounded-full bg-white border-[3px] border-neutral-900" />
                      ) : (
                        <span className="w-[8px] h-[8px] rounded-full bg-neutral-200 ring-2 ring-white" />
                      )}
                    </div>

                    <p
                      className={[
                        'text-xs leading-none',
                        isActive
                          ? 'font-bold text-blue-600'
                          : isDone
                            ? 'font-bold text-neutral-900'
                            : 'font-medium text-neutral-400',
                      ].join(' ')}
                    >
                      {title}
                    </p>
                    {subtitle ? (
                      <p className="text-[10px] font-semibold text-neutral-400 mt-1.5">{subtitle}</p>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {/* Active: 액션 버튼 */}
            <div className="mt-5 space-y-2">
              <button
                className="w-full flex items-center justify-center gap-2 bg-neutral-50 border border-neutral-200 text-neutral-700 rounded-lg py-2 px-3 text-xs font-semibold hover:bg-neutral-100 hover:text-neutral-900 transition-colors shadow-sm active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => scheduleId && onCheckSchedule?.(scheduleId)}
                disabled={!canRefresh}
                title={canRefresh ? '진행 상태를 최신으로 맞춥니다.' : '진행 상태를 새로고칠 수 없습니다.'}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                진행 상태 새로고침
              </button>

              <button
                className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-medium text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => {
                  if (!scheduleId || !onDeleteSchedule) return;
                  // 안전: 되돌릴 수 없는 삭제이므로 2단계 확인을 유지합니다.
                  if (!confirm('이 조율을 중단하고 삭제할까요? 되돌릴 수 없습니다.')) return;
                  if (!confirm('정말 삭제할까요? 관련 옵션/캘린더 일정도 함께 정리될 수 있어요.')) return;
                  onDeleteSchedule(scheduleId);
                }}
                disabled={!canDelete}
                title={canDelete ? '조율을 중단하고 삭제합니다.' : '삭제할 수 없습니다.'}
              >
                <Trash2 className="w-3 h-3" />
                조율 중단 및 삭제
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

