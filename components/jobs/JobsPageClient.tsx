'use client'

import { useState } from 'react'
import { Filter, Plus } from 'lucide-react'
import { VNTGSymbol } from '@/components/vntg/VNTGSymbol'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'

interface Job {
  id: string
  title: string
  description?: string | null
  created_at: string
  processes?: {
    name: string
  } | null
}

interface Candidate {
  id: string
  status: string
}

interface JobsPageClientProps {
  jobs: Job[]
  allJobs: Job[] // For sidebar job list
  candidates?: Candidate[]
}

export function JobsPageClient({ jobs, allJobs, candidates = [] }: JobsPageClientProps) {
  // Calculate stage counts (same as CandidateDashboard)
  const stageCounts = {
    Applicant: candidates.filter((c) => c.status === 'pending').length,
    Interview: candidates.filter((c) => c.status === 'in_progress').length,
    Archive: candidates.filter((c) => ['rejected', 'confirmed'].includes(c.status)).length,
  }

  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar - Same as CandidateDashboard */}
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
            {allJobs.map((job) => (
              <Link
                key={job.id}
                href={`/jobs/${job.id}`}
                className="block text-sm p-2 rounded cursor-pointer transition-colors hover:bg-[#0f1a3d]"
              >
                {job.title}
              </Link>
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
        {/* Top Navigation - Same as CandidateDashboard */}
        <div className="bg-[#08102B] text-white px-6 py-3">
          <div className="flex items-center gap-6">
            <Link
              href="/jobs"
              className="px-4 py-2 rounded-t transition-colors bg-white text-[#08102B]"
            >
              <span style={{ fontFamily: 'Roboto, sans-serif' }}>Jobs</span>
              <span className="ml-2 px-2 py-0.5 rounded-full bg-[#0248FF] text-white text-xs">
                {jobs.length}
              </span>
            </Link>
            {(['Applicant', 'Interview', 'Archive'] as const).map((stage) => (
              <Link
                key={stage}
                href={`/?tab=${stage.toLowerCase()}`}
                className="px-4 py-2 rounded-t transition-colors text-gray-300 hover:text-white"
              >
                <span style={{ fontFamily: 'Roboto, sans-serif' }}>{stage}</span>
                <span className="ml-2 px-2 py-0.5 rounded-full bg-[#0248FF] text-white text-xs">
                  {stageCounts[stage]}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Jobs Content */}
        <div className="flex-1 overflow-auto bg-gray-50 p-8">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                채용 공고
              </h1>
              <Link
                href="/jobs/new"
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                style={{ fontFamily: 'Noto Sans KR, sans-serif' }}
              >
                새 공고 만들기
              </Link>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {jobs.map((job) => (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="rounded-lg border bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
                >
                  <h3 className="text-lg font-semibold text-gray-900" style={{ fontFamily: 'Roboto, sans-serif' }}>
                    {job.title}
                  </h3>
                  {job.description && (
                    <p className="mt-2 text-sm text-gray-600 line-clamp-2" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                      {job.description}
                    </p>
                  )}
                  <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
                    <span>{formatDate(job.created_at)}</span>
                    <span>{job.processes?.name || '프로세스 없음'}</span>
                  </div>
                </Link>
              ))}
            </div>

            {jobs.length === 0 && (
              <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
                <p className="text-gray-500" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                  아직 채용 공고가 없습니다.
                </p>
                <Link
                  href="/jobs/new"
                  className="mt-4 inline-block text-blue-600 hover:text-blue-700"
                  style={{ fontFamily: 'Noto Sans KR, sans-serif' }}
                >
                  첫 공고 만들기
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
