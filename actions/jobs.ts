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
    // 개발 모드: 더 명확한 에러 메시지
    if (isDevelopment && error.message.includes('schema cache')) {
      throw new Error(
        `테이블 'job_posts'를 찾을 수 없습니다. 마이그레이션을 실행해주세요: supabase/migrations/001_initial_schema.sql\n원본 에러: ${error.message}`
      )
    }
    throw new Error(error.message)
  }

  revalidatePath('/jobs')
  return data
}

export async function updateJobPost(id: string, jobData: {
  title: string
  description?: string
  processId?: string
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

  const updatePayload: any = {
    title: jobData.title,
    description: jobData.description || null,
  }
  
  if (jobData.processId) {
    updatePayload.process_id = jobData.processId
  }

  const { data, error } = await (supabase as any)
    .from('job_posts')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/jobs')
  revalidatePath(`/jobs/${id}`)
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
    // 개발 모드: 테이블이 없거나 에러가 발생해도 빈 배열 반환
    if (isDevelopment) {
      console.warn('Development mode: Error fetching job posts (table may not exist):', error.message)
      console.warn('Please run the migration: supabase/migrations/001_initial_schema.sql')
      return []
    }
    throw new Error(error.message)
  }

  return data || []
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
    // 개발 모드: 테이블이 없거나 에러가 발생해도 null 반환
    if (isDevelopment) {
      console.warn('Development mode: Error fetching job post (table may not exist):', error.message)
      console.warn('Please run the migration: supabase/migrations/001_initial_schema.sql')
      return null
    }
    throw new Error(error.message)
  }

  return data
}
