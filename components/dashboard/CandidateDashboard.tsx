'use client'

import { useState, useMemo } from 'react'
import { Search, Filter, MoreVertical, CheckSquare, Square } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { VNTGSymbol } from '@/components/vntg/VNTGSymbol'
import Link from 'next/link'

interface Candidate {
  id: string
  name: string
  email: string
  status: string
  current_stage_id: string | null
  created_at: string
  job_posts?: {
    id: string
    title: string
    processes?: {
      stages?: Array<{ id: string; name: string }>
    }
  }
}

interface Job {
  id: string
  title: string
}

interface CandidateDashboardProps {
  candidates: Candidate[]
  jobs: Job[]
  onCandidateSelect?: (id: string) => void
}

export function CandidateDashboard({ candidates, jobs, onCandidateSelect }: CandidateDashboardProps) {
  const [activeStage, setActiveStage] = useState<'Applicant' | 'Interview' | 'Archive'>('Interview')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [activeApplicantSubStage, setActiveApplicantSubStage] = useState('new-applicant')
  const [activeArchiveReason, setActiveArchiveReason] = useState('position-filled')
  const [selectedJob, setSelectedJob] = useState<string | null>(jobs[0]?.id || null)
  const [activeInterviewStage, setActiveInterviewStage] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Calculate stage counts
  const stageCounts = useMemo(() => {
    const applicant = candidates.filter((c) => c.status === 'pending').length
    const interview = candidates.filter((c) => c.status === 'in_progress').length
    const archive = candidates.filter((c) => ['rejected', 'confirmed'].includes(c.status)).length
    return { Applicant: applicant, Interview: interview, Archive: archive }
  }, [candidates])

  // Get interview stages for selected job
  const interviewStages = useMemo(() => {
    if (!selectedJob) return []
    const job = candidates.find((c) => c.job_posts?.id === selectedJob)
    return job?.job_posts?.processes?.stages || []
  }, [candidates, selectedJob])

  // Filter candidates based on active stage
  const filteredCandidates = useMemo(() => {
    let filtered = candidates

    // Tab-based filtering
    if (activeStage === 'Applicant') {
      filtered = filtered.filter((c) => c.status === 'pending')
    } else if (activeStage === 'Interview') {
      filtered = filtered.filter((c) => c.status === 'in_progress')
      if (activeInterviewStage) {
        filtered = filtered.filter((c) => c.current_stage_id === activeInterviewStage)
      }
    } else if (activeStage === 'Archive') {
      filtered = filtered.filter((c) => ['rejected', 'confirmed'].includes(c.status))
    }

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.job_posts?.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    return filtered
  }, [candidates, activeStage, activeInterviewStage, searchQuery])

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]))
  }

  const toggleAll = () => {
    setSelectedIds(
      selectedIds.length === filteredCandidates.length
        ? []
        : filteredCandidates.map((c) => c.id)
    )
  }

  const handleCandidateClick = (id: string) => {
    if (onCandidateSelect) {
      onCandidateSelect(id)
    } else {
      window.location.href = `/candidates/${id}`
    }
  }

  // Applicant sub-stages (mock data for now)
  const applicantSubStages = [
    { id: 'new-applicant', label: 'New Applicant', count: candidates.filter((c) => c.status === 'pending').length },
    { id: 'screening', label: 'Screening', count: 0 },
    { id: 'hm-review', label: 'HM Review', count: 0 },
  ]

  // Archive reasons (mock data for now)
  const archiveReasons = [
    { id: 'position-filled', label: 'Position Filled', count: 0 },
    { id: 'under-qualified', label: 'Under-qualified', count: 0 },
    { id: 'timing', label: 'Timing', count: 0 },
    { id: 'withdrew', label: 'Withdrew', count: 0 },
  ]

  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar */}
      <div className="w-64 bg-[#08102B] text-white p-6 flex flex-col">
        <div className="flex items-center gap-2 mb-8">
          <VNTGSymbol className="text-[#0248FF]" size={32} />
          <span className="font-medium" style={{ fontFamily: 'Roboto, sans-serif' }}>
            VNTG
          </span>
        </div>

        <div className="mb-6">
          <h3 className="text-sm text-gray-400 mb-3" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
            내 채용 공고
          </h3>
          <div className="space-y-2">
            {jobs.map((job) => (
              <div
                key={job.id}
                onClick={() => {
                  setSelectedJob(job.id)
                  const firstStage = candidates
                    .find((c) => c.job_posts?.id === job.id)
                    ?.job_posts?.processes?.stages?.[0]
                  if (firstStage) {
                    setActiveInterviewStage(firstStage.id)
                  }
                }}
                className={`text-sm p-2 rounded cursor-pointer transition-colors ${
                  selectedJob === job.id
                    ? 'bg-[#0248FF] text-white'
                    : 'hover:bg-[#0f1a3d]'
                }`}
              >
                {job.title}{' '}
                <span className={selectedJob === job.id ? 'text-blue-200' : 'text-gray-400'}>
                  ({candidates.filter((c) => c.job_posts?.id === job.id).length})
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-sm text-gray-400 mb-3" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
            필터
          </h3>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm p-2 rounded hover:bg-[#0f1a3d] cursor-pointer transition-colors">
              <Filter size={16} />
              <span>지원 날짜</span>
            </div>
            <div className="flex items-center gap-2 text-sm p-2 rounded hover:bg-[#0f1a3d] cursor-pointer transition-colors">
              <Filter size={16} />
              <span>평가 점수</span>
            </div>
            <div className="flex items-center gap-2 text-sm p-2 rounded hover:bg-[#0f1a3d] cursor-pointer transition-colors">
              <Filter size={16} />
              <span>AI 분석 상태</span>
            </div>
          </div>
        </div>

        <div className="mt-auto">
          <div className="text-xs text-gray-400 mb-2">Powered by VNTG AI</div>
          <VNTGSymbol className="text-[#0248FF] opacity-20" size={48} />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Navigation */}
        <div className="bg-[#08102B] text-white px-6 py-3">
          <div className="flex items-center gap-6">
            {(['Applicant', 'Interview', 'Archive'] as const).map((stage) => (
              <button
                key={stage}
                onClick={() => setActiveStage(stage)}
                className={`px-4 py-2 rounded-t transition-colors ${
                  activeStage === stage
                    ? 'bg-white text-[#08102B]'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                <span style={{ fontFamily: 'Roboto, sans-serif' }}>{stage}</span>
                <span className="ml-2 px-2 py-0.5 rounded-full bg-[#0248FF] text-white text-xs">
                  {stageCounts[stage]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Search & Actions */}
        <div className="bg-white border-b px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="후보자 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0248FF]"
                style={{ fontFamily: 'Noto Sans KR, sans-serif' }}
              />
            </div>
            <Button
              className="bg-[#0248FF] hover:bg-[#0236cc] text-white"
              style={{ fontFamily: 'Noto Sans KR, sans-serif' }}
            >
              {activeStage === 'Applicant'
                ? 'Add Candidate'
                : activeStage === 'Interview'
                  ? 'Schedule Interview'
                  : 'Smart Action'}
            </Button>
          </div>
        </div>

        {/* Applicant Sub-Stage Filter Bar */}
        {activeStage === 'Applicant' && (
          <div className="bg-white border-b px-6 py-4">
            <div className="flex items-center gap-4">
              {applicantSubStages.map((subStage) => (
                <button
                  key={subStage.id}
                  onClick={() => setActiveApplicantSubStage(subStage.id)}
                  className={`bg-white border rounded-lg p-4 text-center transition-all hover:shadow-md min-w-[140px] ${
                    activeApplicantSubStage === subStage.id
                      ? 'border-[#0248FF] border-b-4 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-3xl mb-2" style={{ fontFamily: 'Roboto, sans-serif' }}>
                    {subStage.count}
                  </div>
                  <div className="text-sm text-gray-700" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                    {subStage.label}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Archive Reason Filter Bar */}
        {activeStage === 'Archive' && (
          <div className="bg-white border-b px-6 py-4">
            <div className="flex items-center gap-4">
              {archiveReasons.map((reason) => (
                <button
                  key={reason.id}
                  onClick={() => setActiveArchiveReason(reason.id)}
                  className={`bg-white border rounded-lg p-4 text-center transition-all hover:shadow-md min-w-[140px] ${
                    activeArchiveReason === reason.id
                      ? 'border-[#0248FF] border-b-4 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-3xl mb-2" style={{ fontFamily: 'Roboto, sans-serif' }}>
                    {reason.count}
                  </div>
                  <div className="text-sm text-gray-700" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                    {reason.label}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Interview Stage Filter Bar */}
        {activeStage === 'Interview' && interviewStages.length > 0 && (
          <div className="bg-white border-b px-6 py-4">
            <div className="flex items-center gap-4 overflow-x-auto">
              {interviewStages.map((stage) => (
                <button
                  key={stage.id}
                  onClick={() => setActiveInterviewStage(stage.id)}
                  className={`bg-white border rounded-lg p-4 text-center transition-all hover:shadow-md min-w-[140px] ${
                    activeInterviewStage === stage.id
                      ? 'border-[#0248FF] border-b-4 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-3xl mb-2" style={{ fontFamily: 'Roboto, sans-serif' }}>
                    {filteredCandidates.filter((c) => c.current_stage_id === stage.id).length}
                  </div>
                  <div className="text-sm text-gray-700" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                    {stage.name}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Candidate List */}
        <div className="flex-1 overflow-auto">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="w-12 p-4">
                  <button onClick={toggleAll}>
                    {selectedIds.length === filteredCandidates.length && filteredCandidates.length > 0 ? (
                      <CheckSquare className="text-[#0248FF]" size={20} />
                    ) : (
                      <Square className="text-gray-400" size={20} />
                    )}
                  </button>
                </th>
                <th className="text-left p-4 text-sm text-gray-600" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                  이름
                </th>
                <th className="text-left p-4 text-sm text-gray-600" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                  포지션
                </th>
                {activeStage === 'Interview' && (
                  <th className="text-left p-4 text-sm text-gray-600" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                    AI 스케줄링 상태
                  </th>
                )}
                {activeStage === 'Applicant' && (
                  <th className="text-left p-4 text-sm text-gray-600" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                    현재 리뷰 상태
                  </th>
                )}
                {activeStage === 'Archive' && (
                  <th className="text-left p-4 text-sm text-gray-600" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                    보관 사유
                  </th>
                )}
                <th className="text-left p-4 text-sm text-gray-600" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                  지원일
                </th>
                <th className="w-12 p-4"></th>
              </tr>
            </thead>
            <tbody>
              {filteredCandidates.length > 0 ? (
                filteredCandidates.map((candidate) => (
                  <tr
                    key={candidate.id}
                    className="border-b hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => handleCandidateClick(candidate.id)}
                  >
                    <td className="p-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleSelection(candidate.id)
                        }}
                      >
                        {selectedIds.includes(candidate.id) ? (
                          <CheckSquare className="text-[#0248FF]" size={20} />
                        ) : (
                          <Square className="text-gray-400" size={20} />
                        )}
                      </button>
                    </td>
                    <td className="p-4">
                      <div style={{ fontFamily: 'Roboto, sans-serif' }}>{candidate.name}</div>
                      <div className="text-sm text-gray-500">{candidate.email}</div>
                    </td>
                    <td className="p-4 text-sm" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                      {candidate.job_posts?.title || 'N/A'}
                    </td>
                    {activeStage === 'Interview' && (
                      <td className="p-4">
                        <Badge className="bg-[#5287FF] text-white hover:bg-[#5287FF]">
                          Pending
                        </Badge>
                      </td>
                    )}
                    {activeStage === 'Applicant' && (
                      <td className="p-4">
                        <Badge className="bg-gray-100 text-gray-700">Pending</Badge>
                      </td>
                    )}
                    {activeStage === 'Archive' && (
                      <td className="p-4">
                        <Badge className="bg-gray-200 text-gray-700">
                          {candidate.status === 'rejected' ? 'Rejected' : 'Confirmed'}
                        </Badge>
                      </td>
                    )}
                    <td className="p-4 text-sm text-gray-600">
                      {new Date(candidate.created_at).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="p-4">
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <MoreVertical size={20} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-gray-500">
                    <p style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                      {activeStage === 'Applicant' && '신규 지원자가 없습니다.'}
                      {activeStage === 'Interview' && '면접 진행 중인 후보자가 없습니다.'}
                      {activeStage === 'Archive' && '보관된 후보자가 없습니다.'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
