'use client';

// VNTG Design System 2.0 - 후보자 상세 레이아웃 (탭 전환 통합)
import { useState } from 'react';
import { CandidateSidebar } from './CandidateSidebar';
import { CandidateAIInsightView } from './CandidateAIInsightView';
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
  // 타임라인 관련
  timelineEvents: TimelineEvent[];
  expandedEmails: Set<string>;
  onToggleEmailExpand: (eventId: string) => void;
  onAddComment: () => void;
  onCancelSchedule?: (scheduleId: string) => void;
  onDeleteSchedule?: (scheduleId: string) => void;
  onRescheduleSchedule?: (scheduleId: string) => void;
  // AI 인사이트 관련
  resumeFiles: ResumeFile[];
  canViewCompensation: boolean;
  onEditContact?: () => void;
  onViewCompensation?: () => void;
  onFileUpload?: () => void;
  onFileSelect?: (file: ResumeFile) => void;
}

type TabType = 'ai-insight' | 'timeline';

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
  expandedEmails,
  onToggleEmailExpand,
  onAddComment,
  onCancelSchedule,
  onDeleteSchedule,
  onRescheduleSchedule,
  resumeFiles,
  canViewCompensation,
  onEditContact,
  onViewCompensation,
  onFileUpload,
  onFileSelect,
}: CandidateDetailLayoutProps) {
  const [activeTab, setActiveTab] = useState<TabType>('ai-insight');

  return (
    <div className="flex h-[820px] w-full max-w-[1080px] bg-white rounded-2xl shadow-[0_24px_60px_-15px_rgba(0,0,0,0.05)] border border-neutral-200 overflow-hidden font-sans">
      {/* 좌측 사이드바 */}
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

      {/* 우측 메인 콘텐츠 영역 */}
      <div className="flex-1 flex flex-col bg-white relative">
        {/* 탭 헤더 */}
        <header className="h-16 border-b border-neutral-100 px-8 flex items-center justify-between shrink-0">
          <div className="flex gap-6 h-full">
            <button
              onClick={() => setActiveTab('ai-insight')}
              className={`h-full border-b-2 transition-colors ${
                activeTab === 'ai-insight'
                  ? 'border-neutral-900 text-sm font-semibold text-neutral-900'
                  : 'border-transparent text-sm font-medium text-neutral-400 hover:text-neutral-900'
              }`}
            >
              AI Insight
            </button>
            <button
              onClick={() => setActiveTab('timeline')}
              className={`h-full border-b-2 transition-colors ${
                activeTab === 'timeline'
                  ? 'border-neutral-900 text-sm font-semibold text-neutral-900'
                  : 'border-transparent text-sm font-medium text-neutral-400 hover:text-neutral-900'
              }`}
            >
              Activity Timeline
            </button>
          </div>
        </header>

        {/* 탭 콘텐츠 */}
        {activeTab === 'ai-insight' ? (
          <CandidateAIInsightView
            candidate={candidate}
            resumeFiles={resumeFiles}
            canManageCandidate={canManageCandidate}
            canViewCompensation={canViewCompensation}
            onEditContact={onEditContact}
            onViewCompensation={onViewCompensation}
            onFileUpload={onFileUpload}
            onFileSelect={onFileSelect}
          />
        ) : (
          <CandidateTimelineView
            candidateName={candidate.name}
            events={timelineEvents}
            expandedEmails={expandedEmails}
            onToggleEmailExpand={onToggleEmailExpand}
            candidateId={candidate.id}
            currentStageId={currentStageId}
            canManageCandidate={canManageCandidate}
            onAddComment={onAddComment}
            onCancelSchedule={onCancelSchedule}
            onDeleteSchedule={onDeleteSchedule}
            onRescheduleSchedule={onRescheduleSchedule}
          />
        )}
      </div>
    </div>
  );
}
