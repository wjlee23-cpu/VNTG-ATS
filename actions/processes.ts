'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface ProcessStage {
  id: string
  name: string
  order: number
  interviewer_ids: string[]
}

export async function createProcess(processData: { name: string; stages: ProcessStage[] }) {
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
    .from('processes')
    .insert({
      name: processData.name,
      stages: processData.stages as any,
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

export async function updateProcess(id: string, updateData: { name?: string; stages?: ProcessStage[] }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 개발 모드: 인증 체크 비활성화
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  if (!isDevelopment && !user) {
    throw new Error('Unauthorized')
  }

  const updatePayload: any = {}
  if (updateData.name) updatePayload.name = updateData.name
  if (updateData.stages) updatePayload.stages = updateData.stages as any

  const { data: processData, error } = await (supabase as any)
    .from('processes')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/jobs')
  revalidatePath(`/process/${id}`)
  return processData
}

export async function getProcesses() {
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
    .from('processes')
    .select('*')
    .eq('organization_id', userData!.organization_id)
    .order('created_at', { ascending: false })

  if (error) {
    // 개발 모드: 테이블이 없거나 에러가 발생해도 빈 배열 반환
    if (isDevelopment) {
      console.warn('Development mode: Error fetching processes (table may not exist):', error.message)
      return []
    }
    throw new Error(error.message)
  }

  return data || []
}

export async function getProcess(id: string) {
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
    .from('processes')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    // 개발 모드: 테이블이 없거나 에러가 발생해도 null 반환
    if (isDevelopment) {
      console.warn('Development mode: Error fetching process (table may not exist):', error.message)
      return null
    }
    throw new Error(error.message)
  }

  return data
}
