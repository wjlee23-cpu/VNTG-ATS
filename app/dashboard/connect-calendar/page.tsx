'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Calendar, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function ConnectCalendarPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get('from');
  const [isChecking, setIsChecking] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    checkCalendarConnection();
  }, []);

  const checkCalendarConnection = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: userData } = await supabase
        .from('users')
        .select('calendar_provider, calendar_access_token, calendar_refresh_token')
        .eq('id', user.id)
        .single();

      if (userData?.calendar_provider === 'google' && userData?.calendar_access_token) {
        setIsConnected(true);
      }
    } catch (error) {
      console.error('캘린더 연결 상태 확인 실패:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const handleConnect = () => {
    setIsConnecting(true);
    // 구글 캘린더 연동 URL로 리다이렉트 (전체 URL 사용)
    const baseUrl = window.location.origin;
    window.location.href = `${baseUrl}/api/auth/connect-google-calendar?next=/dashboard`;
  };

  const handleSkip = () => {
    router.push('/dashboard');
  };

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">확인 중...</p>
        </div>
      </div>
    );
  }

  if (isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">구글 캘린더 연동 완료</h1>
          <p className="text-gray-600 mb-6">
            구글 캘린더가 이미 연동되어 있습니다.
          </p>
          <Button
            onClick={() => router.push('/dashboard')}
            className="w-full"
          >
            대시보드로 이동
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {from === 'signup' ? '구글 캘린더 연동' : '구글 캘린더 연동 필요'}
          </h1>
          <p className="text-gray-600">
            {from === 'signup' 
              ? '인터뷰 스케줄링 자동화 기능을 사용하려면 구글 캘린더 연동이 필요합니다.'
              : '인터뷰 스케줄링 자동화 기능을 사용하려면 구글 캘린더를 연동해주세요.'}
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">연동 시 다음 권한이 필요합니다:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-700">
                <li>구글 캘린더 읽기/쓰기 권한</li>
                <li>Gmail 이메일 발송 권한 (gmail.send)</li>
                <li>이메일 주소 확인</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <p className="font-medium mb-2">⚠️ Gmail API 설정 확인 필요</p>
              <p className="mb-2">이메일 발송 기능을 사용하려면 다음을 확인해주세요:</p>
              <ol className="list-decimal list-inside space-y-1 text-yellow-700 mb-3">
                <li>
                  <a 
                    href="https://console.cloud.google.com/apis/library/gmail.googleapis.com" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="underline hover:text-yellow-900"
                  >
                    Google Cloud Console에서 Gmail API 활성화
                  </a>
                </li>
                <li>
                  <a 
                    href="https://console.cloud.google.com/apis/credentials/consent" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="underline hover:text-yellow-900"
                  >
                    OAuth 동의 화면에 gmail.send 스코프 추가
                  </a>
                </li>
              </ol>
              <p className="text-xs text-yellow-600 mt-2">
                설정 후 재연동 시 모든 권한을 승인해주세요.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <Button
            onClick={handleConnect}
            disabled={isConnecting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            size="lg"
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                연동 중...
              </>
            ) : (
              <>
                <Calendar className="w-4 h-4 mr-2" />
                구글 캘린더 연동하기
              </>
            )}
          </Button>

          {from === 'signup' && (
            <Button
              onClick={handleSkip}
              variant="outline"
              className="w-full"
              disabled={isConnecting}
            >
              나중에 하기
            </Button>
          )}
        </div>

        <p className="text-xs text-gray-500 text-center mt-6">
          연동 후 언제든지 설정에서 해제할 수 있습니다.
        </p>
      </div>
    </div>
  );
}
