import { createClient } from '@/lib/supabase/server'
import { getCandidate } from '@/actions/candidates'
import { redirect } from 'next/navigation'
import { TimelineView } from '@/components/timeline/TimelineView'
import { CandidateHeader } from '@/components/candidates/CandidateHeader'
import { AIAnalysisGrid } from '@/components/candidates/AIAnalysisGrid'
import { AttachedDocuments } from '@/components/candidates/AttachedDocuments'
import { AISchedulingProgress } from '@/components/candidates/AISchedulingProgress'
import { VNTGSymbol } from '@/components/vntg/VNTGSymbol'
import Link from 'next/link'

export default async function CandidateDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 개발 모드: 인증 체크 비활성화
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  if (!isDevelopment && !user) {
    redirect('/login')
  }

  const candidate = await getCandidate(params.id)
  const jobPost = candidate.job_posts as any

  // Get schedules
  const { data: schedules } = await supabase
    .from('schedules')
    .select('*')
    .eq('candidate_id', params.id)
    .order('created_at', { ascending: false })

  // Get timeline events
  const { data: timelineEvents } = await supabase
    .from('timeline_events')
    .select('*, users(email)')
    .eq('candidate_id', params.id)
    .order('created_at', { ascending: false })

  // Get schedule with interviewers for AI Scheduling Progress
  const latestSchedule = schedules && schedules.length > 0 ? schedules[0] : null
  let scheduleWithInterviewers = null
  if (latestSchedule) {
    // Fetch interviewer details
    const { data: interviewers } = await supabase
      .from('users')
      .select('id, email')
      .in('id', latestSchedule.interviewer_ids || [])
    
    scheduleWithInterviewers = {
      id: latestSchedule.id,
      status: latestSchedule.status,
      interviewers: interviewers?.map((inv) => ({
        id: inv.id,
        name: inv.email.split('@')[0], // Mock name from email
        email: inv.email,
        status: 'pending' as const, // TODO: Get actual status from schedule_options
      })) || [],
      progress: {
        step: 1, // TODO: Calculate from actual status
        total: latestSchedule.interviewer_ids?.length || 0,
        accepted: 0, // TODO: Get from actual data
      },
    }
  }

  return (
    <div className="flex min-h-screen bg-white">
      {/* Sticky Dimmed Sidebar - 화면 스크롤 시에도 고정 */}
      <div className="w-64 bg-[#2D2D2D] text-white p-6 sticky top-0 h-screen">
        <div className="flex h-full flex-col">
          <div className="mb-8">
            <VNTGSymbol className="text-white" />
          </div>
          <nav className="flex-1 space-y-1">
            <Link
              href="/"
              className="block rounded-md px-3 py-2 text-sm font-medium text-gray-300 hover:bg-[#3D3D3D] transition-colors"
              style={{ fontFamily: 'Noto Sans KR, sans-serif' }}
            >
              대시보드
            </Link>
            <Link
              href="/jobs"
              className="block rounded-md px-3 py-2 text-sm font-medium text-gray-300 hover:bg-[#3D3D3D] transition-colors"
              style={{ fontFamily: 'Noto Sans KR, sans-serif' }}
            >
              채용 공고
            </Link>
            <Link
              href="/candidates"
              className="block rounded-md px-3 py-2 text-sm font-medium text-gray-300 hover:bg-[#3D3D3D] transition-colors"
              style={{ fontFamily: 'Noto Sans KR, sans-serif' }}
            >
              후보자
            </Link>
          </nav>
        </div>
      </div>

      {/* Main Content - Natural Window-Level Scroll */}
      <div className="flex-1">
        {/* Sticky Top Nav */}
        <div className="sticky top-0 z-10 bg-[#08102B] border-b border-[#1a1f3a] px-8 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
              후보자 상세
            </h2>
            <Link
              href={`/candidates/${params.id}/schedule`}
              className="rounded-md bg-[#0248FF] px-4 py-2 text-sm font-medium text-white hover:bg-[#0238CC] transition-colors"
              style={{ fontFamily: 'Noto Sans KR, sans-serif' }}
            >
              일정 조율
            </Link>
          </div>
        </div>

        {/* Scrollable Content Sections */}
        <div className="px-8 py-6 space-y-8">
          {/* Candidate Header */}
          <CandidateHeader candidate={{ ...candidate, job_posts: jobPost }} />

          {/* AI Analysis Data (2x2 Grid) */}
          <div>
            <h2 className="mb-4 text-lg font-semibold text-gray-900" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
              AI 분석 데이터
            </h2>
            <AIAnalysisGrid candidate={candidate} />
          </div>

          {/* Attached Documents */}
          <AttachedDocuments />

          {/* AI Scheduling Progress (Collapsible Accordion) */}
          {scheduleWithInterviewers && (
            <AISchedulingProgress schedule={scheduleWithInterviewers} />
          )}

          {/* Timeline */}
          <div>
            <h2 className="mb-4 text-lg font-semibold text-gray-900" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
              타임라인
            </h2>
            <TimelineView events={timelineEvents || []} />
          </div>
        </div>
      </div>
    </div>
  )
}
