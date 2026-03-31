'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Calendar, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { diagnoseConnectedGoogleAccount, createGoogleCalendarTestEvent } from '@/api/actions/google-calendar';
import { toast } from 'sonner';

/**
 * 구글 캘린더 연동 페이지 (클라이언트 컴포넌트)
 * - `useSearchParams()` 사용 → page.tsx에서 Suspense로 감싸서 프리렌더 에러를 방지합니다.
 */
export function ConnectCalendarPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get('from');

  const [isChecking, setIsChecking] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [appUserEmail, setAppUserEmail] = useState<string | null>(null);
  const [connectedGoogleEmail, setConnectedGoogleEmail] = useState<string | null>(null);
  const [isMismatch, setIsMismatch] = useState(false);
  const [diagnosticMessage, setDiagnosticMessage] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    checkCalendarConnection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 캘린더 연결 상태를 확인합니다.
  const checkCalendarConnection = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      const { data: userData } = await supabase
        .from('users')
        .select('calendar_provider, calendar_access_token, calendar_refresh_token')
        .eq('id', user.id)
        .single();

      // refresh_token 기준으로 연동 상태 판단 (access_token은 1시간이면 만료되지만 refresh_token은 장기 유효)
      if (userData?.calendar_provider === 'google' && userData?.calendar_refresh_token) {
        setIsConnected(true);
      }

      // ✅ 진단: “토큰 소유 구글 계정”이 무엇인지 서버에서 직접 확인해 UI에 표시합니다.
      // - 사용자가 다른 구글 계정으로 연동했을 때, 이벤트가 '다른 계정 캘린더'에 생성되어 안 보이는 문제가 자주 발생합니다.
      setAppUserEmail(user.email ?? null);
      try {
        const result = await diagnoseConnectedGoogleAccount();
        if (result.error) {
          setDiagnosticMessage(result.error);
        } else if (result.data) {
          setConnectedGoogleEmail(result.data.googleEmail ?? null);
          setIsMismatch(!!result.data.isMismatch);
          setDiagnosticMessage(result.data.message ?? null);
        }
      } catch (e) {
        // 진단 실패는 치명적이지 않으므로 조용히 처리 (연동 UI 자체는 계속 사용 가능)
        setDiagnosticMessage('연동된 구글 계정 정보를 확인할 수 없습니다. 필요 시 재연동해주세요.');
      }
    } catch (error) {
      console.error('캘린더 연결 상태 확인 실패:', error);
    } finally {
      setIsChecking(false);
    }
  };

  // 구글 캘린더 연동을 시작합니다.
  const handleConnect = () => {
    setIsConnecting(true);
    // 구글 캘린더 연동 URL로 리다이렉트 (전체 URL 사용)
    const baseUrl = window.location.origin;
    window.location.href = `${baseUrl}/api/auth/connect-google-calendar?next=/dashboard`;
  };

  // 회원가입 플로우에서만 "나중에 하기"를 허용합니다.
  const handleSkip = () => {
    router.push('/dashboard');
  };

  // ✅ 테스트 이벤트를 생성하여 “정말 캘린더에 보이는지”를 즉시 확인합니다.
  const handleTestEvent = async () => {
    setIsTesting(true);
    try {
      const result = await createGoogleCalendarTestEvent();
      if (result.error) {
        toast.error(result.error);
        return;
      }

      const htmlLink = result.data?.htmlLink;
      toast.success('테스트 일정이 생성되었습니다. 캘린더에서 확인해보세요.');
      if (htmlLink) {
        window.open(htmlLink, '_blank', 'noopener,noreferrer');
      } else {
        toast('링크를 가져오지 못했습니다. Google Calendar에서 “방금 생성된 일정”을 직접 확인해주세요.');
      }
    } catch (e) {
      toast.error('테스트 일정 생성에 실패했습니다.');
    } finally {
      setIsTesting(false);
    }
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
            <br />
            <span className="text-sm text-gray-500">
              인증이 만료되었거나 문제가 발생한 경우 재연동해주세요.
            </span>
          </p>

          {/* ✅ 연동 진단 정보 */}
          <div className="text-left bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6">
            <p className="text-sm font-semibold text-gray-900 mb-2">연동 진단</p>
            <div className="space-y-1 text-sm text-gray-700">
              <p>
                <span className="font-medium">현재 로그인:</span>{' '}
                <span className="text-gray-900">{appUserEmail ?? '알 수 없음'}</span>
              </p>
              <p>
                <span className="font-medium">연동된 구글 계정(토큰 소유자):</span>{' '}
                <span className="text-gray-900">{connectedGoogleEmail ?? '확인 중/없음'}</span>
              </p>
              {diagnosticMessage && (
                <p className="text-xs text-gray-500 mt-2">{diagnosticMessage}</p>
              )}
            </div>

            {isMismatch && (
              <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm font-semibold text-red-800 mb-1">⚠️ 계정 불일치 감지</p>
                <p className="text-xs text-red-700">
                  현재 로그인 계정과 다른 구글 계정이 연동되어 있습니다. 이 상태에서 일정 자동화를 하면
                  이벤트가 “다른 구글 계정 캘린더”에 생성되어 보이지 않을 수 있습니다. 올바른 계정으로 재연동해주세요.
                </p>
              </div>
            )}

            <div className="mt-4">
              <Button
                onClick={handleTestEvent}
                disabled={isTesting || isConnecting}
                variant="outline"
                className="w-full"
              >
                {isTesting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    테스트 일정 생성 중...
                  </>
                ) : (
                  '테스트 일정 생성(캘린더 확인)'
                )}
              </Button>
              <p className="text-xs text-gray-500 mt-2">
                버튼을 누르면 5분 뒤 시작하는 테스트 일정이 생성되며, 가능하면 Google Calendar 링크가 새 탭으로 열립니다.
              </p>
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
                  재연동 중...
                </>
              ) : (
                <>
                  <Calendar className="w-4 h-4 mr-2" />
                  구글 캘린더 재연동하기
                </>
              )}
            </Button>

            <Button
              onClick={() => router.push('/dashboard')}
              variant="outline"
              className="w-full"
              disabled={isConnecting}
            >
              대시보드로 이동
            </Button>
          </div>
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

        {/* ✅ 진단 안내 (연동 전에도 “왜 필요한지”를 이해하기 쉽게 표시) */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
          <p className="text-sm font-semibold text-gray-900 mb-2">왜 연동이 필요한가요?</p>
          <p className="text-sm text-gray-700">
            일정 자동화는 구글 캘린더에 실제 이벤트를 생성해야 합니다. 계정을 잘못 선택해 연동하면
            이벤트가 “다른 구글 계정”에 생성되어 보이지 않을 수 있어요. 연동 후 이 페이지에서
            “연동된 구글 계정”을 꼭 확인해주세요.
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

