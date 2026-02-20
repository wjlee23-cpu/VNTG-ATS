import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { LoginForm } from '@/components/auth/LoginForm';
import { Zap } from 'lucide-react';

export default async function LandingPage() {
  // 사용자 인증 상태 확인
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // 로그인된 사용자는 대시보드로 리다이렉트
  if (user) {
    redirect('/dashboard');
  }

  // 로그인되지 않은 사용자에게 랜딩 페이지 표시
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
          {/* Logo */}
          <div className="flex items-center justify-center mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-dark to-brand-main flex items-center justify-center shadow-lg shadow-brand-main/20">
              <Zap className="text-white" size={24} />
            </div>
          </div>

          {/* Title */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-semibold text-gray-900">로그인</h1>
            <p className="text-sm text-gray-500">VNTG 채용 플랫폼에 오신 것을 환영합니다</p>
          </div>

          {/* Login Form */}
          <LoginForm redirectTo="/dashboard" />

          {/* Sign up link */}
          <div className="text-center text-sm text-gray-500">
            계정이 없으신가요?{' '}
            <a href="/signup" className="text-brand-main hover:text-brand-dark font-medium">
              회원가입
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
