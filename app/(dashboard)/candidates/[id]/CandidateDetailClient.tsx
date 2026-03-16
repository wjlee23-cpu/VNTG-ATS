'use client';

import { useState, useEffect } from 'react';
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
import { scheduleInterviewAutomated } from '@/api/actions/schedules';
import { getUsers } from '@/api/queries/users';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { EmailModal } from '@/components/candidates/EmailModal';
import { ArchiveCandidateModal } from '@/components/candidates/ArchiveCandidateModal';
import { StageEvaluationModal } from '@/components/candidates/StageEvaluationModal';
import { CommentModal } from '@/components/candidates/CommentModal';
import { DocumentPreviewModal } from '@/components/candidates/DocumentPreviewModal';
import { MatchScoreSection } from '@/components/candidates/MatchScoreSection';
import { getFileName } from '@/lib/candidate-detail-utils';
import { CandidateDetailSidebar } from '@/components/candidates/detail/CandidateDetailSidebar';
import { ContactCard } from '@/components/candidates/detail/ContactCard';
import { CompensationCard } from '@/components/candidates/detail/CompensationCard';
import { SkillsCard } from '@/components/candidates/detail/SkillsCard';
import { DocumentsCard } from '@/components/candidates/detail/DocumentsCard';
import { ActivityTimeline } from '@/components/candidates/detail/ActivityTimeline';
import { CandidateSchedulingForm } from '@/components/candidates/detail/CandidateSchedulingForm';
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
  const router = useRouter();
  const [candidate, setCandidate] = useState<Candidate>(initialCandidate);
  const [viewMode, setViewMode] = useState<'detail' | 'scheduling'>('detail');
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [isEvaluationModalOpen, setIsEvaluationModalOpen] = useState(false);
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  const [isDocumentPreviewOpen, setIsDocumentPreviewOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<ResumeFile | null>(null);
  const [pdfLoadError, setPdfLoadError] = useState<string | null>(null);
  const [evaluations, setEvaluations] = useState<unknown[]>([]);
  const [resumeFiles, setResumeFiles] = useState<ResumeFile[]>([]);
  const [timelineEventsState, setTimelineEventsState] = useState<TimelineEvent[]>(timelineEvents);
  const [userRole, setUserRole] = useState<'admin' | 'recruiter' | 'interviewer' | 'hiring_manager'>('recruiter');
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoadingEvaluations, setIsLoadingEvaluations] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [showCompensation, setShowCompensation] = useState(false);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [users, setUsers] = useState<Array<{ id: string; email: string; role: string }>>([]);
  const [scheduleFormData, setScheduleFormData] = useState({
    dateRange: { from: undefined, to: undefined } as { from: Date | undefined; to: Date | undefined },
    duration_minutes: '60',
    stage_id: 'stage-6',
    interviewer_ids: [] as string[],
    num_options: '2',
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
  const [isEditMode, setIsEditMode] = useState(false);
  const [editFormData, setEditFormData] = useState({
    email: initialCandidate.email,
    phone: initialCandidate.phone || '',
    current_salary: initialCandidate.current_salary || '',
    expected_salary: initialCandidate.expected_salary || '',
  });
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [isMovingStage, setIsMovingStage] = useState(false);

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
      const result = await getTimelineEvents(candidate.id);
      if (result.data) setTimelineEventsState(result.data);
    } catch (error) {
      console.error('[CandidateDetailClient] 타임라인 이벤트 업데이트 실패:', error);
    }
  };

  useEffect(() => {
    if (candidate.id) {
      loadEvaluations();
      loadUserRole();
      loadResumeFiles();
    }
  }, [candidate.id]);

  useEffect(() => {
    if (viewMode === 'scheduling') loadUsers();
  }, [viewMode]);

  useEffect(() => {
    if (resumeFiles.length > 0 && !selectedDocument) setSelectedDocument(resumeFiles[0]);
  }, [resumeFiles]);

  useEffect(() => {
    const shouldTrigger =
      resumeFiles.length > 0 &&
      (candidate.ai_analysis_status === null || candidate.ai_analysis_status === 'pending') &&
      candidate.job_post_id;
    if (shouldTrigger) {
      triggerAIAnalysis(candidate.id)
        .then(() => refreshCandidateData())
        .catch((err) => console.error('[CandidateDetailClient] AI 분석 시작 실패:', err));
    }
  }, [resumeFiles.length, candidate.ai_analysis_status, candidate.job_post_id, candidate.id]);

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
      const result = await getUsers();
      const list = (result.data || []) as Array<{ id: string; email: string; role: string }>;
      setUsers(list.filter((u) => u.role === 'interviewer' || u.role === 'admin'));
    } catch {
      toast.error('면접관 목록을 불러올 수 없습니다.');
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const loadAvailableStages = async () => {
    if (!candidate.job_posts?.id) {
      toast.error('채용 공고 정보를 찾을 수 없습니다.');
      return;
    }
    if (!currentStageId?.trim()) {
      toast.error('현재 전형 정보를 찾을 수 없습니다.');
      return;
    }
    setIsLoadingStages(true);
    try {
      const result = await getAvailableStagesAction(candidate.job_posts.id, currentStageId);
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
    if (!currentStageId?.trim() || !candidate.job_posts?.id) {
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
      formDataToSend.append('num_options', scheduleFormData.num_options);
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
        setViewMode('detail');
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
    scheduleFormData.interviewer_ids.length > 0 &&
    !isLoadingUsers;

  const handleSaveEdit = async () => {
    try {
      const formData = new FormData();
      formData.append('name', candidate.name);
      formData.append('email', editFormData.email);
      formData.append('phone', editFormData.phone);
      if (editFormData.current_salary != null) formData.append('current_salary', editFormData.current_salary);
      if (editFormData.expected_salary != null)
        formData.append('expected_salary', editFormData.expected_salary);
      const result = await updateCandidate(candidate.id, formData);
      if (result.error) toast.error(result.error);
      else {
        toast.success('후보자 정보가 수정되었습니다.');
        setIsEditMode(false);
        refreshCandidateData().catch(() => {});
      }
    } catch (err) {
      toast.error((err as Error).message || '수정 중 오류가 발생했습니다.');
    }
  };

  const handleCancelEdit = () => {
    setEditFormData({
      email: candidate.email,
      phone: candidate.phone || '',
      current_salary: candidate.current_salary || '',
      expected_salary: candidate.expected_salary || '',
    });
    setIsEditMode(false);
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

  const handleFileDownload = (file: ResumeFile) => {
    const fileName = getFileName(file);
    const link = document.createElement('a');
    link.href = file.file_url;
    link.download = fileName;
    link.click();
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

  const getCurrentStageName = (): string => {
    if (!currentStageId) return 'New Application';
    if (STAGE_ID_TO_NAME_MAP[currentStageId]) return STAGE_ID_TO_NAME_MAP[currentStageId];
    const stages = candidate.job_posts?.processes?.stages;
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

      <div className="relative flex flex-col md:grid md:grid-cols-12 h-full max-h-[90vh] overflow-hidden">
        <CandidateDetailSidebar
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
        />

        <div className="md:col-span-8 lg:col-span-9 bg-slate-50 p-6 md:p-8 overflow-y-auto">
          <div
            className={cn(
              'transition-all duration-300',
              viewMode === 'scheduling' ? 'opacity-100 translate-x-0' : 'opacity-100 translate-x-0',
            )}
          >
            {viewMode === 'detail' ? (
              <>
                <MatchScoreSection
                  candidate={candidate as Parameters<typeof MatchScoreSection>[0]['candidate']}
                  hasResumeFile={resumeFiles.length > 0}
                />
                <ContactCard
                  candidate={candidate}
                  canManageCandidate={canManageCandidate}
                  canViewCompensation={canViewCompensation}
                  isEditMode={isEditMode}
                  editFormData={editFormData}
                  onEditFormChange={(data) => setEditFormData((prev) => ({ ...prev, ...data }))}
                  onSaveEdit={handleSaveEdit}
                  onCancelEdit={handleCancelEdit}
                  onSetEditMode={setIsEditMode}
                />
                {canViewCompensation && (
                  <CompensationCard
                    candidate={candidate}
                    showCompensation={showCompensation}
                    onShowCompensationChange={setShowCompensation}
                  />
                )}
                <SkillsCard skills={skills} />
                <DocumentsCard
                  resumeFiles={resumeFiles}
                  selectedDocument={selectedDocument}
                  onSelectDocument={(file) => {
                    setSelectedDocument(file);
                    setPdfLoadError(null);
                  }}
                  pdfLoadError={pdfLoadError}
                  onPdfLoadErrorClear={() => setPdfLoadError(null)}
                  onPdfLoadError={(msg) => setPdfLoadError(msg)}
                  onFileUpload={handleFileUpload}
                  onFileDownload={handleFileDownload}
                  onFileDelete={handleFileDelete}
                  isLoadingFiles={isLoadingFiles}
                  canManageCandidate={canManageCandidate}
                  isUploadingFile={isUploadingFile}
                />
                <ActivityTimeline
                  events={timelineEventsState}
                  expandedEmails={expandedEmails}
                  onToggleEmailExpand={toggleEmailExpand}
                  candidateId={candidate.id}
                  currentStageId={currentStageId}
                  canManageCandidate={canManageCandidate}
                  isSyncingEmails={isSyncingEmails}
                  onSyncEmails={handleSyncEmails}
                  onAddComment={() => setIsCommentModalOpen(true)}
                  onAddEvaluation={() => setIsEvaluationModalOpen(true)}
                />
              </>
            ) : (
              <CandidateSchedulingForm
                candidateName={candidate.name}
                formData={scheduleFormData}
                onFormDataChange={(data) => setScheduleFormData((prev) => ({ ...prev, ...data }))}
                users={users}
                isLoadingUsers={isLoadingUsers}
                scheduleWarning={scheduleWarning}
                isLoadingSchedule={isLoadingSchedule}
                isValid={isScheduleFormValid}
                onSubmit={handleScheduleSubmit}
                onToggleInterviewer={toggleInterviewer}
                onBack={() => setViewMode('detail')}
              />
            )}
          </div>
        </div>
      </div>

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
      <DocumentPreviewModal
        file={
          selectedDocument
            ? {
                id: selectedDocument.id,
                file_url: selectedDocument.file_url,
                file_type: selectedDocument.file_type,
              }
            : null
        }
        isOpen={isDocumentPreviewOpen}
        onClose={() => {
          setIsDocumentPreviewOpen(false);
          setSelectedDocument(null);
        }}
      />
    </>
  );
}
