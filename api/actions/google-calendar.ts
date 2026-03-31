'use server';

import { google } from 'googleapis';
import { withErrorHandling } from '@/api/utils/errors';
import { getCurrentUser } from '@/api/utils/auth';
import { createClient } from '@/lib/supabase/server';
import { createCalendarEvent, refreshAccessTokenIfNeeded } from '@/lib/calendar/google';

type GoogleAccountDiagnostics = {
  ok: boolean;
  // 토큰으로 확인한 "실제 구글 계정 이메일"
  googleEmail?: string;
  // 앱(=Supabase users 테이블)의 이메일
  appUserEmail?: string;
  // 둘이 다르면 true
  isMismatch?: boolean;
  message?: string;
};

/**
 * 구글 OAuth access_token으로 userinfo.email을 조회합니다.
 * - ⚠️ 토큰은 절대 로그/리턴값에 포함하지 않습니다.
 */
async function fetchGoogleEmailByAccessToken(accessToken: string): Promise<string> {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/google`,
  );

  oauth2Client.setCredentials({ access_token: accessToken });

  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const { data: userInfo } = await oauth2.userinfo.get();

  const email = userInfo.email;
  if (!email) {
    throw new Error('구글 계정 이메일을 확인할 수 없습니다. 구글 캘린더를 재연동해주세요. (/dashboard/connect-calendar)');
  }

  return email;
}

/**
 * 현재 로그인 사용자 기준으로 “연동된 구글 계정(토큰 소유자)” 이메일을 진단합니다.
 * - 사용자가 “왜 캘린더에 안 생기지?”를 빠르게 확인할 수 있도록 연결 페이지에서 사용합니다.
 */
export async function diagnoseConnectedGoogleAccount() {
  return withErrorHandling(async (): Promise<GoogleAccountDiagnostics> => {
    const user = await getCurrentUser();
    const supabase = await createClient();

    const { data: userRow, error: userError } = await supabase
      .from('users')
      .select('id, email, calendar_provider, calendar_access_token, calendar_refresh_token')
      .eq('id', user.userId)
      .single();

    if (userError || !userRow) {
      throw new Error('사용자 정보를 찾을 수 없습니다.');
    }

    if (
      userRow.calendar_provider !== 'google' ||
      !userRow.calendar_access_token ||
      !userRow.calendar_refresh_token
    ) {
      return {
        ok: false,
        appUserEmail: userRow.email || undefined,
        message: '구글 캘린더가 아직 연동되지 않았습니다. (/dashboard/connect-calendar)',
      };
    }

    // refresh_token으로 최신 access_token 확보 (만료/철회 케이스를 빠르게 감지)
    const freshAccessToken = await refreshAccessTokenIfNeeded(
      userRow.calendar_access_token,
      userRow.calendar_refresh_token,
      userRow.id,
    );

    const googleEmail = await fetchGoogleEmailByAccessToken(freshAccessToken);
    const appUserEmail = (userRow.email || '').toLowerCase();
    const isMismatch = appUserEmail ? googleEmail.toLowerCase() !== appUserEmail : false;

    return {
      ok: true,
      googleEmail,
      appUserEmail: userRow.email || undefined,
      isMismatch,
      message: isMismatch
        ? '현재 로그인 계정과 다른 구글 계정이 연동되어 있습니다. 이 경우 캘린더 이벤트가 “다른 계정”에 생성되어 보이지 않을 수 있습니다.'
        : '구글 계정 연동이 정상입니다.',
    };
  });
}

/**
 * 캘린더에 “정말로” 이벤트가 생성되는지 확인하는 테스트 이벤트를 생성합니다.
 * - 생성된 이벤트의 htmlLink를 반환하여 사용자가 즉시 확인할 수 있습니다.
 */
export async function createGoogleCalendarTestEvent() {
  return withErrorHandling(async (): Promise<{ ok: true; eventId: string; htmlLink?: string }> => {
    const user = await getCurrentUser();
    const supabase = await createClient();

    const { data: userRow, error: userError } = await supabase
      .from('users')
      .select('id, email, calendar_provider, calendar_access_token, calendar_refresh_token')
      .eq('id', user.userId)
      .single();

    if (userError || !userRow) {
      throw new Error('사용자 정보를 찾을 수 없습니다.');
    }

    if (
      userRow.calendar_provider !== 'google' ||
      !userRow.calendar_access_token ||
      !userRow.calendar_refresh_token
    ) {
      throw new Error('테스트 이벤트를 만들려면 먼저 구글 캘린더를 연동해주세요. (/dashboard/connect-calendar)');
    }

    // 새 토큰으로 “토큰 소유 구글 계정”을 확인해서, 사용자가 어떤 계정에 생기는지 바로 알 수 있게 합니다.
    const freshAccessToken = await refreshAccessTokenIfNeeded(
      userRow.calendar_access_token,
      userRow.calendar_refresh_token,
      userRow.id,
    );
    const googleEmail = await fetchGoogleEmailByAccessToken(freshAccessToken);

    const now = new Date();
    const start = new Date(now.getTime() + 5 * 60 * 1000);
    const end = new Date(now.getTime() + 10 * 60 * 1000);

    // 테스트 이벤트 생성 (참석자 없이 주최자 캘린더에만 생성)
    const created = await createCalendarEvent(freshAccessToken, userRow.calendar_refresh_token, {
      summary: '[TEST] VNTG ATS 캘린더 연동 테스트',
      description:
        `이 이벤트는 VNTG ATS가 자동으로 생성한 테스트 일정입니다.\n` +
        `연동된 구글 계정(토큰 소유자): ${googleEmail}\n\n` +
        `문제가 있으면 구글 캘린더를 재연동해주세요. (/dashboard/connect-calendar)`,
      start: { dateTime: start.toISOString(), timeZone: 'Asia/Seoul' },
      end: { dateTime: end.toISOString(), timeZone: 'Asia/Seoul' },
      attendees: [],
      transparency: 'opaque',
    });

    return { ok: true, eventId: created.id, htmlLink: created.htmlLink };
  });
}

