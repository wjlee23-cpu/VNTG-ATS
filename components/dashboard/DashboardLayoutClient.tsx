'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { LogoutButton } from '@/components/dashboard/LogoutButton'
import { VNTGSymbol } from '@/components/vntg/VNTGSymbol'
import { useMemo, useState, useEffect } from 'react'
import { Filter, Plus } from 'lucide-react'

interface DashboardLayoutClientProps {
  children: React.ReactNode
  userEmail?: string
  hasUser: boolean
  isDevelopment: boolean
  candidates?: any[]
  jobs?: any[]
}

export function DashboardLayoutClient({
  children,
  userEmail,
  hasUser,
  isDevelopment,
  candidates = [],
  jobs = [],
}: DashboardLayoutClientProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isJobNewPage = pathname === '/jobs/new'
  const isCandidateDetailPage = pathname?.startsWith('/candidates/')
  const [selectedJob, setSelectedJob] = useState<string | null>(null)

  // Get active tab from URL or default
  const activeTab = useMemo(() => {
    const tabParam = searchParams?.get('tab')
    if (tabParam === 'applicant') return 'Applicant'
    if (tabParam === 'interview') return 'Interview'
    if (tabParam === 'archive') return 'Archive'
    return 'Interview' // 기본값
  }, [searchParams])

  // Calculate stage counts
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
  
  // Calculate job-specific counts for sidebar (based on activeTab)
  const getJobCandidateCount = (jobId: string) => {
    let filtered = candidates.filter((c) => c.job_posts?.id === jobId)
    
    // Filter by active tab
    if (activeTab === 'Applicant') {
      filtered = filtered.filter((c) => c.status === 'pending')
    } else if (activeTab === 'Interview') {
      filtered = filtered.filter((c) => c.status === 'in_progress')
    } else if (activeTab === 'Archive') {
      filtered = filtered.filter((c) => ['rejected', 'confirmed'].includes(c.status))
    }
    
    return filtered.length
  }

  return (
    <div className="flex h-screen bg-white" style={{ position: 'relative', width: '100%', height: '100vh' }}>
      {/* Sidebar */}
      <aside
        className="w-64 bg-[#08102B] shadow-lg flex-shrink-0"
        style={{ position: 'relative', zIndex: 10 }}
      >
        <div className="flex h-full flex-col p-6 text-white">
          <div className="flex items-center gap-2 mb-8">
            <VNTGSymbol className="text-[#0248FF]" size={32} />
            <span className="font-medium text-white" style={{ fontFamily: 'Roboto, sans-serif' }}>
              VNTG
            </span>
          </div>

          {isCandidateDetailPage || isJobNewPage ? (
            <>
              {/* Candidate Detail / Job New Sidebar - Same as CandidateDashboard */}
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
                    onClick={() => setSelectedJob(null)}
                    className={`text-sm p-2 rounded cursor-pointer transition-colors ${
                      selectedJob === null
                        ? 'bg-[#0248FF] text-white'
                        : 'text-white hover:bg-[#0f1a3d]'
                    }`}
                  >
                    모든 채용 공고{' '}
                    <span className={selectedJob === null ? 'text-blue-200' : 'text-gray-300'}>
                      ({stageCounts[activeTab]})
                    </span>
                  </div>
                  {jobs.map((job) => (
                    <div
                      key={job.id}
                      onClick={() => setSelectedJob(job.id)}
                      className={`text-sm p-2 rounded cursor-pointer transition-colors ${
                        selectedJob === job.id
                          ? 'bg-[#0248FF] text-white'
                          : 'text-white hover:bg-[#0f1a3d]'
                      }`}
                    >
                      {job.title}{' '}
                      <span className={selectedJob === job.id ? 'text-blue-200' : 'text-gray-300'}>
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
                  <div className="flex items-center gap-2 text-sm text-white p-2 rounded hover:bg-[#0f1a3d] cursor-pointer transition-colors">
                    <Filter size={16} className="text-white" />
                    <span>지원 날짜</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-white p-2 rounded hover:bg-[#0f1a3d] cursor-pointer transition-colors">
                    <Filter size={16} className="text-white" />
                    <span>평가 점수</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-white p-2 rounded hover:bg-[#0f1a3d] cursor-pointer transition-colors">
                    <Filter size={16} className="text-white" />
                    <span>AI 분석 상태</span>
                  </div>
                </div>
              </div>

              <div className="mt-auto">
                <div className="text-xs text-gray-400 mb-2">Powered by VNTG AI</div>
                <VNTGSymbol className="text-[#0248FF] opacity-20" size={48} />
              </div>
            </>
          ) : (
            <>
              {/* Default Sidebar */}
              <nav className="flex-1 space-y-1">
                <Link
                  href="/"
                  className="block rounded-md px-3 py-2 text-sm font-medium text-white hover:bg-[#1a1f3a] transition-colors"
                  style={{ fontFamily: 'Noto Sans KR, sans-serif' }}
                >
                  대시보드
                </Link>
                <Link
                  href="/jobs"
                  className="block rounded-md px-3 py-2 text-sm font-medium text-white hover:bg-[#1a1f3a] transition-colors"
                  style={{ fontFamily: 'Noto Sans KR, sans-serif' }}
                >
                  채용 공고
                </Link>
                <Link
                  href="/"
                  className="block rounded-md px-3 py-2 text-sm font-medium text-white hover:bg-[#1a1f3a] transition-colors"
                  style={{ fontFamily: 'Noto Sans KR, sans-serif' }}
                >
                  후보자
                </Link>
              </nav>
              <div className="border-t border-[#1a1f3a] pt-4">
                <div className="mb-2 text-sm text-gray-300" style={{ fontFamily: 'Roboto, sans-serif' }}>
                  {userEmail || 'dev@example.com'}
                </div>
                {hasUser && <LogoutButton />}
                {!hasUser && isDevelopment && (
                  <div className="text-xs text-yellow-400" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                    개발 모드 (인증 없음)
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navigation Bar */}
        <div className="bg-[#08102B] text-white px-6 py-3 flex-shrink-0" style={{ position: 'relative', zIndex: 10 }}>
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
                const isActive = activeTab === stage || (!activeTab && pathname === '/' && stage === 'Interview')
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

        {/* Main content area */}
        <main className="flex-1 overflow-hidden bg-gray-50 p-0" style={{ minHeight: 0, maxHeight: '100%', display: 'flex', flexDirection: 'column' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
