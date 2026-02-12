'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { LogoutButton } from '@/components/dashboard/LogoutButton'
import { VNTGSymbol } from '@/components/vntg/VNTGSymbol'
import { useMemo } from 'react'

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

  // Calculate stage counts
  const stageCounts = useMemo(() => {
    const applicant = candidates.filter((c) => c.status === 'pending').length
    const interview = candidates.filter((c) => c.status === 'in_progress').length
    const archive = candidates.filter((c) => ['rejected', 'confirmed'].includes(c.status)).length
    return { Applicant: applicant, Interview: interview, Archive: archive }
  }, [candidates])

  // Get active tab from URL or default
  const activeTab = useMemo(() => {
    const tabParam = searchParams?.get('tab')
    if (tabParam === 'applicant') return 'Applicant'
    if (tabParam === 'interview') return 'Interview'
    if (tabParam === 'archive') return 'Archive'
    return null
  }, [searchParams])

  return (
    <div className="flex h-screen bg-white" style={{ position: 'relative', width: '100%', height: '100vh' }}>
      {/* Sidebar */}
      <aside
        className={`w-64 bg-[#08102B] shadow-lg transition-opacity flex-shrink-0 ${
          isJobNewPage ? 'opacity-50' : 'opacity-100'
        }`}
        style={{ position: 'relative', zIndex: 10 }}
      >
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center border-b border-[#1a1f3a] px-6">
            <VNTGSymbol />
          </div>
          <nav className="flex-1 space-y-1 px-3 py-4">
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
          <div className="border-t border-[#1a1f3a] p-4">
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
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navigation Bar */}
        {!isJobNewPage && (
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
        )}

        {/* Main content area */}
        <main className={`flex-1 overflow-hidden bg-gray-50 ${isJobNewPage ? 'p-0' : 'p-0'}`} style={{ minHeight: 0, maxHeight: '100%', display: 'flex', flexDirection: 'column' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
