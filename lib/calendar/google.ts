import { google } from 'googleapis'
import { createServiceClient } from '@/lib/supabase/server'

export interface CalendarEvent {
  id: string
  summary: string
  start: { dateTime: string; timeZone: string }
  end: { dateTime: string; timeZone: string }
}

/**
 * Google API 에러를 사용자에게 이해하기 쉬운 메시지로 변환합니다.
 * - 운영 환경(Vercel)에서도 원인 파악이 가능하도록 status/reason을 포함합니다.
 * - ⚠️ 토큰(access/refresh) 등 민감 정보는 절대 메시지에 포함하지 않습니다.
 */
function formatGoogleCalendarApiError(
  error: any,
  actionKorean: string
): string {
  const status: number | undefined = error?.response?.status ?? error?.code
  const apiMessage: string | undefined =
    error?.response?.data?.error?.message ?? error?.message
  const apiReason: string | undefined =
    error?.response?.data?.error?.errors?.[0]?.reason

  // 인증 만료/철회(401)
  if (
    status === 401 ||
    apiMessage?.includes('invalid authentication credentials') ||
    apiMessage?.includes('invalid_grant')
  ) {
    return (
      '구글 캘린더 인증이 만료되었거나 권한이 취소되었습니다. ' +
      '구글 캘린더를 재연동해주세요. (/dashboard/connect-calendar)'
    )
  }

  // 권한/정책 문제(403)
  if (status === 403) {
    const base =
      '구글 캘린더 권한이 부족하거나(쓰기 권한 미승인), Google Workspace 정책으로 차단되었습니다.'
    const hint = '구글 캘린더를 재연동 후 모든 권한을 허용하고 다시 시도해주세요. (/dashboard/connect-calendar)'
    const detail = apiReason || apiMessage ? ` (상세: ${[apiReason, apiMessage].filter(Boolean).join(' / ')})` : ''
    return `${base}${detail} ${hint}`
  }

  // 리소스/캘린더/이벤트 없음(404)
  if (status === 404) {
    return (
      `구글 캘린더에서 필요한 항목을 찾을 수 없습니다. (${actionKorean}) ` +
      '구글 캘린더를 재연동 후 다시 시도해주세요. (/dashboard/connect-calendar)'
    )
  }

  // 할당량/레이트리밋(429)
  if (status === 429) {
    return (
      '구글 캘린더 API 호출이 너무 많아 잠시 차단되었습니다. ' +
      '잠시 후 다시 시도해주세요.'
    )
  }

  // 기타: 가능한 정보만 포함
  const detail = apiMessage ? ` (상세: ${apiMessage})` : ''
  const statusText = status ? ` (HTTP ${status})` : ''
  return `${actionKorean} 실패했습니다.${statusText}${detail}`
}

export async function getCalendarClient(accessToken: string) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/google`
  )

  oauth2Client.setCredentials({
    access_token: accessToken,
  })

  return google.calendar({ version: 'v3', auth: oauth2Client })
}

export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/google`
  )

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  })

  const { credentials } = await oauth2Client.refreshAccessToken()
  return credentials.access_token || ''
}

export async function getBusyTimes(
  accessToken: string,
  calendarIds: string[],
  timeMin: Date,
  timeMax: Date
): Promise<CalendarEvent[]> {
  const calendar = await getCalendarClient(accessToken)

  const busyTimes: CalendarEvent[] = []

  for (const calendarId of calendarIds) {
    try {
      const response = await calendar.events.list({
        calendarId,
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      })

      if (response.data.items) {
        for (const event of response.data.items) {
          if (event.start?.dateTime && event.end?.dateTime) {
            busyTimes.push({
              id: event.id || '',
              summary: event.summary || '',
              start: {
                dateTime: event.start.dateTime,
                timeZone: event.start.timeZone || 'Asia/Seoul',
              },
              end: {
                dateTime: event.end.dateTime,
                timeZone: event.end.timeZone || 'Asia/Seoul',
              },
            })
          }
        }
      }
    } catch (error: any) {
      console.error(`Error fetching calendar ${calendarId}:`, error)
      
      // 인증 관련 에러인지 확인
      if (error?.code === 401 || 
          error?.message?.includes('invalid authentication credentials') ||
          error?.message?.includes('invalid_grant') ||
          error?.response?.status === 401) {
        throw new Error(
          '구글 캘린더 인증이 만료되었거나 유효하지 않습니다. ' +
          '구글 캘린더를 재연동해주세요. (/dashboard/connect-calendar)'
        )
      }
      
      // 다른 에러도 명확하게 전달
      throw new Error(
        `구글 캘린더 조회 실패: ${error?.message || '알 수 없는 오류'}. ` +
        '구글 캘린더를 재연동해주세요. (/dashboard/connect-calendar)'
      )
    }
  }

  return busyTimes
}

export function getGoogleAuthUrl(): string {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/google`
  )

  const scopes = [
    'https://www.googleapis.com/auth/calendar', // 읽기/쓰기 권한으로 변경
    'https://www.googleapis.com/auth/gmail.send', // Gmail 이메일 발송 권한
    'https://www.googleapis.com/auth/gmail.readonly', // Gmail 읽기 권한 (이메일 동기화용)
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ]

  return oauth2Client.generateAuthUrl({
    access_type: 'offline', // refresh token 받기 위해 필수 (최초 1회 발급)
    scope: scopes,
    // prompt 생략: 최초 연동 시에만 구글이 동의 화면 표시, 이후에는 재인증 요청 없이 refresh_token으로 갱신
  })
}

/**
 * refresh_token으로 새 access_token 발급 후 반환.
 * API 호출 전에 호출하면 만료된 access_token 없이 항상 유효한 토큰을 사용할 수 있음.
 * (getAccessToken()은 만료 정보가 없으면 갱신을 하지 않아 만료된 토큰이 반환될 수 있으므로,
 *  refresh_token으로 명시적으로 갱신하는 방식으로 통일)
 */
export async function refreshAccessTokenIfNeeded(
  accessToken: string,
  refreshToken: string,
  userId?: string // userId가 전달되면 갱신된 토큰을 DB에 자동 저장
): Promise<string> {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/google`
    )

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    })

    // refresh_token으로 항상 새 access_token 발급 (만료 여부와 무관하게 갱신하여 401 방지)
    const { credentials } = await oauth2Client.refreshAccessToken()
    const newToken = credentials.access_token

    if (!newToken) {
      throw new Error('토큰 갱신에 실패했습니다. 구글 캘린더를 재연동해주세요.')
    }

    // 갱신된 토큰을 DB에 저장 (userId가 있을 때만)
    if (userId && newToken !== accessToken) {
      await persistAccessTokenToDB(userId, newToken)
    }

    return newToken
  } catch (error: any) {
    // 자세한 에러 로깅
    console.error('Error refreshing access token:', {
      message: error?.message,
      code: error?.code,
      status: error?.response?.status,
      statusText: error?.response?.statusText,
      data: error?.response?.data,
      stack: error?.stack,
    })
    
    // invalid_grant 에러: refresh token이 만료되었거나 사용자가 권한을 취소한 경우
    if (error?.message?.includes('invalid_grant') || error?.code === 'invalid_grant') {
      console.error('Refresh token이 유효하지 않습니다. 재연동이 필요합니다.')
      throw new Error(
        '구글 캘린더 인증이 만료되었거나 권한이 취소되었습니다. ' +
        '구글 캘린더를 재연동해주세요. (/dashboard/connect-calendar)'
      )
    }
    
    // 인증 관련 에러 (401, invalid authentication 등)
    if (error?.code === 401 || error?.message?.includes('invalid authentication')) {
      console.error('인증 토큰이 유효하지 않습니다. 재연동이 필요합니다.')
      throw new Error(
        '구글 캘린더 인증이 만료되었거나 유효하지 않습니다. ' +
        '구글 캘린더를 재연동해주세요. (/dashboard/connect-calendar)'
      )
    }
    
    // 다른 에러도 명확하게 전달
    console.error('알 수 없는 토큰 갱신 에러:', error)
    throw new Error(
      `토큰 갱신 실패: ${error?.message || '알 수 없는 오류'}. ` +
      '구글 캘린더를 재연동해주세요. (/dashboard/connect-calendar)'
    )
  }
}

/**
 * 갱신된 access_token을 users 테이블에 저장하는 헬퍼 함수
 * refreshAccessTokenIfNeeded 내부에서 자동 호출됨
 */
async function persistAccessTokenToDB(userId: string, newAccessToken: string): Promise<void> {
  try {
    const serviceClient = createServiceClient()
    const { error } = await serviceClient
      .from('users')
      .update({ calendar_access_token: newAccessToken })
      .eq('id', userId)

    if (error) {
      console.error(`[Token Persist] DB 저장 실패 (userId: ${userId}):`, error)
    } else {
      console.log(`[Token Persist] 갱신된 access_token DB 저장 완료 (userId: ${userId})`)
    }
  } catch (err) {
    // DB 저장 실패는 치명적이지 않음 (다음 요청 시 다시 갱신하면 됨)
    console.error(`[Token Persist] DB 저장 중 예외 (userId: ${userId}):`, err)
  }
}

/**
 * 구글 캘린더에 이벤트 생성 (block 일정용)
 */
export async function createCalendarEvent(
  accessToken: string,
  refreshToken: string,
  // 이벤트 생성에 사용할 캘린더 ID (기본: primary)
  eventData: {
    summary: string
    description?: string
    start: { dateTime: string; timeZone: string }
    end: { dateTime: string; timeZone: string }
    attendees: Array<{ email: string }>
    transparency?: 'opaque' | 'transparent'
  },
  calendarId: string = 'primary'
): Promise<{ id: string; htmlLink?: string }> {
  try {
    const token = await refreshAccessTokenIfNeeded(accessToken, refreshToken)
    const calendar = await getCalendarClient(token)

    const event = {
      summary: eventData.summary,
      description: eventData.description || '',
      start: eventData.start,
      end: eventData.end,
      attendees: eventData.attendees,
      transparency: eventData.transparency || 'opaque',
      // block 일정의 경우 'tentative'로 설정하여 확정 전임을 표시
      guestsCanModify: false,
      guestsCanInviteOthers: false,
    }

    const response = await calendar.events.insert({
      calendarId,
      requestBody: event,
      sendUpdates: 'all', // 참석자들에게 초대 전송
    })

    if (!response.data.id) {
      throw new Error('이벤트 생성에 실패했습니다.')
    }

    // 생성 직후 실제로 조회 가능한지 검증합니다.
    // (운영에서 "메일은 갔는데 캘린더에는 없음" 같은 혼란을 방지)
    try {
      const verify = await calendar.events.get({
        calendarId,
        eventId: response.data.id,
      })

      if (!verify?.data?.id) {
        throw new Error('생성된 이벤트를 조회할 수 없습니다.')
      }

      return { id: verify.data.id, htmlLink: verify.data.htmlLink || undefined }
    } catch (verifyError: any) {
      console.error('[Google Calendar] 이벤트 생성 후 검증 실패:', {
        status: verifyError?.response?.status ?? verifyError?.code,
        message: verifyError?.message,
        data: verifyError?.response?.data,
      })

      throw new Error(
        '구글 캘린더 일정은 생성 요청이 되었지만, 생성 결과를 확인하지 못했습니다. ' +
          '구글 캘린더를 재연동 후 다시 시도해주세요. (/dashboard/connect-calendar)'
      )
    }
  } catch (error: any) {
    console.error('[Google Calendar] 이벤트 생성 실패:', {
      status: error?.response?.status ?? error?.code,
      message: error?.message,
      data: error?.response?.data,
    })

    // 이미 명확한 에러 메시지가 있으면 그대로 전달
    if (error?.message?.includes('재연동')) throw error

    throw new Error(formatGoogleCalendarApiError(error, '구글 캘린더 이벤트 생성'))
  }
}

/**
 * 구글 캘린더 이벤트 수정 (block → 확정 변경)
 */
export async function updateCalendarEvent(
  accessToken: string,
  refreshToken: string,
  eventId: string,
  // 업데이트할 이벤트가 존재하는 캘린더 ID (기본: primary)
  updates: {
    summary?: string
    description?: string
    start?: { dateTime: string; timeZone: string }
    end?: { dateTime: string; timeZone: string }
    transparency?: 'opaque' | 'transparent'
  },
  calendarId: string = 'primary'
): Promise<void> {
  try {
    const token = await refreshAccessTokenIfNeeded(accessToken, refreshToken)
    const calendar = await getCalendarClient(token)

    // 기존 이벤트 조회
    const existingEvent = await calendar.events.get({
      calendarId,
      eventId,
    })

    if (!existingEvent.data) {
      throw new Error('이벤트를 찾을 수 없습니다.')
    }

    // 업데이트할 데이터 병합
    const updatedEvent = {
      ...existingEvent.data,
      summary: updates.summary ?? existingEvent.data.summary,
      description: updates.description ?? existingEvent.data.description,
      start: updates.start ?? existingEvent.data.start,
      end: updates.end ?? existingEvent.data.end,
      transparency: updates.transparency ?? existingEvent.data.transparency,
    }

    await calendar.events.update({
      calendarId,
      eventId,
      requestBody: updatedEvent,
      sendUpdates: 'all', // 참석자들에게 업데이트 알림 전송
    })
  } catch (error: any) {
    console.error('[Google Calendar] 이벤트 수정 실패:', {
      status: error?.response?.status ?? error?.code,
      message: error?.message,
      data: error?.response?.data,
    })

    if (error?.message?.includes('재연동')) throw error

    throw new Error(formatGoogleCalendarApiError(error, '구글 캘린더 이벤트 수정'))
  }
}

/**
 * 구글 캘린더 이벤트 삭제
 */
export async function deleteCalendarEvent(
  accessToken: string,
  refreshToken: string,
  eventId: string,
  // 삭제할 이벤트가 존재하는 캘린더 ID (기본: primary)
  calendarId: string = 'primary'
): Promise<void> {
  try {
    const token = await refreshAccessTokenIfNeeded(accessToken, refreshToken)
    const calendar = await getCalendarClient(token)

    await calendar.events.delete({
      calendarId,
      eventId,
      sendUpdates: 'all', // 참석자들에게 삭제 알림 전송
    })
  } catch (error: any) {
    console.error('[Google Calendar] 이벤트 삭제 실패:', {
      status: error?.response?.status ?? error?.code,
      message: error?.message,
      data: error?.response?.data,
    })

    if (error?.message?.includes('재연동')) throw error

    throw new Error(formatGoogleCalendarApiError(error, '구글 캘린더 이벤트 삭제'))
  }
}

/**
 * 이벤트 참석자 응답 상태 확인
 */
export async function getEventAttendeesStatus(
  accessToken: string,
  refreshToken: string,
  eventId: string
): Promise<Record<string, 'accepted' | 'declined' | 'tentative' | 'needsAction'>> {
  try {
    const token = await refreshAccessTokenIfNeeded(accessToken, refreshToken)
    const calendar = await getCalendarClient(token)

    const event = await calendar.events.get({
      calendarId: 'primary',
      eventId,
    })

    if (!event.data.attendees) {
      return {}
    }

    const responses: Record<string, 'accepted' | 'declined' | 'tentative' | 'needsAction'> = {}

    for (const attendee of event.data.attendees) {
      if (attendee.email) {
        const responseStatus = attendee.responseStatus || 'needsAction'
        responses[attendee.email] = responseStatus as 'accepted' | 'declined' | 'tentative' | 'needsAction'
      }
    }

    return responses
  } catch (error: any) {
    console.error('[Google Calendar] 참석자 응답 상태 확인 실패:', {
      status: error?.response?.status ?? error?.code,
      message: error?.message,
      data: error?.response?.data,
    })

    if (error?.message?.includes('재연동')) throw error

    throw new Error(formatGoogleCalendarApiError(error, '구글 캘린더 참석자 응답 확인'))
  }
}

export interface EventWatchInfo {
  channelId: string
  resourceId: string
  expiration?: string
}

/**
 * Google Calendar 이벤트에 대해 Push Notification watch 채널을 등록합니다.
 * - address: 구글이 호출할 공개 웹훅 URL (반드시 https)
 * - token: 구글이 X-Goog-Channel-Token 헤더로 함께 전달하는 값 (매핑/검증 용도)
 */
export async function watchCalendarEvent(
  accessToken: string,
  refreshToken: string,
  eventId: string,
  params: {
    address: string
    channelId: string
    token: string
  }
): Promise<EventWatchInfo> {
  try {
    const token = await refreshAccessTokenIfNeeded(accessToken, refreshToken)
    const calendar = await getCalendarClient(token)

    // googleapis 버전/타입에 따라 `events.watch`의 파라미터 타입이 다를 수 있습니다.
    // 실제 런타임에서는 정상 동작하므로 타입 에러만 제거하기 위해 `as any`로 감쌉니다.
    const response = await (calendar.events as any).watch({
      calendarId: 'primary',
      eventId,
      requestBody: {
        id: params.channelId,
        type: 'web_hook',
        address: params.address,
        token: params.token,
      },
    } as any)

    if (!response.data?.id || !response.data?.resourceId) {
      throw new Error('watch 등록 결과에서 id/resourceId를 확인할 수 없습니다.')
    }

    return {
      channelId: response.data.id,
      resourceId: response.data.resourceId,
      expiration: response.data.expiration,
    }
  } catch (error: any) {
    if (
      error?.code === 401 ||
      error?.message?.includes('invalid authentication credentials') ||
      error?.response?.status === 401
    ) {
      throw new Error(
        '구글 캘린더 인증이 만료되었거나 유효하지 않습니다. ' +
          '구글 캘린더를 재연동해주세요. (/dashboard/connect-calendar)',
      )
    }

    if (error?.message?.includes('재연동')) throw error

    throw new Error(`이벤트 watch 등록 실패: ${error?.message || '알 수 없는 오류'}`)
  }
}

/**
 * Google Calendar 이벤트 watch 채널을 중지(stop)합니다.
 * - stop은 channels.stop API를 사용합니다.
 */
export async function stopCalendarEventWatch(
  accessToken: string,
  refreshToken: string,
  params: {
    channelId: string
    resourceId: string
  }
): Promise<void> {
  try {
    const token = await refreshAccessTokenIfNeeded(accessToken, refreshToken)
    const calendar = await getCalendarClient(token)

    await calendar.channels.stop({
      requestBody: {
        id: params.channelId,
        resourceId: params.resourceId,
      },
    })
  } catch (error: any) {
    // stop은 이미 만료된 채널일 수 있으므로 "재연동 필요" 정도만 명확히 전달합니다.
    if (
      error?.code === 401 ||
      error?.message?.includes('invalid authentication credentials') ||
      error?.response?.status === 401
    ) {
      throw new Error(
        '구글 캘린더 인증이 만료되었거나 유효하지 않습니다. ' +
          '구글 캘린더를 재연동해주세요. (/dashboard/connect-calendar)',
      )
    }

    if (error?.message?.includes('재연동')) throw error

    // stop 실패는 치명적이지 않도록 로그만 남기고 에러를 던지지 않습니다.
    console.error('이벤트 watch 중지 실패:', error)
  }
}
