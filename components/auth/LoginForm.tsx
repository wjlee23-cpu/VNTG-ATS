'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Sparkles, Zap } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { sanitizeNextPath } from '@/lib/url/sanitize-next-path';

interface LoginFormProps {
  redirectTo?: string;
}

export function LoginForm({ redirectTo = '/dashboard' }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  // URL 파라미터에서 전달된 인증 에러를 화면에 표시합니다.
  useEffect(() => {
    const errorParam = searchParams.get('error');
    const messageParam = searchParams.get('message');
    
    if (errorParam && messageParam) {
      const base = decodeURIComponent(messageParam);
      const hint = searchParams.get('debug_hint');
      setError(
        hint ? `${base} (${decodeURIComponent(hint)})` : base
      );
    }
  }, [searchParams]);

  // 이메일/비밀번호 로그인 처리 후 성공 시 대시보드로 이동합니다.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }

      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      setError('로그인 중 오류가 발생했습니다.');
      setLoading(false);
    }
  };

  // 구글 로그인: Supabase OAuth가 아닌 커스텀 플로우로 캘린더·Gmail 스코프까지 한 번에 받습니다.
  const handleGoogleLogin = () => {
    setLoading(true);
    setError(null);
    const next = sanitizeNextPath(redirectTo, '/dashboard');
    window.location.href = `/api/auth/google?next=${encodeURIComponent(next)}`;
  };

  return (
    <div className="font-sans text-neutral-900 bg-white min-h-screen w-full flex overflow-hidden">
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 sm:p-12 lg:p-24 relative z-10">
        <div className="w-full max-w-[400px]">
          <div className="mb-10 text-center lg:text-left">
            <div className="w-10 h-10 bg-neutral-900 text-white rounded-xl flex items-center justify-center mb-6 mx-auto lg:mx-0 shadow-lg">
              <Zap className="w-5 h-5" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 mb-2">
              Welcome back
            </h1>
            <p className="text-sm text-neutral-500">
              VNTG 채용 플랫폼에 로그인하여 업무를 시작하세요.
            </p>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white border border-neutral-200 text-neutral-700 rounded-lg px-4 py-2.5 text-sm font-semibold hover:bg-neutral-50 hover:border-neutral-300 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.04)] mb-6 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            구글 계정으로 로그인
          </button>

          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-neutral-100" />
            <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">
              Or continue with email
            </span>
            <div className="flex-1 h-px bg-neutral-100" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-neutral-900 uppercase tracking-wider mb-2">
                이메일
              </label>
              <input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="w-full bg-[#FCFCFC] border border-neutral-200 rounded-lg px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:bg-white focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition-all outline-none disabled:opacity-60"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="block text-xs font-semibold text-neutral-900 uppercase tracking-wider">
                  비밀번호
                </label>
                <Link href="#" className="text-xs font-medium text-neutral-500 hover:text-neutral-900 transition-colors">
                  비밀번호 찾기
                </Link>
              </div>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="w-full bg-[#FCFCFC] border border-neutral-200 rounded-lg px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:bg-white focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition-all outline-none disabled:opacity-60"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center bg-neutral-900 text-white rounded-lg px-4 py-3 text-sm font-semibold hover:bg-neutral-800 shadow-[0_4px_14px_0_rgba(0,0,0,0.1)] transition-all active:scale-[0.98] mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-neutral-500">
            계정이 없으신가요?{' '}
            <Link href="/signup" className="font-semibold text-neutral-900 hover:underline">
              회원가입
            </Link>
          </p>
        </div>
      </div>

      <div className="hidden lg:flex w-1/2 bg-neutral-900 p-12 relative overflow-hidden flex-col justify-between items-center text-center">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(79,70,229,0.15)_0%,rgba(15,23,42,0)_50%)] opacity-70" />
        <div
          className="absolute inset-0"
          style={{ backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px)', backgroundSize: '32px 32px' }}
        />

        <div />

        <div className="relative z-10 max-w-md">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/10 backdrop-blur-md mb-6">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-medium text-white tracking-wide">Powered by Gemini AI</span>
          </div>
          <h2 className="text-4xl font-bold tracking-tight text-white mb-6 leading-tight">
            채용의 모든 순간을
            <br />
            더 스마트하고 우아하게.
          </h2>
          <p className="text-base text-neutral-400 leading-relaxed mb-12">
            VNTG ATS는 AI를 활용하여 이력서 분석부터
            <br />
            면접 일정 자동화까지 가장 완벽한 채용 경험을 제공합니다.
          </p>

          <div className="w-full bg-neutral-800/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl text-left transform rotate-2 hover:rotate-0 transition-all duration-500 cursor-default">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-3 h-3 rounded-full bg-red-500/80" />
              <div className="w-3 h-3 rounded-full bg-amber-500/80" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
            </div>
            <div className="space-y-3">
              <div className="h-2.5 w-3/4 bg-neutral-700/50 rounded-full" />
              <div className="h-2.5 w-1/2 bg-neutral-700/50 rounded-full" />
              <div className="h-2.5 w-5/6 bg-neutral-700/50 rounded-full" />
            </div>
            <div className="mt-6 flex justify-between items-center pt-4 border-t border-white/5">
              <div className="flex -space-x-2">
                <div className="w-6 h-6 rounded-full bg-neutral-600 border border-neutral-800" />
                <div className="w-6 h-6 rounded-full bg-neutral-500 border border-neutral-800" />
              </div>
              <div className="text-[10px] text-indigo-400 font-semibold tracking-wider">AI SCHEDULING ACTIVE</div>
            </div>
          </div>
        </div>

        <div className="relative z-10 w-full flex justify-between items-center text-xs text-neutral-500 font-medium max-w-md">
          <span>© 2026 VNTG Corp.</span>
          <div className="flex gap-4">
            <Link href="#" className="hover:text-white transition-colors">
              Privacy
            </Link>
            <Link href="#" className="hover:text-white transition-colors">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
