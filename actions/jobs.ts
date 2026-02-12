'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createJobPost(jobData: {
  title: string
  description?: string
  processId: string
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 개발 모드: 인증 체크 비활성화
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  if (!isDevelopment && !user) {
    throw new Error('Unauthorized')
  }

  // 개발 모드: mock organization 사용
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

  // TypeScript 타입 가드: userData가 null이면 에러
  if (!userData) {
    throw new Error('Organization not found')
  }

  const { data, error } = await (supabase as any)
    .from('job_posts')
    .insert({
      title: jobData.title,
      description: jobData.description || null,
      process_id: jobData.processId,
      organization_id: userData!.organization_id,
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/jobs')
  return data
}

export async function getJobPosts() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 개발 모드: 인증 체크 비활성화
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  if (!isDevelopment && !user) {
    throw new Error('Unauthorized')
  }

  // 개발 모드: mock organization 사용
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

  const { data, error } = await (supabase as any)
    .from('job_posts')
    .select('*, processes(*)')
    .eq('organization_id', userData!.organization_id)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function getJobPost(id: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 개발 모드: 인증 체크 비활성화
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  if (!isDevelopment && !user) {
    throw new Error('Unauthorized')
  }

  const { data, error } = await (supabase as any)
    .from('job_posts')
    .select('*, processes(*)')
    .eq('id', id)
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}
