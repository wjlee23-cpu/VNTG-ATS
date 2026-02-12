'use client'

import { usePathname } from 'next/navigation'
import { DashboardLayoutClient } from '@/components/dashboard/DashboardLayoutClient'

interface ConditionalLayoutWrapperProps {
  children: React.ReactNode
  userEmail: string
  hasUser: boolean
  isDevelopment: boolean
  candidates?: any[]
  jobs?: any[]
}

export function ConditionalLayoutWrapper({
  children,
  userEmail,
  hasUser,
  isDevelopment,
  candidates = [],
  jobs = [],
}: ConditionalLayoutWrapperProps) {
  const pathname = usePathname()
  const isJobsPage = pathname === '/jobs'

  // Jobs 페이지는 자체 레이아웃을 사용하므로 layout을 적용하지 않음
  if (isJobsPage) {
    return <>{children}</>
  }

  return (
    <DashboardLayoutClient
      userEmail={userEmail}
      hasUser={hasUser}
      isDevelopment={isDevelopment}
      candidates={candidates}
      jobs={jobs}
    >
      {children}
    </DashboardLayoutClient>
  )
}
