import { createClient } from '@/lib/supabase/server'
import { getCandidate } from '@/actions/candidates'
import { redirect } from 'next/navigation'
import { CandidateDetailClient } from '@/components/candidates/CandidateDetailClient'
import Link from 'next/link'

export default async function CandidateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 개발 모드: 인증 체크 비활성화
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  if (!isDevelopment && !user) {
    redirect('/login')
  }

  const candidate = await getCandidate(id)
  const jobPost = candidate.job_posts as any

  // Get schedules
  const { data: schedules } = await supabase
    .from('schedules')
    .select('*')
    .eq('candidate_id', id)
    .order('created_at', { ascending: false })

  // Get timeline events
  const { data: timelineEvents } = await supabase
    .from('timeline_events')
    .select('*, users(email)')
    .eq('candidate_id', id)
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
    <CandidateDetailClient
      candidate={candidate}
      jobPost={jobPost}
      schedules={schedules || []}
      timelineEvents={timelineEvents || []}
      scheduleWithInterviewers={scheduleWithInterviewers}
    />
  )
}
