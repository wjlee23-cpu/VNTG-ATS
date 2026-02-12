'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getBusyTimes, refreshAccessToken } from '@/lib/calendar/google'
import { findAvailableTimeSlots, generateScheduleMessage, ScheduleOption } from '@/lib/ai/schedule'
import { addDays, startOfDay } from 'date-fns'

export async function createScheduleRequest(data: {
  candidateId: string
  stageId: string
  startDate: Date
  endDate: Date
  durationMinutes?: number
}) {
  const supabase = await createClient()
  const serviceClient = createServiceClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  // Get candidate and job post info
  const { data: candidate } = await supabase
    .from('candidates')
    .select('*, job_posts(*, processes(*))')
    .eq('id', data.candidateId)
    .single()

  if (!candidate) {
    throw new Error('Candidate not found')
  }

  const processInfo = (candidate.job_posts as any).processes
  const stages = (processInfo?.stages as any) || []
  const stage = stages.find((s: any) => s.id === data.stageId)

  if (!stage) {
    throw new Error('Stage not found')
  }

  // Get interviewer calendar tokens
  const { data: interviewers } = await supabase
    .from('users')
    .select('id, calendar_access_token, calendar_refresh_token, calendar_provider')
    .in('id', stage.interviewer_ids || [])

  if (!interviewers || interviewers.length === 0) {
    throw new Error('No interviewers assigned to this stage')
  }

  // Fetch busy times from all interviewer calendars
  const allBusyTimes: any[] = []
  for (const interviewer of interviewers) {
    if (interviewer.calendar_provider === 'google' && interviewer.calendar_access_token) {
      try {
        let accessToken = interviewer.calendar_access_token

        // Try to refresh token if needed
        if (interviewer.calendar_refresh_token) {
          try {
            accessToken = await refreshAccessToken(interviewer.calendar_refresh_token)
            // Update token in database
            await serviceClient
              .from('users')
              .update({ calendar_access_token: accessToken })
              .eq('id', interviewer.id)
          } catch (error) {
            console.error(`Failed to refresh token for ${interviewer.id}:`, error)
          }
        }

        const busyTimes = await getBusyTimes(
          accessToken,
          ['primary'],
          data.startDate,
          data.endDate
        )
        allBusyTimes.push(...busyTimes)
      } catch (error) {
        console.error(`Failed to fetch calendar for ${interviewer.id}:`, error)
      }
    }
  }

  // Find available time slots using AI
  const options = await findAvailableTimeSlots(
    {
      candidateName: candidate.name,
      stageName: stage.name,
      interviewerIds: stage.interviewer_ids || [],
      busyTimes: allBusyTimes,
      startDate: data.startDate,
      endDate: data.endDate,
      durationMinutes: data.durationMinutes || 60,
    },
    'openai' // Can be made configurable
  )

  if (options.length === 0) {
    throw new Error('No available time slots found')
  }

  // Create schedule record
  const { data: schedule, error: scheduleError } = await (serviceClient as any)
    .from('schedules')
    .insert({
      candidate_id: data.candidateId,
      stage_id: data.stageId,
      scheduled_at: options[0].scheduledAt.toISOString(), // Default to first option
      duration_minutes: data.durationMinutes || 60,
      status: 'pending',
      interviewer_ids: stage.interviewer_ids || [],
      candidate_response: 'pending',
    })
    .select()
    .single()

  if (scheduleError) {
    throw new Error(scheduleError.message)
  }

  // Create schedule options
  for (const option of options) {
    await (serviceClient as any).from('schedule_options').insert({
      schedule_id: schedule.id,
      scheduled_at: option.scheduledAt.toISOString(),
      status: 'pending',
    })
  }

  // Generate and store message (for email sending later)
  const message = await generateScheduleMessage(candidate.name, options, 'openai')

  // Create timeline event
  await (serviceClient as any).from('timeline_events').insert({
    candidate_id: data.candidateId,
    type: 'schedule_created',
    content: {
      schedule_id: schedule.id,
      options: options.map((opt) => ({
        scheduledAt: opt.scheduledAt.toISOString(),
        duration: opt.duration,
      })),
      message,
    },
    created_by: user?.id || null,
  })

  revalidatePath(`/candidates/${data.candidateId}`)
  revalidatePath(`/candidates/${data.candidateId}/schedule`)

  return { schedule, options, message }
}

export async function confirmScheduleOption(
  scheduleId: string,
  optionId: string,
  beveragePreference?: string
) {
  const serviceClient = createServiceClient()

  // Get the selected option
  const { data: option } = await serviceClient
    .from('schedule_options')
    .select('*, schedules(*)')
    .eq('id', optionId)
    .eq('schedule_id', scheduleId)
    .single()

  if (!option) {
    throw new Error('Schedule option not found')
  }

  // Update schedule
  const { data: schedule, error } = await (serviceClient as any)
    .from('schedules')
    .update({
      scheduled_at: option.scheduled_at,
      status: 'confirmed',
      candidate_response: 'accepted',
      beverage_preference: beveragePreference || null,
    })
    .eq('id', scheduleId)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  // Mark option as selected
  await (serviceClient as any)
    .from('schedule_options')
    .update({ status: 'selected' })
    .eq('id', optionId)

  // Mark other options as rejected
  await (serviceClient as any)
    .from('schedule_options')
    .update({ status: 'rejected' })
    .eq('schedule_id', scheduleId)
    .neq('id', optionId)

  // Create timeline event
  await (serviceClient as any).from('timeline_events').insert({
    candidate_id: (option.schedules as any).candidate_id,
    type: 'schedule_confirmed',
    content: {
      schedule_id: scheduleId,
      scheduled_at: option.scheduled_at,
      beverage_preference: beveragePreference,
    },
  })

  revalidatePath(`/candidates/${(option.schedules as any).candidate_id}`)

  return schedule
}

export async function getScheduleOptions(scheduleId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const { data, error } = await supabase
    .from('schedule_options')
    .select('*')
    .eq('schedule_id', scheduleId)
    .eq('status', 'pending')
    .order('scheduled_at', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return data
}
