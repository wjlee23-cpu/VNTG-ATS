'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import type { Candidate } from '@/types/candidates';
import type { ResumeFile, TimelineEvent } from '@/types/candidate-detail';
import { getStageEvaluations } from '@/api/queries/evaluations';
import { getResumeFilesByCandidate } from '@/api/queries/resume-files';
import { getCandidateById } from '@/api/queries/candidates';
import { getTimelineEvents } from '@/api/queries/timeline';
import { STAGE_ID_TO_NAME_MAP } from '@/constants/stages';
import { getUserProfile } from '@/api/queries/auth';
import { moveToStage, getAvailableStagesAction } from '@/api/actions/evaluations';
import { confirmHire } from '@/api/actions/offers';
import { syncCandidateEmails } from '@/api/actions/emails';
import { updateCandidate, triggerAIAnalysis } from '@/api/actions/candidates';
import { uploadResumeFile, deleteResumeFile } from '@/api/actions/resume-files';
import { scheduleInterviewAutomated, deleteSchedule, checkInterviewerResponses } from '@/api/actions/schedules';
import { getExternalInterviewers, getUsers } from '@/api/queries/users';
import { getSchedulesByCandidate } from '@/api/queries/schedules';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { EmailModal } from '@/components/candidates/EmailModal';
import { ArchiveCandidateModal } from '@/components/candidates/ArchiveCandidateModal';
import { StageEvaluationModal } from '@/components/candidates/StageEvaluationModal';
import { CommentModal } from '@/components/candidates/CommentModal';
import { CandidateDetailLayout } from '@/components/candidates/detail/CandidateDetailLayout';
import { CandidateProfileEditDialog } from '@/components/candidates/detail/CandidateProfileEditDialog';
import { CandidateScheduleForm } from '@/components/candidates/detail/CandidateScheduleForm';
import { cn } from '@/components/ui/utils';

interface CandidateDetailClientProps {
  candidate: Candidate;
  schedules: unknown[];
  timelineEvents: TimelineEvent[];
  onClose?: () => void;
  isSidebar?: boolean;
}

export function CandidateDetailClient({
  candidate: initialCandidate,
  schedules: _schedules,
  timelineEvents,
  onClose,
  isSidebar = false,
}: CandidateDetailClientProps) {
  type DetailTab = 'profile' | 'insight' | 'timeline';
  const router = useRouter();
  const [candidate, setCandidate] = useState<Candidate>(initialCandidate);
  const [viewMode, setViewMode] = useState<'detail' | 'scheduling'>('detail');
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [isEvaluationModalOpen, setIsEvaluationModalOpen] = useState(false);
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  const [evaluations, setEvaluations] = useState<unknown[]>([]);
  const [resumeFiles, setResumeFiles] = useState<ResumeFile[]>([]);
  const [timelineEventsState, setTimelineEventsState] = useState<TimelineEvent[]>(timelineEvents);
  // 타임라인 탭 지연 로딩을 위한 상태
  const [hasLoadedTimeline, setHasLoadedTimeline] = useState<boolean>(timelineEvents.length > 0);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<'admin' | 'recruiter' | 'interviewer' | 'hiring_manager'>('recruiter');
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoadingEvaluations, setIsLoadingEvaluations] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [users, setUsers] = useState<
    Array<{ id: string; email: string; role: string; name: string | null; avatar_url: string | null }>
  >([]);
  const [externalInterviewerPool, setExternalInterviewerPool] = useState<
    Array<{ id: string; email: string; display_name: string | null }>
  >([]);
  const initialScheduleStageId =
    initialCandidate.current_stage_id && initialCandidate.current_stage_id.trim() !== ''
      ? initialCandidate.current_stage_id
      : 'stage-1';
  const [scheduleFormData, setScheduleFormData] = useState({
    dateRange: { from: undefined, to: undefined } as { from: Date | undefined; to: Date | undefined },
    duration_minutes: '60',
    stage_id: initialScheduleStageId,
    interviewer_ids: [] as string[],
    external_interviewer_emails: [] as string[],
    num_options: '2',
    work_start_hour: '10',
    work_start_minute: '00',
    work_end_hour: '17',
    work_end_minute: '00',
    exclude_start_hour: '11',
    exclude_start_minute: '30',
    exclude_end_hour: '12',
    exclude_end_minute: '30',
  });
  const [scheduleWarning, setScheduleWarning] = useState<string | null>(null);
  const currentStageId =
    candidate.current_stage_id && candidate.current_stage_id.trim() !== ''
      ? candidate.current_stage_id
      : 'stage-1';
  const [availableStages, setAvailableStages] = useState<
    Array<{ id: string; name: string; order: number; isCurrent: boolean }>
  >([]);
  const [isLoadingStages, setIsLoadingStages] = useState(false);
  const [expandedEmails, setExpandedEmails] = useState<Set<string>>(new Set());
  const [isSyncingEmails, setIsSyncingEmails] = useState(false);
  /** null: 닫힘 | basic: 이메일·연락처 | compensation: 연봉 */
  const [profileEditMode, setProfileEditMode] = useState<null | 'basic' | 'compensation'>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [editFormData, setEditFormData] = useState({
    email: initialCandidate.email,
    phone: initialCandidate.phone || '',
    current_salary: initialCandidate.current_salary || '',
    expected_salary: initialCandidate.expected_salary || '',
  });
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [isMovingStage, setIsMovingStage] = useState(false);
  const [scheduleActionLoadingId, setScheduleActionLoadingId] = useState<string | null>(null);
  // 스케줄 목록을 로컬 상태로 승격하여 삭제/확정 등 액션 직후에도 UI가 즉시 반영되게 합니다.
  const [schedulesState, setSchedulesState] = useState<Array<any>>(
    Array.isArray(_schedules) ? (_schedules as any[]) : [],
  );
  const schedulesFetchGenRef = useRef(0);
  const aiTriggerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aiTriggerStartedRef = useRef<boolean>(false);

  const fetchSchedulesAndApplyIfGenerationCurrent = async (
    generation: number,
    candidateId: string,
  ) => {
    try {
      const refreshed = await getSchedulesByCandidate(candidateId);
      const nextList = (refreshed as unknown as { data?: any[]; error?: string }).data ?? [];
      if (generation !== schedulesFetchGenRef.current) return;
      setSchedulesState(Array.isArray(nextList) ? nextList : []);
    } catch {
      /* stale or network: 무시 */
    }
  };

  /** 삭제·동기화 등 사용자 액션 직후: 세대 검사 없이 서버 목록을 그대로 반영합니다. */
  const applySchedulesFromServer = async (candidateId: string) => {
    try {
      const refreshed = await getSchedulesByCandidate(candidateId);
      const nextList = (refreshed as unknown as { data?: any[]; error?: string }).data ?? [];
      setSchedulesState(Array.isArray(nextList) ? nextList : []);
    } catch {
      /* network: 무시 */
    }
  };

  // 사이드바 코파일럿이 사용할 "가장 최근 스케줄" 계산
  // - 확정된 일정도 코파일럿에 반드시 반영되어야 합니다.
  const currentActiveSchedule = (() => {
    const list = (Array.isArray(schedulesState) ? schedulesState : []) as any[];
    // ✅ 코파일럿은 "AI 일정 조율 자동화"의 진행 상태만 표시합니다.
    // - 수동으로 만든 일정(또는 레거시 데이터)은 workflow_status가 비어있을 수 있는데,
    //   이를 코파일럿이 잡으면 기본값으로 '면접관 진행중'처럼 보여 혼동이 생깁니다.
    // - 따라서 workflow_status가 존재하는 스케줄만 코파일럿 상태 계산에 포함합니다.
    const valid = list.filter((s: any) => s && s.id && s.workflow_status);

    // ✅ “면접이 끝났다” 판단(정책: 시간 경과 OR 다음 단계로 이동 시 끝남 처리)
    // - confirmed 이면서 면접 시각(scheduled_at)이 현재보다 과거면: 더 이상 사이드바에 표시하지 않음(초기화)
    // - confirmed 이면서 스케줄의 stage_id가 현재 후보 단계보다 과거 단계면: 다음 단계로 넘어간 것으로 보고 숨김
    const stageOrder = (stageId: string | null | undefined) => {
      const raw = typeof stageId === 'string' ? stageId.trim() : '';
      // stage-5 같은 패턴에서 숫자만 뽑아 비교합니다. (패턴이 깨지면 0으로 처리)
      const m = raw.match(/^stage-(\d+)$/);
      if (!m) return 0;
      const n = Number(m[1]);
      return Number.isFinite(n) ? n : 0;
    };

    const now = Date.now();
    const currentStageOrder = stageOrder(currentStageId);

    const isFinishedConfirmed = (s: any) => {
      if (s?.workflow_status !== 'confirmed') return false;

      const scheduledAtRaw = s?.scheduled_at;
      const scheduledAt = scheduledAtRaw ? new Date(scheduledAtRaw).getTime() : NaN;
      const isPastByTime = Number.isFinite(scheduledAt) ? scheduledAt < now : false;

      const scheduleStageOrder = stageOrder(s?.stage_id ?? null);
      const isPastByStage = scheduleStageOrder > 0 && scheduleStageOrder < currentStageOrder;

      return isPastByTime || isPastByStage;
    };

    const filtered = valid.filter((s: any) => !isFinishedConfirmed(s));

    // ✅ 우선순위: 실제 UI에서 "지금 상태"로 보고 싶은 스케줄을 먼저 고릅니다.
    // - 예: confirmed가 존재하는데도 created_at 정렬 때문에 pending을 잡으면 코파일럿이 "대기"로 보여 혼동됩니다.
    const priority = (status: string | null | undefined) => {
      switch (status) {
        case 'pending_candidate':
          return 4;
        case 'pending_interviewers':
          return 3;
        case 'needs_rescheduling':
          return 2;
        case 'regenerating':
          return 1;
        case 'confirmed':
          // ✅ confirmed는 “끝난 면접(시간 경과/단계 이동)”을 위에서 제외했기 때문에,
          //    여기서는 진행 중/최근 확정만 남습니다. 우선순위는 낮추지 않고 그대로 둡니다.
          return 5;
        case 'cancelled':
          return 0;
        default:
          return 0;
      }
    };

    // ✅ 선택 정책: “현재 단계(stage_id === currentStageId)” 스케줄이 있으면 우선, 없으면 최근 스케줄
    const byStage = (arr: any[], stageId: string) =>
      arr.filter((s: any) => String(s?.stage_id ?? '') === String(stageId));

    const pickBest = (arr: any[]) => {
      const sorted = [...arr].sort((a: any, b: any) => {
        const prA = priority(a.workflow_status);
        const prB = priority(b.workflow_status);
        if (prA !== prB) return prB - prA;

        const atA = new Date(a.updated_at || a.created_at || a.scheduled_at || 0).getTime();
        const atB = new Date(b.updated_at || b.created_at || b.scheduled_at || 0).getTime();
        return atB - atA;
      });
      return sorted[0] as any;
    };

    const stageMatched = byStage(filtered, currentStageId);
    const pick: any = stageMatched.length > 0 ? pickBest(stageMatched) : pickBest(filtered);

    return pick
      ? {
          id: String(pick.id),
          stage_id: (pick.stage_id ?? null) as string | null,
          workflow_status: (pick.workflow_status ||
            null) as
            | 'pending_interviewers'
            | 'pending_candidate'
            | 'regenerating'
            | 'confirmed'
            | 'cancelled'
            | 'needs_rescheduling'
            | null,
        }
      : null;
  })();

  const [detailInitialTab, setDetailInitialTab] = useState<DetailTab>(() => {
    if (typeof window === 'undefined') return 'profile';
    const saved = window.sessionStorage.getItem(
      `candidate-detail-active-tab:${initialCandidate.id}`,
    ) as DetailTab | null;
    if (saved === 'profile' || saved === 'insight' || saved === 'timeline') return saved;
    return 'profile';
  });

  const getDetailTabStorageKey = () => `candidate-detail-active-tab:${candidate.id}`;

  // 서버에서 내려준 schedules가 갱신되면(router.refresh 등) 로컬 목록 시그니처를 맞춥니다.
  const schedulesPropKey = useMemo(() => {
    if (!Array.isArray(_schedules)) return '';
    return (_schedules as any[])
      .map((s) => `${String(s?.id ?? '')}:${String(s?.workflow_status ?? '')}`)
      .sort()
      .join('|');
  }, [_schedules]);

  const refreshCandidateData = async () => {
    try {
      const result = await getCandidateById(candidate.id);
      if (result.data) setCandidate(result.data);
    } catch (error) {
      console.error('[CandidateDetailClient] 후보자 데이터 업데이트 실패:', error);
    }
  };

  const refreshTimelineEvents = async () => {
    try {
      setIsLoadingTimeline(true);
      // ✅ 타임라인 탭에서는 발신/수신 메일의 "본문"이 보여야 하므로 이메일 병합을 포함해 조회합니다.
      // - includeEmails=false면 제목만 보이고 본문(body)이 비어 보일 수 있습니다.
      const result = await getTimelineEvents(candidate.id, 50, { includeEmails: true });
      if (result.data) setTimelineEventsState(result.data);
      setHasLoadedTimeline(true);
    } catch (error) {
      console.error('[CandidateDetailClient] 타임라인 이벤트 업데이트 실패:', error);
    } finally {
      setIsLoadingTimeline(false);
    }
  };

  useEffect(() => {
    if (candidate.id) {
      loadEvaluations();
      loadUserRole();
      loadResumeFiles();
    }
  }, [candidate.id]);

  // 첨부가 모두 없어지면 AI 자동 트리거 ref를 초기화해, 재업로드 시 4초 폴백이 다시 동작하게 합니다.
  useEffect(() => {
    if (resumeFiles.length === 0) {
      aiTriggerStartedRef.current = false;
    }
  }, [resumeFiles.length]);

  // 페이지 진입 시 스케줄 목록을 한 번 더 받아 코파일럿이 서버와 어긋나지 않게 합니다.
  useEffect(() => {
    if (!candidate.id) return;
    schedulesFetchGenRef.current += 1;
    const generation = schedulesFetchGenRef.current;
    if (Array.isArray(_schedules)) {
      setSchedulesState([...(_schedules as any[])]);
    }
    void fetchSchedulesAndApplyIfGenerationCurrent(generation, candidate.id);
    return () => {
      schedulesFetchGenRef.current += 1;
    };
  }, [candidate.id, schedulesPropKey]);

  useEffect(() => {
    if (typeof window === 'undefined' || !candidate.id) return;
    window.sessionStorage.setItem(getDetailTabStorageKey(), detailInitialTab);
  }, [candidate.id, detailInitialTab]);

  // ✅ Activity Timeline 탭에 진입했을 때만 타임라인을 로드합니다.
  useEffect(() => {
    if (!candidate.id) return;
    if (detailInitialTab !== 'timeline') return;
    if (hasLoadedTimeline) return;
    // 첫 진입에만 자동 로드
    refreshTimelineEvents().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailInitialTab, candidate.id, hasLoadedTimeline]);

  useEffect(() => {
    if (viewMode === 'scheduling') loadUsers();
  }, [viewMode]);

  useEffect(() => {
    const shouldTrigger =
      resumeFiles.length > 0 &&
      (candidate.ai_analysis_status === null || candidate.ai_analysis_status === 'pending') &&
      candidate.job_post_id;
    // ✅ 체감 속도 개선: 상세 화면을 여는 순간 AI 분석을 바로 시작하지 않고,
    //    백그라운드로 몇 초 지연하여 “모달 오픈/콘텐츠 표시”를 우선합니다.
    if (!shouldTrigger) return;
    if (aiTriggerStartedRef.current) return;

    // 기존 타이머가 있으면 정리
    if (aiTriggerTimeoutRef.current) {
      clearTimeout(aiTriggerTimeoutRef.current);
      aiTriggerTimeoutRef.current = null;
    }

    aiTriggerTimeoutRef.current = setTimeout(() => {
      aiTriggerStartedRef.current = true;
      triggerAIAnalysis(candidate.id)
        .then(() => refreshCandidateData())
        .catch((err) => console.error('[CandidateDetailClient] AI 분석 시작 실패:', err));
    }, 4000);

    return () => {
      if (aiTriggerTimeoutRef.current) {
        clearTimeout(aiTriggerTimeoutRef.current);
        aiTriggerTimeoutRef.current = null;
      }
    };
  }, [resumeFiles.length, candidate.ai_analysis_status, candidate.job_post_id, candidate.id]);

  useEffect(() => {
    if (profileEditMode !== null) return;
    setEditFormData({
      email: candidate.email,
      phone: candidate.phone || '',
      current_salary: candidate.current_salary || '',
      expected_salary: candidate.expected_salary || '',
    });
  }, [
    candidate.email,
    candidate.phone,
    candidate.current_salary,
    candidate.expected_salary,
    profileEditMode,
  ]);

  useEffect(() => {
    if (candidate.ai_analysis_status !== 'processing') return;
    const intervalId = setInterval(async () => {
      try {
        const result = await getCandidateById(candidate.id);
        const data = result.data as Candidate | undefined;
        if (data) {
          setCandidate(data);
          if (data.ai_analysis_status === 'completed' || data.ai_analysis_status === 'failed')
            clearInterval(intervalId);
        }
      } catch {
        /* keep polling */
      }
    }, 3000);
    return () => clearInterval(intervalId);
  }, [candidate.ai_analysis_status, candidate.id]);

  const loadEvaluations = async () => {
    setIsLoadingEvaluations(true);
    try {
      const result = await getStageEvaluations(candidate.id);
      if (result.error) setEvaluations([]);
      else setEvaluations(result.data || []);
    } catch {
      setEvaluations([]);
    } finally {
      setIsLoadingEvaluations(false);
    }
  };

  const loadResumeFiles = async () => {
    setIsLoadingFiles(true);
    try {
      const result = await getResumeFilesByCandidate(candidate.id);
      if (!result.error) setResumeFiles(result.data || []);
    } catch {
      /* keep previous */
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const loadUserRole = async () => {
    try {
      const profile = await getUserProfile();
      if (profile.data) {
        setUserRole(profile.data.role as 'admin' | 'recruiter' | 'interviewer' | 'hiring_manager');
        setUserId(profile.data.id);
      }
    } catch {
      setUserRole('recruiter');
    }
  };

  const loadUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const [usersResult, externalResult] = await Promise.all([getUsers(), getExternalInterviewers()]);
      const list = (usersResult.data || []) as Array<{
        id: string;
        email: string;
        role: string;
        name: string | null;
        avatar_url: string | null;
      }>;
      const externalList = (externalResult.data || []) as Array<{
        id: string;
        email: string;
        display_name: string | null;
      }>;

      // ✅ 내부 면접관 목록(관리자/면접관)만 유지
      const internalInterviewers = list.filter((u) => u.role === 'interviewer' || u.role === 'admin');

      // ✅ 안전장치: 내부 사용자 이메일과 겹치는 외부 면접관은 UI에서 제거합니다.
      // (서버에서 삭제/필터링을 하지만, 캐시/동기화 타이밍으로 혹시 남아있을 수 있어 2중 방어)
      const normalizeEmail = (email: string) => email.trim().toLowerCase();
      const internalEmailSet = new Set(internalInterviewers.map((u) => normalizeEmail(u.email)));
      const filteredExternal = externalList.filter((e) => !internalEmailSet.has(normalizeEmail(e.email)));

      setUsers(internalInterviewers);
      setExternalInterviewerPool(filteredExternal);

      // ✅ 이미 선택된 외부 이메일이 내부 사용자로 가입된 경우:
      // - 외부 이메일 선택을 제거하고
      // - 내부 면접관(id) 선택으로 자동 변환합니다.
      setScheduleFormData((prev) => {
        const nextExternal = (prev.external_interviewer_emails || []).map(normalizeEmail);
        if (nextExternal.length === 0) return prev;

        const emailToUserId = new Map(internalInterviewers.map((u) => [normalizeEmail(u.email), u.id]));
        const toPromote = nextExternal
          .map((email) => emailToUserId.get(email))
          .filter((id): id is string => typeof id === 'string' && id.length > 0);

        const nextInterviewerIds = Array.from(
          new Set([...(prev.interviewer_ids || []), ...toPromote]),
        );

        const remainingExternal = nextExternal.filter((email) => !emailToUserId.has(email));

        // 변화가 없다면 state 업데이트를 피합니다.
        const sameInterviewer =
          nextInterviewerIds.length === (prev.interviewer_ids || []).length &&
          nextInterviewerIds.every((id, idx) => id === (prev.interviewer_ids || [])[idx]);
        const sameExternal =
          remainingExternal.length === (prev.external_interviewer_emails || []).length &&
          remainingExternal.every((email, idx) => email === (prev.external_interviewer_emails || [])[idx]);
        if (sameInterviewer && sameExternal) return prev;

        return {
          ...prev,
          interviewer_ids: nextInterviewerIds,
          external_interviewer_emails: remainingExternal,
        };
      });
    } catch {
      toast.error('면접관 목록을 불러올 수 없습니다.');
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const loadAvailableStages = async () => {
    // ✅ job_posts는 쿼리 레이어에서 단일 객체로 정규화됩니다.
    const jobPost = candidate.job_posts;
    if (!jobPost?.id) {
      toast.error('채용 공고 정보를 찾을 수 없습니다.');
      return;
    }
    if (!currentStageId?.trim()) {
      toast.error('현재 전형 정보를 찾을 수 없습니다.');
      return;
    }
    setIsLoadingStages(true);
    try {
      const result = await getAvailableStagesAction(jobPost.id, currentStageId);
      if (result.error) {
        toast.error(result.error || '단계 목록을 불러오는데 실패했습니다.');
      } else {
        setAvailableStages(result.data || []);
      }
    } catch {
      toast.error('단계 목록을 불러오는데 실패했습니다.');
    } finally {
      setIsLoadingStages(false);
    }
  };

  const handleClose = () => {
    if (onClose) onClose();
    else router.back();
  };

  const handleMoveToStage = async (targetStageId: string) => {
    // ✅ job_posts는 쿼리 레이어에서 단일 객체로 정규화됩니다.
    const jobPost = candidate.job_posts;
    if (!currentStageId?.trim() || !jobPost?.id) {
      toast.error('전형 정보를 찾을 수 없습니다.');
      return;
    }
    if (currentStageId === targetStageId) {
      toast.error('이미 해당 단계에 있습니다.');
      return;
    }
    const targetStage = availableStages.find((s) => s.id === targetStageId);
    if (!targetStage) {
      toast.error('이동할 수 없는 단계입니다.');
      return;
    }
    if (!confirm(`${targetStage.name}로 이동하시겠습니까?`)) return;
    setIsMovingStage(true);
    try {
      const result = await moveToStage(candidate.id, targetStageId);
      if (result.error) toast.error(result.error);
      else {
        toast.success(`${targetStage.name}로 이동했습니다.`);
        refreshCandidateData().catch(() => {});
        refreshTimelineEvents().catch(() => {});
      }
    } catch {
      toast.error('전형 이동 중 오류가 발생했습니다.');
    } finally {
      setIsMovingStage(false);
    }
  };

  const handleConfirmHire = async () => {
    if (!confirm('입사 확정 처리하시겠습니까? 입사 확정된 후보자는 입사확정 필터에서 조회할 수 있습니다.'))
      return;
    try {
      const result = await confirmHire(candidate.id);
      if (result.error) toast.error(result.error);
      else {
        toast.success('입사 확정 처리되었습니다.');
        refreshCandidateData().catch(() => {});
        if (onClose) onClose();
      }
    } catch {
      toast.error('입사 확정 처리 중 오류가 발생했습니다.');
    }
  };

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoadingSchedule(true);
    setScheduleWarning(null);
    try {
      const startDateStr = scheduleFormData.dateRange.from
        ? format(scheduleFormData.dateRange.from, 'yyyy-MM-dd')
        : '';
      const endDateStr = scheduleFormData.dateRange.to
        ? format(scheduleFormData.dateRange.to, 'yyyy-MM-dd')
        : '';
      const formDataToSend = new FormData();
      formDataToSend.append('candidate_id', candidate.id);
      formDataToSend.append('stage_id', scheduleFormData.stage_id);
      formDataToSend.append('start_date', startDateStr);
      formDataToSend.append('end_date', endDateStr);
      formDataToSend.append('duration_minutes', scheduleFormData.duration_minutes);
      formDataToSend.append('interviewer_ids', JSON.stringify(scheduleFormData.interviewer_ids));
      formDataToSend.append(
        'external_interviewer_emails',
        JSON.stringify(scheduleFormData.external_interviewer_emails),
      );
      formDataToSend.append('num_options', scheduleFormData.num_options);
      // 가능 시간(업무시간) 전달: 서버에서 allowed_time_ranges로 변환해 사용
      formDataToSend.append('work_start_hour', scheduleFormData.work_start_hour);
      formDataToSend.append('work_start_minute', scheduleFormData.work_start_minute);
      formDataToSend.append('work_end_hour', scheduleFormData.work_end_hour);
      formDataToSend.append('work_end_minute', scheduleFormData.work_end_minute);
      formDataToSend.append('exclude_start_hour', scheduleFormData.exclude_start_hour);
      formDataToSend.append('exclude_start_minute', scheduleFormData.exclude_start_minute);
      formDataToSend.append('exclude_end_hour', scheduleFormData.exclude_end_hour);
      formDataToSend.append('exclude_end_minute', scheduleFormData.exclude_end_minute);
      const result = await scheduleInterviewAutomated(formDataToSend);
      if (result.error) {
        if (
          result.error.includes('일정을 찾을 수 없습니다') ||
          result.error.includes('공통 가능 일정')
        )
          setScheduleWarning(result.error);
        else toast.error(result.error);
      } else {
        toast.success((result as { message?: string }).message || '면접 일정 자동화가 시작되었습니다.');
        setDetailInitialTab('timeline');
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(getDetailTabStorageKey(), 'timeline');
        }
        setViewMode('detail');
        // ✅ 자동화 시작 직후에도 좌측 사이드바(일정 조율 현황)가 즉시 갱신되도록
        //    스케줄 목록을 서버에서 재조회해 로컬 상태에 반영합니다.
        //    (타임라인만 새로고침하면 schedulesState가 stale이라 "등록된 일정이 없습니다"가 유지될 수 있음)
        await applySchedulesFromServer(candidate.id);
        router.refresh();
        refreshCandidateData().catch(() => {});
        refreshTimelineEvents().catch(() => {});
      }
    } catch {
      toast.error('면접 일정 자동화에 실패했습니다.');
    } finally {
      setIsLoadingSchedule(false);
    }
  };

  const toggleInterviewer = (uid: string) => {
    setScheduleFormData((prev) => ({
      ...prev,
      interviewer_ids: prev.interviewer_ids.includes(uid)
        ? prev.interviewer_ids.filter((id) => id !== uid)
        : [...prev.interviewer_ids, uid],
    }));
  };

  const isScheduleFormValid =
    !!scheduleFormData.dateRange.from &&
    !!scheduleFormData.dateRange.to &&
    (scheduleFormData.interviewer_ids.length > 0 ||
      scheduleFormData.external_interviewer_emails.length > 0) &&
    !isLoadingUsers;

  const addExternalInterviewerEmail = (email: string) => {
    const normalized = email.trim().toLowerCase();
    if (!normalized) return;
    setScheduleFormData((prev) => {
      if (prev.external_interviewer_emails.includes(normalized)) return prev;
      return {
        ...prev,
        external_interviewer_emails: [...prev.external_interviewer_emails, normalized],
      };
    });
  };

  const removeExternalInterviewerEmail = (email: string) => {
    setScheduleFormData((prev) => ({
      ...prev,
      external_interviewer_emails: prev.external_interviewer_emails.filter((item) => item !== email),
    }));
  };

  const handleSaveEdit = async () => {
    if (!profileEditMode) return;
    setIsSavingProfile(true);
    try {
      const formData = new FormData();
      formData.append('name', candidate.name);
      if (profileEditMode === 'basic') {
        formData.append('email', editFormData.email);
        formData.append('phone', editFormData.phone);
        formData.append('current_salary', candidate.current_salary ?? '');
        formData.append('expected_salary', candidate.expected_salary ?? '');
      } else {
        formData.append('email', candidate.email);
        formData.append('phone', candidate.phone || '');
        formData.append('current_salary', editFormData.current_salary);
        formData.append('expected_salary', editFormData.expected_salary);
      }
      const result = await updateCandidate(candidate.id, formData);
      if (result.error) toast.error(result.error);
      else {
        toast.success(
          profileEditMode === 'basic' ? '기본 정보가 수정되었습니다.' : '연봉 정보가 수정되었습니다.',
        );
        setProfileEditMode(null);
        refreshCandidateData().catch(() => {});
      }
    } catch (err) {
      toast.error((err as Error).message || '수정 중 오류가 발생했습니다.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const openProfileSectionEdit = (section: 'basic' | 'compensation') => {
    setEditFormData({
      email: candidate.email,
      phone: candidate.phone || '',
      current_salary: candidate.current_salary || '',
      expected_salary: candidate.expected_salary || '',
    });
    setProfileEditMode(section);
  };

  const handleCancelEdit = () => {
    setEditFormData({
      email: candidate.email,
      phone: candidate.phone || '',
      current_salary: candidate.current_salary || '',
      expected_salary: candidate.expected_salary || '',
    });
    setProfileEditMode(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await uploadResumeFile(candidate.id, formData);
      if (result.error) toast.error(result.error);
      else {
        toast.success('파일이 업로드되었습니다.');
        aiTriggerStartedRef.current = false;
        loadResumeFiles();
        refreshCandidateData().catch(() => {});
      }
    } catch (err) {
      toast.error((err as Error).message || '파일 업로드 중 오류가 발생했습니다.');
    } finally {
      setIsUploadingFile(false);
      e.target.value = '';
    }
  };

  const handleFileDelete = async (fileId: string) => {
    if (!confirm('정말 이 파일을 삭제하시겠습니까?')) return;
    try {
      const result = await deleteResumeFile(fileId);
      if (result.error) toast.error(result.error);
      else {
        toast.success('파일이 삭제되었습니다.');
        loadResumeFiles();
        refreshCandidateData().catch(() => {});
      }
    } catch (err) {
      toast.error((err as Error).message || '파일 삭제 중 오류가 발생했습니다.');
    }
  };

  const handleSyncEmails = async () => {
    setIsSyncingEmails(true);
    try {
      const result = await syncCandidateEmails(candidate.id, 90);
      if (result.error) toast.error(result.error);
      else {
        const synced = (result as { synced?: number }).synced ?? 0;
        if (synced > 0) toast.success(`${synced}개의 이메일을 동기화했습니다.`);
        else toast.info('동기화할 이메일이 없습니다.');
        refreshTimelineEvents().catch(() => {});
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '이메일 동기화 중 오류가 발생했습니다.';
      if (msg.includes('Gmail 읽기 권한') || msg.includes('GMAIL_READ_SCOPE_MISSING'))
        toast.error('Gmail 읽기 권한이 필요합니다. 구글 캘린더를 재연동하여 Gmail 읽기 권한을 승인해주세요.');
      else toast.error(msg);
    } finally {
      setIsSyncingEmails(false);
    }
  };

  // 타임라인·사이드바에서 일정 삭제 (사이드바는 이미 confirm을 거쳐 서로 skipConfirm 가능)
  const handleDeleteScheduleFromTimeline = async (
    scheduleId: string,
    options?: { skipConfirm?: boolean },
  ) => {
    if (!options?.skipConfirm) {
      if (!confirm('정말로 이 면접 일정을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;
    }
    setScheduleActionLoadingId(scheduleId);
    const syncAfterDelete = async () => {
      setSchedulesState((prev) => prev.filter((s) => String(s?.id) !== String(scheduleId)));
      await applySchedulesFromServer(candidate.id);
      router.refresh();
      refreshCandidateData().catch(() => {});
      refreshTimelineEvents().catch(() => {});
    };
    try {
      const result = await deleteSchedule(scheduleId);
      const possibleError = (result as { error?: string }).error;
      if (possibleError && possibleError.length > 0) {
        if (possibleError.includes('면접 일정을 찾을 수 없습니다')) {
          toast.info('이미 삭제된 일정이어서 목록을 최신화했습니다.');
          await syncAfterDelete();
        } else {
          toast.error(possibleError);
        }
      } else {
        toast.success('면접 일정이 삭제되었습니다.');
        await syncAfterDelete();
      }
    } catch (error) {
      console.error('[CandidateDetailClient] 면접 일정 삭제 실패:', error);
      const msg = error instanceof Error ? error.message : '면접 일정 삭제 중 오류가 발생했습니다.';
      if (typeof msg === 'string' && msg.includes('면접 일정을 찾을 수 없습니다')) {
        toast.info('이미 삭제된 일정이어서 목록을 최신화했습니다.');
        await syncAfterDelete();
      } else {
        toast.error(msg);
      }
    } finally {
      setScheduleActionLoadingId(null);
    }
  };

  /** 코파일럿: 서버·캘린더 기준으로 조율 진행 상태를 맞추고, 로컬 스케줄 목록을 항상 최신화합니다. */
  const handleCheckScheduleFromTimeline = async (scheduleId: string) => {
    setScheduleActionLoadingId(scheduleId);
    const refreshSchedulesAndRouter = async () => {
      await applySchedulesFromServer(candidate.id);
      router.refresh();
    };
    try {
      const result = await checkInterviewerResponses(scheduleId);
      if ((result as { error?: string }).error) {
        toast.error((result as { error: string }).error);
        await refreshSchedulesAndRouter();
        refreshTimelineEvents().catch(() => {});
        return;
      }
      if ((result as { data?: any }).data) {
        const data = (result as {
          data: {
            allAccepted?: boolean;
            alreadyProcessed?: boolean;
            message?: string;
          };
        }).data;
        if (data.allAccepted) {
          toast.success(data.message || '모든 면접관이 수락한 일정이 있습니다. 후보자에게 전송되었습니다.');
        } else if (data.alreadyProcessed) {
          toast.success(data.message || '진행 현황을 최신으로 맞추었습니다.');
        } else {
          toast.info(data.message || '조율 상태를 확인했습니다.');
        }
        await refreshSchedulesAndRouter();
        refreshCandidateData().catch(() => {});
        refreshTimelineEvents().catch(() => {});
      } else {
        toast.info('확인 결과가 없습니다.');
        await refreshSchedulesAndRouter();
        refreshTimelineEvents().catch(() => {});
      }
    } catch (error) {
      console.error('[CandidateDetailClient] 일정 동기화 실패:', error);
      toast.error('일정 동기화 중 오류가 발생했습니다.');
      await refreshSchedulesAndRouter();
    } finally {
      setScheduleActionLoadingId(null);
    }
  };

  const getCurrentStageName = (): string => {
    if (!currentStageId) return 'New Application';
    if (STAGE_ID_TO_NAME_MAP[currentStageId]) return STAGE_ID_TO_NAME_MAP[currentStageId];
    // ✅ job_posts는 쿼리 레이어에서 단일 객체로 정규화됩니다.
    const jobPost = candidate.job_posts;
    const stages = jobPost?.processes?.stages;
    if (stages?.length) {
      const stage = stages.find((s) => s.id === currentStageId);
      if (stage?.name) return stage.name;
    }
    return currentStageId;
  };

  const currentStageName = getCurrentStageName();
  const canViewCompensation = ['admin', 'recruiter', 'hiring_manager'].includes(userRole);
  const canManageCandidate = userRole === 'admin' || userRole === 'recruiter';
  const skills = candidate.parsed_data?.skills || candidate.skills || [];

  const toggleEmailExpand = (eventId: string) => {
    setExpandedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  };

  return (
    <>
      <button
        onClick={handleClose}
        className="absolute top-4 right-4 z-50 p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-lg hover:bg-white transition-colors text-slate-600 hover:text-slate-900"
        aria-label="닫기"
      >
        <X className="w-5 h-5" />
      </button>

      {/* VNTG Design System 2.0 레이아웃 */}
      {viewMode === 'detail' ? (
        <CandidateDetailLayout
          candidate={candidate}
          currentStageName={currentStageName}
          currentStageId={currentStageId}
          canManageCandidate={canManageCandidate}
          isMovingStage={isMovingStage}
          availableStages={availableStages}
          isLoadingStages={isLoadingStages}
          onScheduleClick={() => setViewMode('scheduling')}
          onMoveToStage={handleMoveToStage}
          onLoadStages={loadAvailableStages}
          onConfirmHire={handleConfirmHire}
          onEmailClick={() => setIsEmailModalOpen(true)}
          onArchiveClick={() => setIsArchiveModalOpen(true)}
          timelineEvents={timelineEventsState}
          isTimelineLoading={isLoadingTimeline}
          hasLoadedTimeline={hasLoadedTimeline}
          expandedEmails={expandedEmails}
          onToggleEmailExpand={toggleEmailExpand}
          onAddComment={() => setIsCommentModalOpen(true)}
          onRefreshTimeline={refreshTimelineEvents}
        onDeleteSchedule={handleDeleteScheduleFromTimeline}
        onCheckSchedule={handleCheckScheduleFromTimeline}
        currentActiveSchedule={currentActiveSchedule}
        scheduleActionLoadingId={scheduleActionLoadingId}
          resumeFiles={resumeFiles}
          canViewCompensation={canViewCompensation}
          onOpenProfileSectionEdit={openProfileSectionEdit}
          activeTab={detailInitialTab}
          onActiveTabChange={setDetailInitialTab}
          onFileUpload={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.pdf,.doc,.docx';
            input.onchange = (e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (file) {
                // ChangeEvent는 구조가 복잡하므로 중간에 unknown으로 한번 거쳐 타입 충돌만 우회합니다.
                const event = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>;
                handleFileUpload(event);
              }
            };
            input.click();
          }}
          onFileDelete={handleFileDelete}
        />
      ) : (
        <CandidateScheduleForm
          candidate={candidate}
          currentStageName={currentStageName}
          currentStageId={currentStageId}
          formData={scheduleFormData}
          onFormDataChange={(data) => setScheduleFormData((prev) => ({ ...prev, ...data }))}
          users={users}
          externalInterviewerPool={externalInterviewerPool}
          isLoadingUsers={isLoadingUsers}
          scheduleWarning={scheduleWarning}
          isLoadingSchedule={isLoadingSchedule}
          isValid={isScheduleFormValid}
          onSubmit={handleScheduleSubmit}
          onToggleInterviewer={toggleInterviewer}
          onAddExternalInterviewer={addExternalInterviewerEmail}
          onRemoveExternalInterviewer={removeExternalInterviewerEmail}
          onBack={() => {
            setDetailInitialTab('profile');
            if (typeof window !== 'undefined') {
              window.sessionStorage.setItem(getDetailTabStorageKey(), 'profile');
            }
            setViewMode('detail');
          }}
          availableStages={availableStages}
          isLoadingStages={isLoadingStages}
          isMovingStage={isMovingStage}
          onMoveToStage={handleMoveToStage}
          onLoadStages={loadAvailableStages}
          onConfirmHire={handleConfirmHire}
          onEmailClick={() => setIsEmailModalOpen(true)}
          onArchiveClick={() => setIsArchiveModalOpen(true)}
        />
      )}

      <EmailModal
        candidateId={candidate.id}
        candidateEmail={candidate.email}
        candidateName={candidate.name}
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
      />
      <ArchiveCandidateModal
        candidateId={candidate.id}
        candidateName={candidate.name}
        isOpen={isArchiveModalOpen}
        onClose={() => {
          setIsArchiveModalOpen(false);
          refreshCandidateData().catch(() => {});
          if (onClose) onClose();
        }}
      />
      <CommentModal
        candidateId={candidate.id}
        candidateName={candidate.name}
        isOpen={isCommentModalOpen}
        onClose={() => {
          setIsCommentModalOpen(false);
          refreshTimelineEvents().catch(() => {});
        }}
      />
      {candidate.current_stage_id && (
        <StageEvaluationModal
          candidateId={candidate.id}
          candidateName={candidate.name}
          stageId={currentStageId}
          stageName={currentStageName}
          existingEvaluation={
            userId
              ? (evaluations as Array<{ id: string; result: 'pending' | 'pass' | 'fail'; notes?: string; stage_id: string; evaluator_id: string }>).find(
                  (e) => e.stage_id === currentStageId && e.evaluator_id === userId,
                )
              : undefined
          }
          isOpen={isEvaluationModalOpen}
          onClose={() => {
            setIsEvaluationModalOpen(false);
            loadEvaluations();
            refreshTimelineEvents().catch(() => {});
          }}
        />
      )}
      <CandidateProfileEditDialog
        open={profileEditMode !== null}
        mode={profileEditMode}
        form={editFormData}
        onFormChange={(patch) => setEditFormData((prev) => ({ ...prev, ...patch }))}
        onSave={handleSaveEdit}
        onCancel={handleCancelEdit}
        isSaving={isSavingProfile}
      />
    </>
  );
}
