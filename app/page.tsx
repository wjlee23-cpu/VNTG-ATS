import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { LoginForm } from '@/components/auth/LoginForm';

export default async function LandingPage() {
  // 사용자 인증 상태 확인
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // 로그인된 사용자는 대시보드로 리다이렉트
  if (user) {
    redirect('/dashboard');
  }

  // 로그인되지 않은 사용자에게 스플릿 로그인 화면을 표시합니다.
  return (
    <LoginForm redirectTo="/dashboard" />
  );
}
