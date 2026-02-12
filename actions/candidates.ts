'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { generateToken } from '@/lib/utils'

export async function createCandidate(data: {
  jobPostId: string
  name: string
  email: string
  phone?: string
}) {
  const supabase = await createClient()
  const serviceClient = createServiceClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 개발 모드: 인증 체크 비활성화
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  if (!isDevelopment && !user) {
    throw new Error('Unauthorized')
  }

  const token = generateToken()

  const { data: candidate, error } = await (serviceClient as any)
    .from('candidates')
    .insert({
      job_post_id: data.jobPostId,
      name: data.name,
      email: data.email,
      phone: data.phone || null,
      token,
      status: 'pending',
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  // Create timeline event
  await (serviceClient as any).from('timeline_events').insert({
    candidate_id: (candidate as any).id,
    type: 'system_log',
    content: {
      message: '후보자가 등록되었습니다.',
    },
    created_by: user?.id || null,
  })

  revalidatePath('/')
  revalidatePath(`/jobs/${data.jobPostId}`)
  return candidate
}

export async function updateCandidateStatus(
  id: string,
  status: 'pending' | 'in_progress' | 'confirmed' | 'rejected' | 'issue'
) {
  const supabase = await createClient()
  const serviceClient = createServiceClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 개발 모드: 인증 체크 비활성화
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  if (!isDevelopment && !user) {
    throw new Error('Unauthorized')
  }

  const { data: candidate, error } = await (serviceClient as any)
    .from('candidates')
    .update({ status })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  // Create timeline event
  await (serviceClient as any).from('timeline_events').insert({
    candidate_id: id,
    type: 'system_log',
    content: {
      message: `상태가 ${status}로 변경되었습니다.`,
    },
    created_by: user?.id || null,
  })

  revalidatePath('/')
  revalidatePath(`/candidates/${id}`)
  return candidate
}

export async function updateCandidateStage(id: string, stageId: string) {
  const supabase = await createClient()
  const serviceClient = createServiceClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 개발 모드: 인증 체크 비활성화
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  if (!isDevelopment && !user) {
    throw new Error('Unauthorized')
  }

  const { data: candidate, error } = await (serviceClient as any)
    .from('candidates')
    .update({ current_stage_id: stageId })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  // Create timeline event
  await (serviceClient as any).from('timeline_events').insert({
    candidate_id: id,
    type: 'stage_changed',
    content: {
      stage_id: stageId,
    },
    created_by: user?.id || null,
  })

  revalidatePath('/')
  revalidatePath(`/candidates/${id}`)
  return candidate
}

export async function getCandidates(jobPostId?: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  // 개발 모드: mock organization 사용
  const isDevelopment = process.env.NODE_ENV === 'development'
  let userData: any = null
  
  if (user) {
    const { data } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single()
    userData = data
  }
  
  if (!userData && isDevelopment) {
    // 개발 모드에서 mock organization 사용
    userData = { organization_id: '00000000-0000-0000-0000-000000000000' }
  }

  if (!userData && !isDevelopment) {
    throw new Error('User not found')
  }

  if (!userData) {
    return []
  }

  let query: any = (supabase as any)
    .from('candidates')
    .select('*, job_posts!inner(organization_id)')
    .eq('job_posts.organization_id', userData!.organization_id)

  if (jobPostId) {
    query = query.eq('job_post_id', jobPostId)
  }

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function getCandidate(id: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const { data, error } = await supabase
    .from('candidates')
    .select('*, job_posts(*)')
    .eq('id', id)
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function getCandidateByToken(token: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('candidates')
    .select('*, job_posts(*)')
    .eq('token', token)
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}
