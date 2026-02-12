'use client'

import { useState, useMemo, useEffect } from 'react'
import { useSearchParams, usePathname } from 'next/navigation'
import { Search, Filter, MoreVertical, CheckSquare, Square, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { VNTGSymbol } from '@/components/vntg/VNTGSymbol'
import { StageCards } from './StageCards'
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
  processes?: {
    stages?: Array<{ id: string; name: string }>
  }
}

interface CandidateDashboardProps {
  candidates: Candidate[]
  jobs: Job[]
  onCandidateSelect?: (id: string) => void
}

export function CandidateDashboard({ candidates, jobs, onCandidateSelect }: CandidateDashboardProps) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const tabParam = searchParams.get('tab')
  
  // URL 파라미터에서 탭 정보를 읽어서 초기 상태 설정
  const getInitialStage = (): 'Applicant' | 'Interview' | 'Archive' => {
    if (tabParam === 'applicant') return 'Applicant'
    if (tabParam === 'interview') return 'Interview'
    if (tabParam === 'archive') return 'Archive'
    return 'Interview' // 기본값
  }
  
  const [activeStage, setActiveStage] = useState<'Applicant' | 'Interview' | 'Archive'>(getInitialStage())
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [activeApplicantSubStage, setActiveApplicantSubStage] = useState('new-applicant')
  const [activeArchiveReason, setActiveArchiveReason] = useState('position-filled')
  const [selectedJob, setSelectedJob] = useState<string | null>(null) // null = 모든 채용 공고
  const [activeInterviewStage, setActiveInterviewStage] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // URL 파라미터가 변경되면 activeStage 업데이트
  useEffect(() => {
    if (tabParam === 'applicant') {
      setActiveStage('Applicant')
    } else if (tabParam === 'interview') {
      setActiveStage('Interview')
    } else if (tabParam === 'archive') {
      setActiveStage('Archive')
    } else {
      setActiveStage('Interview') // 기본값
    }
  }, [tabParam])

  // Calculate stage counts based on selectedJob
  const stageCounts = useMemo(() => {
    let filtered = candidates
    
    // Filter by selected job if one is selected
    if (selectedJob) {
      filtered = filtered.filter((c) => c.job_posts?.id === selectedJob)
    }
    
    const applicant = filtered.filter((c) => c.status === 'pending').length
    const interview = filtered.filter((c) => c.status === 'in_progress').length
    const archive = filtered.filter((c) => ['rejected', 'confirmed'].includes(c.status)).length
    return { Applicant: applicant, Interview: interview, Archive: archive }
  }, [candidates, selectedJob])
  
  // Calculate job-specific counts for sidebar (based on activeStage)
  const getJobCandidateCount = (jobId: string) => {
    let filtered = candidates.filter((c) => c.job_posts?.id === jobId)
    
    // Filter by active stage
    if (activeStage === 'Applicant') {
      filtered = filtered.filter((c) => c.status === 'pending')
    } else if (activeStage === 'Interview') {
      filtered = filtered.filter((c) => c.status === 'in_progress')
    } else if (activeStage === 'Archive') {
      filtered = filtered.filter((c) => ['rejected', 'confirmed'].includes(c.status))
    }
    
    return filtered.length
  }

  // Get interview stages for selected job (or first job if all jobs selected)
  const interviewStages = useMemo(() => {
    const jobToUse = selectedJob || jobs[0]?.id
    if (!jobToUse) {
      return []
    }
    
    // First try to get from jobs data directly
    const selectedJobData = jobs.find((j) => j.id === jobToUse)
    if (!selectedJobData) {
      return []
    }
    
    // Handle processes - could be array or single object
    let processes = selectedJobData.processes
    if (Array.isArray(processes)) {
      processes = processes[0] // Take first process if array
    }
    
    if (processes?.stages) {
      let stages = processes.stages
      
      // Handle JSONB - might be string or already parsed
      if (typeof stages === 'string') {
        try {
          stages = JSON.parse(stages)
        } catch (e) {
          console.error('Failed to parse stages:', e)
          return []
        }
      }
      
      // Ensure stages is an array
      if (Array.isArray(stages) && stages.length > 0) {
        return stages
      }
    }
    
    // Fallback: try to get stages from candidates
    const candidateWithJob = candidates.find((c) => c.job_posts?.id === jobToUse)
    if (candidateWithJob?.job_posts?.processes) {
      let candidateProcesses = candidateWithJob.job_posts.processes
      if (Array.isArray(candidateProcesses)) {
        candidateProcesses = candidateProcesses[0]
      }
      
      if (candidateProcesses?.stages) {
        let stages = candidateProcesses.stages
        
        // Handle JSONB - might be string or already parsed
        if (typeof stages === 'string') {
          try {
            stages = JSON.parse(stages)
          } catch (e) {
            console.error('Failed to parse stages from candidate:', e)
            return []
          }
        }
        
        // Ensure stages is an array
        if (Array.isArray(stages) && stages.length > 0) {
          return stages
        }
      }
    }
    
    return []
  }, [jobs, candidates, selectedJob])
  
  // Get all unique interview stages from all jobs when "모든 채용 공고" is selected
  const allInterviewStages = useMemo(() => {
    if (selectedJob) {
      return interviewStages
    }
    
    // Collect all stages from all jobs
    const allStages: any[] = []
    const stageIds = new Set<string>()
    
    jobs.forEach((job) => {
      let processes = job.processes
      if (Array.isArray(processes)) {
        processes = processes[0]
      }
      
      if (processes?.stages) {
        let stages = processes.stages
        if (typeof stages === 'string') {
          try {
            stages = JSON.parse(stages)
          } catch (e) {
            return
          }
        }
        
        if (Array.isArray(stages)) {
          stages.forEach((stage: any) => {
            if (!stageIds.has(stage.id)) {
              stageIds.add(stage.id)
              allStages.push(stage)
            }
          })
        }
      }
    })
    
    return allStages.sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
  }, [jobs, selectedJob, interviewStages])

  // Auto-select first stage when interviewStages change or Interview tab is selected
  useEffect(() => {
    if (activeStage === 'Interview') {
      const stagesToUse = selectedJob ? interviewStages : allInterviewStages
      if (stagesToUse.length > 0) {
        // If no stage is selected or selected stage is not in current stages, select first one
        if (!activeInterviewStage || !stagesToUse.find((s: any) => s.id === activeInterviewStage)) {
          setActiveInterviewStage(stagesToUse[0].id)
        }
      }
    }
  }, [activeStage, interviewStages, allInterviewStages, activeInterviewStage, selectedJob])

  // Filter candidates based on active stage and selected job
  const filteredCandidates = useMemo(() => {
    let filtered = candidates

    // Filter by selected job if one is selected
    if (selectedJob) {
      filtered = filtered.filter((c) => c.job_posts?.id === selectedJob)
    }

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
  }, [candidates, activeStage, activeInterviewStage, searchQuery, selectedJob])

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
      {/* Sidebar - Same as JobsPageClient */}
      <div className="w-64 bg-[#08102B] text-white p-6 flex flex-col">
        <div className="flex items-center gap-2 mb-8">
          <VNTGSymbol className="text-[#0248FF]" size={32} />
          <span className="font-medium" style={{ fontFamily: 'Roboto, sans-serif' }}>
            VNTG
          </span>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm text-gray-400" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
              내 채용 공고
            </h3>
            <Link
              href="/jobs/new"
              className="text-[#0248FF] hover:text-[#0236cc] transition-colors"
              title="새 포지션 생성"
            >
              <Plus size={18} />
            </Link>
          </div>
          <div className="space-y-2">
            {/* 모든 채용 공고 옵션 */}
            <div
              onClick={() => {
                setSelectedJob(null)
                setActiveInterviewStage(null)
              }}
              className={`text-sm p-2 rounded cursor-pointer transition-colors ${
                selectedJob === null
                  ? 'bg-[#0248FF] text-white'
                  : 'hover:bg-[#0f1a3d]'
              }`}
            >
              모든 채용 공고{' '}
              <span className={selectedJob === null ? 'text-blue-200' : 'text-gray-400'}>
                ({stageCounts[activeStage]})
              </span>
            </div>
            {jobs.map((job) => (
              <div
                key={job.id}
                onClick={() => {
                  setSelectedJob(job.id)
                  // Reset active interview stage - useEffect will auto-select first one
                  setActiveInterviewStage(null)
                }}
                className={`text-sm p-2 rounded cursor-pointer transition-colors ${
                  selectedJob === job.id
                    ? 'bg-[#0248FF] text-white'
                    : 'hover:bg-[#0f1a3d]'
                }`}
              >
                {job.title}{' '}
                <span className={selectedJob === job.id ? 'text-blue-200' : 'text-gray-400'}>
                  ({getJobCandidateCount(job.id)})
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
        {/* Top Navigation - Same as JobsPageClient */}
        <div className="bg-[#08102B] text-white px-6 py-3">
          <div className="flex items-center gap-6">
            <Link
              href="/jobs"
              className={`px-4 py-2 rounded-t transition-colors ${
                pathname === '/jobs' || pathname?.startsWith('/jobs/')
                  ? 'bg-white text-[#08102B]'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              <span style={{ fontFamily: 'Roboto, sans-serif' }}>Jobs</span>
              <span className="ml-2 px-2 py-0.5 rounded-full bg-[#0248FF] text-white text-xs">
                {jobs.length}
              </span>
            </Link>
            {(['Applicant', 'Interview', 'Archive'] as const).map((stage) => {
              const isActive = activeStage === stage || (!tabParam && stage === 'Interview')
              return (
                <Link
                  key={stage}
                  href={`/?tab=${stage.toLowerCase()}`}
                  className={`px-4 py-2 rounded-t transition-colors ${
                    isActive
                      ? 'bg-white text-[#08102B]'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  <span style={{ fontFamily: 'Roboto, sans-serif' }}>{stage}</span>
                  <span className="ml-2 px-2 py-0.5 rounded-full bg-[#0248FF] text-white text-xs">
                    {stageCounts[stage]}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Candidate Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Search & Actions */}
          <div className="bg-white border-b px-6 py-4 flex-shrink-0">
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
              <div className="flex items-center gap-2">
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

          {/* Interview Stage Cards */}
          {activeStage === 'Interview' && (
            (selectedJob ? interviewStages : allInterviewStages).length > 0 ? (
              <StageCards
                stages={selectedJob ? interviewStages : allInterviewStages}
                candidates={candidates.filter((c) => c.status === 'in_progress')}
                activeStage={activeInterviewStage}
                onStageSelect={setActiveInterviewStage}
              />
            ) : selectedJob ? (
              <div className="bg-white border-b px-6 py-4">
                <div className="flex items-center gap-4 overflow-x-auto">
                  <div className="bg-white border border-gray-200 rounded-lg p-4 text-center min-w-[140px] flex-shrink-0 opacity-50">
                    <div className="text-3xl mb-2 text-gray-400" style={{ fontFamily: 'Roboto, sans-serif' }}>0</div>
                    <div className="text-sm text-gray-400" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                      단계 없음
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                  선택한 채용 공고에 대한 면접 단계 정보가 없습니다. 워크플로우를 설정해주세요.
                </p>
              </div>
            ) : (
              <div className="bg-white border-b px-6 py-4">
                <p className="text-sm text-gray-500" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                  채용 공고를 선택해주세요.
                </p>
              </div>
            )
          )}

          {/* Candidate List */}
          <div className="flex-1 overflow-auto bg-gray-50">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="w-12 p-4">
                    <button onClick={toggleAll} className="hover:opacity-70 transition-opacity">
                      {selectedIds.length === filteredCandidates.length && filteredCandidates.length > 0 ? (
                        <CheckSquare className="text-[#0248FF]" size={20} />
                      ) : (
                        <Square className="text-gray-400" size={20} />
                      )}
                    </button>
                  </th>
                  <th className="text-left p-4 text-sm font-medium text-gray-600" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                    이름
                  </th>
                  <th className="text-left p-4 text-sm font-medium text-gray-600" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                    포지션
                  </th>
                  {activeStage === 'Interview' && (
                    <th className="text-left p-4 text-sm font-medium text-gray-600" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                      AI 스케줄링 상태
                    </th>
                  )}
                  {activeStage === 'Applicant' && (
                    <th className="text-left p-4 text-sm font-medium text-gray-600" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                      현재 리뷰 상태
                    </th>
                  )}
                  {activeStage === 'Archive' && (
                    <th className="text-left p-4 text-sm font-medium text-gray-600" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                      보관 사유
                    </th>
                  )}
                  <th className="text-left p-4 text-sm font-medium text-gray-600" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
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
                      className="border-b border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
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
                          <Badge
                            className={
                              'bg-gray-400 text-white hover:bg-gray-400'
                            }
                          >
                            Internal Sync
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
                        {(() => {
                          const date = new Date(candidate.created_at)
                          const year = date.getFullYear()
                          const month = date.getMonth() + 1
                          const day = date.getDate()
                          return `${year}. ${month}. ${day}.`
                        })()}
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
                    <td colSpan={6} className="p-12 text-center text-gray-500">
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
    </div>
  )
}
