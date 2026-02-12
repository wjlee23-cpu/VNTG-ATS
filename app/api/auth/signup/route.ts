import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const name = formData.get('name') as string
  const organization = formData.get('organization') as string

  if (!email || !password || !name || !organization) {
    return NextResponse.json(
      { error: '모든 필드를 입력해주세요.' },
      { status: 400 }
    )
  }

  const supabase = await createClient()
  const serviceClient = await createServiceClient()

  // Create organization first
  const { data: orgData, error: orgError } = await serviceClient
    .from('organizations')
    .insert({ name: organization })
    .select()
    .single()

  if (orgError) {
    return NextResponse.json({ error: '조직 생성에 실패했습니다.' }, { status: 500 })
  }

  // Create user account
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  })

  if (authError || !authData.user) {
    return NextResponse.json({ error: authError?.message || '회원가입에 실패했습니다.' }, { status: 400 })
  }

  // Create user profile
  const { error: userError } = await serviceClient.from('users').insert({
    id: authData.user.id,
    email,
    organization_id: orgData.id,
    role: 'admin', // First user is admin
  })

  if (userError) {
    // Rollback: delete auth user if profile creation fails
    await serviceClient.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: '사용자 프로필 생성에 실패했습니다.' }, { status: 500 })
  }

  return NextResponse.redirect(new URL('/', request.url))
}
