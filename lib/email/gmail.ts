import { google } from 'googleapis'
import { refreshAccessTokenIfNeeded } from '@/lib/calendar/google'

export interface EmailOptions {
  to: string
  from?: string
  subject: string
  html: string
  replyTo?: string
}

/**
 * Gmail API 클라이언트 생성
 * @param accessToken Google OAuth access token
 * @param refreshToken Google OAuth refresh token (토큰 갱신용)
 * @returns Gmail API 클라이언트
 */
export async function getGmailClient(accessToken: string, refreshToken: string) {
  // 토큰이 만료되었을 수 있으므로 먼저 갱신 확인
  const token = await refreshAccessTokenIfNeeded(accessToken, refreshToken)
  
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/google`
  )

  oauth2Client.setCredentials({
    access_token: token,
  })

  return google.gmail({ version: 'v1', auth: oauth2Client })
}

/**
 * MIME 메시지 생성 (RFC 2822 형식)
 */
function createMimeMessage(options: EmailOptions): string {
  const from = options.from || 'noreply@example.com'
  const replyTo = options.replyTo || from
  
  // MIME 메시지 구성
  const message = [
    `From: ${from}`,
    `To: ${options.to}`,
    `Reply-To: ${replyTo}`,
    `Subject: ${options.subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`,
    ``,
    options.html,
  ].join('\r\n')

  return message
}

/**
 * Gmail API를 사용하여 이메일 발송
 * @param accessToken Google OAuth access token
 * @param refreshToken Google OAuth refresh token
 * @param options 이메일 옵션
 * @returns 발송 결과
 */
export async function sendEmailViaGmail(
  accessToken: string,
  refreshToken: string,
  options: EmailOptions
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // Gmail API 클라이언트 생성
    const gmail = await getGmailClient(accessToken, refreshToken)

    // MIME 메시지 생성
    const mimeMessage = createMimeMessage(options)

    // Base64 URL-safe 인코딩
    const encodedMessage = Buffer.from(mimeMessage)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

    // Gmail API로 메시지 전송
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
      },
    })

    if (response.data.id) {
      return {
        success: true,
        messageId: response.data.id,
      }
    } else {
      return {
        success: false,
        error: '이메일 발송에 실패했습니다. 메시지 ID를 받지 못했습니다.',
      }
    }
  } catch (error: any) {
    console.error('Gmail API 이메일 발송 중 에러:', error)
    
    // 에러 메시지 추출
    let errorMessage = '알 수 없는 에러가 발생했습니다.'
    if (error.response?.data?.error?.message) {
      errorMessage = error.response.data.error.message
    } else if (error.message) {
      errorMessage = error.message
    }

    return {
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * 일정 선택 링크 생성 (기존 함수와 동일)
 */
export function generateScheduleSelectionUrl(candidateId: string, token: string, baseUrl?: string): string {
  const appUrl = baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${appUrl}/candidates/${candidateId}/schedule?token=${token}`
}
