import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { LogoutButton } from '@/components/dashboard/LogoutButton'
import { VNTGSymbol } from '@/components/vntg/VNTGSymbol'

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
    <div className="flex h-screen bg-white">
      {/* Sidebar */}
      <aside className="w-64 bg-[#08102B] shadow-lg">
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center border-b border-[#1a1f3a] px-6">
            <VNTGSymbol />
          </div>
          <nav className="flex-1 space-y-1 px-3 py-4">
            <Link
              href="/"
              className="block rounded-md px-3 py-2 text-sm font-medium text-white hover:bg-[#1a1f3a] transition-colors"
              style={{ fontFamily: 'Noto Sans KR, sans-serif' }}
            >
              대시보드
            </Link>
            <Link
              href="/jobs"
              className="block rounded-md px-3 py-2 text-sm font-medium text-white hover:bg-[#1a1f3a] transition-colors"
              style={{ fontFamily: 'Noto Sans KR, sans-serif' }}
            >
              채용 공고
            </Link>
            <Link
              href="/candidates"
              className="block rounded-md px-3 py-2 text-sm font-medium text-white hover:bg-[#1a1f3a] transition-colors"
              style={{ fontFamily: 'Noto Sans KR, sans-serif' }}
            >
              후보자
            </Link>
          </nav>
          <div className="border-t border-[#1a1f3a] p-4">
            <div className="mb-2 text-sm text-gray-300" style={{ fontFamily: 'Roboto, sans-serif' }}>
              {displayUser.email}
            </div>
            {user && <LogoutButton />}
            {!user && isDevelopment && (
              <div className="text-xs text-yellow-400" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
                개발 모드 (인증 없음)
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-gray-50">
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
