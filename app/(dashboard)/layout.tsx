import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardLayoutClient } from '@/components/dashboard/DashboardLayoutClient'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 개발 모드: 인증 체크 비활성화
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  if (!isDevelopment && !user) {
    redirect('/login')
  }

  // 개발 모드에서 user가 없을 때 mock user 사용
  const displayUser = user || { email: 'dev@example.com' }

  return (
    <DashboardLayoutClient
      userEmail={displayUser.email}
      hasUser={!!user}
      isDevelopment={isDevelopment}
    >
      {children}
    </DashboardLayoutClient>
  )
}
