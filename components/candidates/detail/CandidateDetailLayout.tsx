'use client';

// VNTG Design System 2.0 - 후보자 상세 레이아웃 (Profile / AI Insight / Timeline)
import { useState } from 'react';
import { CandidateSidebar } from './CandidateSidebar';
import { CandidateProfileTab } from './CandidateProfileTab';
import { CandidateInsightTab } from './CandidateInsightTab';
import { CandidateTimelineView } from './CandidateTimelineView';
import type { Candidate } from '@/types/candidates';
import type { TimelineEvent, ResumeFile } from '@/types/candidate-detail';

interface StageOption {
  id: string;
  name: string;
  order: number;
  isCurrent: boolean;
}

interface CandidateDetailLayoutProps {
  candidate: Candidate;
  currentStageName: string;
  currentStageId: string;
  canManageCandidate: boolean;
  isMovingStage: boolean;
  availableStages: StageOption[];
  isLoadingStages: boolean;
  onScheduleClick: () => void;
  onMoveToStage: (stageId: string) => void;
  onLoadStages: () => void;
  onConfirmHire: () => void;
  onEmailClick: () => void;
  onArchiveClick: () => void;
  timelineEvents: TimelineEvent[];
  /** 타임라인 탭에서 데이터를 불러오는 중인지(지연 로딩) */
  isTimelineLoading?: boolean;
  /** 타임라인을 한 번이라도 로드해본 적이 있는지(빈 상태 메시지 제어) */
  hasLoadedTimeline?: boolean;
  expandedEmails: Set<string>;
  onToggleEmailExpand: (eventId: string) => void;
  onAddComment: () => void;
  onRefreshTimeline?: () => void | Promise<void>;
  onSwitchToTimeline?: () => void;
  onCancelSchedule?: (scheduleId: string) => void;
  onDeleteSchedule?: (scheduleId: string) => void;
  onRescheduleSchedule?: (scheduleId: string) => void;
  onCheckSchedule?: (scheduleId: string) => void;
  resumeFiles: ResumeFile[];
  canViewCompensation: boolean;
  onOpenProfileSectionEdit?: (section: 'basic' | 'compensation') => void;
  onFileUpload?: () => void;
  onFileSelect?: (file: ResumeFile) => void;
  initialActiveTab?: TabType;
  activeTab?: TabType;
  onActiveTabChange?: (tab: TabType) => void;
}

type TabType = 'profile' | 'insight' | 'timeline';

/** 후보자 상세 레이아웃 - VNTG Design System 2.0 */
export function CandidateDetailLayout({
  candidate,
  currentStageName,
  currentStageId,
  canManageCandidate,
  isMovingStage,
  availableStages,
  isLoadingStages,
  onScheduleClick,
  onMoveToStage,
  onLoadStages,
  onConfirmHire,
  onEmailClick,
  onArchiveClick,
  timelineEvents,
  isTimelineLoading = false,
  hasLoadedTimeline = false,
  expandedEmails,
  onToggleEmailExpand,
  onAddComment,
  onRefreshTimeline,
  onSwitchToTimeline,
  onCancelSchedule,
  onDeleteSchedule,
  onRescheduleSchedule,
  onCheckSchedule,
  resumeFiles,
  canViewCompensation,
  onOpenProfileSectionEdit,
  onFileUpload,
  onFileSelect,
  initialActiveTab = 'profile',
  activeTab,
  onActiveTabChange,
}: CandidateDetailLayoutProps) {
  const [internalActiveTab, setInternalActiveTab] = useState<TabType>(initialActiveTab);
  const resolvedActiveTab = activeTab ?? internalActiveTab;

  const setTab = (tab: TabType) => {
    if (activeTab === undefined) setInternalActiveTab(tab);
    onActiveTabChange?.(tab);
  };

  const handleSwitchToTimeline = () => {
    setTab('timeline');
  };

  const tabBtn = (tab: TabType, label: string) => (
    <button
      type="button"
      onClick={() => setTab(tab)}
      className={`h-full border-b-2 transition-colors ${
        resolvedActiveTab === tab
          ? 'border-neutral-900 text-sm font-semibold text-neutral-900'
          : 'border-transparent text-sm font-medium text-neutral-400 hover:text-neutral-900'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 max-w-[1280px] bg-white rounded-2xl shadow-[0_24px_60px_-15px_rgba(0,0,0,0.05)] border border-neutral-200 overflow-hidden font-sans">
      <CandidateSidebar
        candidate={candidate}
        currentStageName={currentStageName}
        currentStageId={currentStageId}
        canManageCandidate={canManageCandidate}
        isMovingStage={isMovingStage}
        availableStages={availableStages}
        isLoadingStages={isLoadingStages}
        onScheduleClick={onScheduleClick}
        onMoveToStage={onMoveToStage}
        onLoadStages={onLoadStages}
        onConfirmHire={onConfirmHire}
        onEmailClick={onEmailClick}
        onArchiveClick={onArchiveClick}
      />

      {/* min-w-0: 중첩 flex에서 탭 콘텐츠가 가로 0에 가깝게 줄어드는 것 방지 */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-white relative">
        <header className="h-16 border-b border-neutral-100 px-8 flex items-center shrink-0 bg-white z-10">
          <div className="flex gap-8 h-full">
            {tabBtn('profile', 'Profile')}
            {tabBtn('insight', 'AI Insight')}
            {tabBtn('timeline', 'Activity Timeline')}
          </div>
        </header>

        {resolvedActiveTab === 'profile' && (
          <CandidateProfileTab
            candidate={candidate}
            resumeFiles={resumeFiles}
            canManageCandidate={canManageCandidate}
            canViewCompensation={canViewCompensation}
            onOpenProfileSectionEdit={onOpenProfileSectionEdit}
            onFileUpload={onFileUpload}
            onFileSelect={onFileSelect}
          />
        )}
        {resolvedActiveTab === 'insight' && <CandidateInsightTab candidate={candidate} />}
        {resolvedActiveTab === 'timeline' && (
          <CandidateTimelineView
            candidateName={candidate.name}
            events={timelineEvents}
            isLoading={isTimelineLoading}
            hasLoaded={hasLoadedTimeline}
            expandedEmails={expandedEmails}
            onToggleEmailExpand={onToggleEmailExpand}
            candidateId={candidate.id}
            currentStageId={currentStageId}
            canManageCandidate={canManageCandidate}
            onAddComment={onAddComment}
            onRefreshTimeline={onRefreshTimeline}
            onSwitchToTimeline={handleSwitchToTimeline}
            onCancelSchedule={onCancelSchedule}
            onDeleteSchedule={onDeleteSchedule}
            onRescheduleSchedule={onRescheduleSchedule}
            onCheckSchedule={onCheckSchedule}
          />
        )}
      </div>
    </div>
  );
}
