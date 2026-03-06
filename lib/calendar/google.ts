import { google } from 'googleapis'

export interface CalendarEvent {
  id: string
  summary: string
  start: { dateTime: string; timeZone: string }
  end: { dateTime: string; timeZone: string }
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
    access_type: 'offline', // refresh token 받기 위해 필수
    scope: scopes,
    prompt: 'consent', // 캘린더 연동 시 항상 동의 화면 표시하여 refresh token 확실히 받기
  })
}

/**
 * 토큰 만료 시 자동 갱신
 */
export async function refreshAccessTokenIfNeeded(
  accessToken: string,
  refreshToken: string
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

    // 토큰이 만료되었는지 확인
    const tokenInfo = await oauth2Client.getAccessToken()
    if (tokenInfo.token) {
      return tokenInfo.token
    }

    // 만료된 경우 갱신
    const { credentials } = await oauth2Client.refreshAccessToken()
    if (!credentials.access_token) {
      throw new Error('토큰 갱신에 실패했습니다. 구글 캘린더를 재연동해주세요.')
    }
    return credentials.access_token
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
 * 구글 캘린더에 이벤트 생성 (block 일정용)
 */
export async function createCalendarEvent(
  accessToken: string,
  refreshToken: string,
  eventData: {
    summary: string
    description?: string
    start: { dateTime: string; timeZone: string }
    end: { dateTime: string; timeZone: string }
    attendees: Array<{ email: string }>
    transparency?: 'opaque' | 'transparent'
  }
): Promise<string> {
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
      calendarId: 'primary',
      requestBody: event,
      sendUpdates: 'all', // 참석자들에게 초대 전송
    })

    if (!response.data.id) {
      throw new Error('이벤트 생성에 실패했습니다.')
    }

    return response.data.id
  } catch (error: any) {
    // 인증 관련 에러인지 확인
    if (error?.code === 401 || 
        error?.message?.includes('invalid authentication credentials') ||
        error?.response?.status === 401) {
      throw new Error(
        '구글 캘린더 인증이 만료되었거나 유효하지 않습니다. ' +
        '구글 캘린더를 재연동해주세요. (/dashboard/connect-calendar)'
      )
    }
    // 이미 명확한 에러 메시지가 있으면 그대로 전달
    if (error?.message?.includes('재연동')) {
      throw error
    }
    // 다른 에러는 원래 메시지와 함께 전달
    throw new Error(
      `이벤트 생성 실패: ${error?.message || '알 수 없는 오류'}. ` +
      '구글 캘린더를 재연동해주세요. (/dashboard/connect-calendar)'
    )
  }
}

/**
 * 구글 캘린더 이벤트 수정 (block → 확정 변경)
 */
export async function updateCalendarEvent(
  accessToken: string,
  refreshToken: string,
  eventId: string,
  updates: {
    summary?: string
    description?: string
    start?: { dateTime: string; timeZone: string }
    end?: { dateTime: string; timeZone: string }
    transparency?: 'opaque' | 'transparent'
  }
): Promise<void> {
  try {
    const token = await refreshAccessTokenIfNeeded(accessToken, refreshToken)
    const calendar = await getCalendarClient(token)

    // 기존 이벤트 조회
    const existingEvent = await calendar.events.get({
      calendarId: 'primary',
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
      calendarId: 'primary',
      eventId,
      requestBody: updatedEvent,
      sendUpdates: 'all', // 참석자들에게 업데이트 알림 전송
    })
  } catch (error: any) {
    // 인증 관련 에러인지 확인
    if (error?.code === 401 || 
        error?.message?.includes('invalid authentication credentials') ||
        error?.response?.status === 401) {
      throw new Error(
        '구글 캘린더 인증이 만료되었거나 유효하지 않습니다. ' +
        '구글 캘린더를 재연동해주세요. (/dashboard/connect-calendar)'
      )
    }
    // 이미 명확한 에러 메시지가 있으면 그대로 전달
    if (error?.message?.includes('재연동')) {
      throw error
    }
    // 다른 에러는 원래 메시지와 함께 전달
    throw new Error(
      `이벤트 수정 실패: ${error?.message || '알 수 없는 오류'}. ` +
      '구글 캘린더를 재연동해주세요. (/dashboard/connect-calendar)'
    )
  }
}

/**
 * 구글 캘린더 이벤트 삭제
 */
export async function deleteCalendarEvent(
  accessToken: string,
  refreshToken: string,
  eventId: string
): Promise<void> {
  try {
    const token = await refreshAccessTokenIfNeeded(accessToken, refreshToken)
    const calendar = await getCalendarClient(token)

    await calendar.events.delete({
      calendarId: 'primary',
      eventId,
      sendUpdates: 'all', // 참석자들에게 삭제 알림 전송
    })
  } catch (error: any) {
    // 인증 관련 에러인지 확인
    if (error?.code === 401 || 
        error?.message?.includes('invalid authentication credentials') ||
        error?.response?.status === 401) {
      throw new Error(
        '구글 캘린더 인증이 만료되었거나 유효하지 않습니다. ' +
        '구글 캘린더를 재연동해주세요. (/dashboard/connect-calendar)'
      )
    }
    // 이미 명확한 에러 메시지가 있으면 그대로 전달
    if (error?.message?.includes('재연동')) {
      throw error
    }
    // 다른 에러는 원래 메시지와 함께 전달
    throw new Error(
      `이벤트 삭제 실패: ${error?.message || '알 수 없는 오류'}. ` +
      '구글 캘린더를 재연동해주세요. (/dashboard/connect-calendar)'
    )
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
    // 인증 관련 에러인지 확인
    if (error?.code === 401 || 
        error?.message?.includes('invalid authentication credentials') ||
        error?.response?.status === 401) {
      throw new Error(
        '구글 캘린더 인증이 만료되었거나 유효하지 않습니다. ' +
        '구글 캘린더를 재연동해주세요. (/dashboard/connect-calendar)'
      )
    }
    // 이미 명확한 에러 메시지가 있으면 그대로 전달
    if (error?.message?.includes('재연동')) {
      throw error
    }
    // 다른 에러는 원래 메시지와 함께 전달
    throw new Error(
      `참석자 응답 상태 확인 실패: ${error?.message || '알 수 없는 오류'}. ` +
      '구글 캘린더를 재연동해주세요. (/dashboard/connect-calendar)'
    )
  }
}
