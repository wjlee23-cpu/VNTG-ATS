'use client'

import { useRouter } from 'next/navigation'

export function LogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <button
      onClick={handleLogout}
      className="w-full rounded-md bg-[#1a1f3a] px-3 py-2 text-sm font-medium text-white hover:bg-[#2a2f4a] transition-colors"
      style={{ fontFamily: 'Noto Sans KR, sans-serif' }}
    >
      로그아웃
    </button>
  )
}
