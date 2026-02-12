'use client'

import { useState, useMemo } from 'react'
import { Filters } from './Filters'
import { CandidateCard } from './CandidateCard'
import { Badge } from '@/components/ui/badge'

type TabType = 'applicant' | 'interview' | 'archive'

interface Candidate {
  id: string
  name: string
  email: string
  status: string
  current_stage_id: string | null
  job_posts: {
    id: string
    title: string
    processes?: {
      stages?: Array<{ id: string; name: string }>
    }
  }
}

interface MainDashboardProps {
  candidates: Candidate[]
  jobs: Array<{ id: string; title: string }>
}

export function MainDashboard({ candidates, jobs }: MainDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('applicant')
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null)
  const [selectedStage, setSelectedStage] = useState<string>('')
  const [selectedPosition, setSelectedPosition] = useState<string>('')
  const [selectedSource, setSelectedSource] = useState<string>('')
  const [selectedSchedulingStatus, setSelectedSchedulingStatus] = useState<string>('')

  // Extract unique stages from candidates
  const stages = useMemo(() => {
    const stageMap = new Map<string, string>()
    candidates.forEach((candidate) => {
      const stages = candidate.job_posts?.processes?.stages || []
      stages.forEach((stage: any) => {
        if (!stageMap.has(stage.id)) {
          stageMap.set(stage.id, stage.name)
        }
      })
    })
    return Array.from(stageMap.entries()).map(([id, name]) => ({ id, name }))
  }, [candidates])

  // Filter candidates based on tab
  const filteredCandidates = useMemo(() => {
    let filtered = candidates

    // Tab-based filtering
    if (activeTab === 'applicant') {
      filtered = filtered.filter((c) => c.status === 'pending')
    } else if (activeTab === 'interview') {
      filtered = filtered.filter((c) => c.status === 'in_progress')
    } else if (activeTab === 'archive') {
      filtered = filtered.filter((c) => ['rejected', 'confirmed'].includes(c.status))
    }

    // Stage filter
    if (selectedStage) {
      filtered = filtered.filter((c) => c.current_stage_id === selectedStage)
    }

    // Position filter
    if (selectedPosition) {
      filtered = filtered.filter((c) => c.job_posts.id === selectedPosition)
    }

    // TODO: Source and Scheduling Status filters (need additional data)

    return filtered
  }, [candidates, activeTab, selectedStage, selectedPosition, selectedSource, selectedSchedulingStatus])

  const selectedCandidateData = useMemo(() => {
    if (!selectedCandidate) return null
    return candidates.find((c) => c.id === selectedCandidate)
  }, [candidates, selectedCandidate])

  return (
    <div className="flex h-full gap-6">
      {/* Left: Filters */}
      <aside className="w-64 flex-shrink-0">
        <div className="sticky top-8">
          <Filters
            selectedStage={selectedStage}
            selectedPosition={selectedPosition}
            selectedSource={selectedSource}
            selectedSchedulingStatus={selectedSchedulingStatus}
            onStageChange={setSelectedStage}
            onPositionChange={setSelectedPosition}
            onSourceChange={setSelectedSource}
            onSchedulingStatusChange={setSelectedSchedulingStatus}
            stages={stages}
            positions={jobs.map((j) => ({ id: j.id, title: j.title }))}
          />
        </div>
      </aside>

      {/* Center: List View */}
      <div className="flex-1">
        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'applicant', label: 'Applicant' },
              { id: 'interview', label: 'Interview' },
              { id: 'archive', label: 'Archive' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as TabType)
                  setSelectedCandidate(null)
                }}
                className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'border-[#0248FF] text-[#0248FF]'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
                style={{ fontFamily: 'Roboto, sans-serif' }}
              >
                {tab.label}
                <Badge variant="secondary" className="ml-2">
                  {tab.id === 'applicant'
                    ? candidates.filter((c) => c.status === 'pending').length
                    : tab.id === 'interview'
                      ? candidates.filter((c) => c.status === 'in_progress').length
                      : candidates.filter((c) => ['rejected', 'confirmed'].includes(c.status)).length}
                </Badge>
              </button>
            ))}
          </nav>
        </div>

        {/* Candidate List */}
        <div className="space-y-3">
          {filteredCandidates.length > 0 ? (
            filteredCandidates.map((candidate) => (
              <div
                key={candidate.id}
                onClick={() => setSelectedCandidate(candidate.id)}
                className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
                  selectedCandidate === candidate.id
                    ? 'border-[#0248FF] bg-[#0248FF]/5'
                    : 'border-gray-200 bg-white hover:border-[#5287FF] hover:shadow-md'
                }`}
              >
                <CandidateCard candidate={candidate} />
              </div>
            ))
          ) : (
            <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
              <p className="text-gray-500" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                {activeTab === 'applicant' && '신규 지원자가 없습니다.'}
                {activeTab === 'interview' && '면접 진행 중인 후보자가 없습니다.'}
                {activeTab === 'archive' && '보관된 후보자가 없습니다.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Right: Detail Panel */}
      {selectedCandidateData && (
        <aside className="w-96 flex-shrink-0 border-l border-gray-200 bg-white p-6">
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                {selectedCandidateData.name}
              </h2>
              <p className="text-sm text-gray-600" style={{ fontFamily: 'Roboto, sans-serif' }}>
                {selectedCandidateData.email}
              </p>
            </div>
            <div>
              <Badge
                variant={
                  selectedCandidateData.status === 'pending'
                    ? 'warning'
                    : selectedCandidateData.status === 'in_progress'
                      ? 'primary'
                      : selectedCandidateData.status === 'confirmed'
                        ? 'success'
                        : 'danger'
                }
              >
                {selectedCandidateData.status}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-gray-600" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                포지션: {selectedCandidateData.job_posts.title}
              </p>
            </div>
            <div>
              <a
                href={`/candidates/${selectedCandidateData.id}`}
                className="text-sm text-[#0248FF] hover:underline"
                style={{ fontFamily: 'Noto Sans KR, sans-serif' }}
              >
                전체 상세보기 →
              </a>
            </div>
          </div>
        </aside>
      )}
    </div>
  )
}
