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
 * 토큰의 스코프 확인
 * @param accessToken Google OAuth access token
 * @returns 토큰에 포함된 스코프 목록
 */
async function getTokenScopes(accessToken: string): Promise<string[]> {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/google`
    )

    oauth2Client.setCredentials({
      access_token: accessToken,
    })

    const tokenInfo = await oauth2Client.getTokenInfo(accessToken)
    return tokenInfo.scopes || []
  } catch (error) {
    console.error('토큰 스코프 확인 실패:', error)
    return []
  }
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
  
  // 토큰 스코프 확인
  const scopes = await getTokenScopes(token)
  const hasGmailScope = scopes.some(scope => 
    scope.includes('gmail.send') || scope === 'https://www.googleapis.com/auth/gmail.send'
  )

  if (!hasGmailScope) {
    throw new Error('GMAIL_SCOPE_MISSING: 토큰에 Gmail 발송 권한이 없습니다. 구글 캘린더를 재연동해주세요.')
  }
  
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
 * RFC 2047 형식으로 이메일 제목 인코딩 (한글 깨짐 방지)
 * @param text 인코딩할 텍스트
 * @returns RFC 2047 형식으로 인코딩된 제목
 */
function encodeSubject(text: string): string {
  // ASCII 문자만 포함된 경우 인코딩 불필요
  if (/^[\x00-\x7F]*$/.test(text)) {
    return text
  }
  
  // UTF-8 Base64 인코딩
  const encoded = Buffer.from(text, 'utf-8').toString('base64')
  // RFC 2047 형식: =?charset?encoding?encoded-text?=
  return `=?UTF-8?B?${encoded}?=`
}

/**
 * MIME 메시지 생성 (RFC 2822 형식)
 */
function createMimeMessage(options: EmailOptions): string {
  const from = options.from || 'noreply@example.com'
  const replyTo = options.replyTo || from
  
  // 제목을 RFC 2047 형식으로 인코딩 (한글 깨짐 방지)
  const encodedSubject = encodeSubject(options.subject)
  
  // MIME 메시지 구성
  const message = [
    `From: ${from}`,
    `To: ${options.to}`,
    `Reply-To: ${replyTo}`,
    `Subject: ${encodedSubject}`,
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
    
    // 토큰 스코프 부족 에러 확인
    if (error.message && error.message.includes('GMAIL_SCOPE_MISSING')) {
      return {
        success: false,
        error: `이메일 발송 실패: Gmail API 권한이 부족합니다. 기존 토큰에 Gmail 스코프가 없어 재연동이 필요합니다. 다음을 확인해주세요:\n1. Google Cloud Console에서 Gmail API 활성화 확인\n2. OAuth 동의 화면에 gmail.send 스코프 추가 확인\n3. 구글 캘린더 재연동 시 모든 권한 승인`,
      }
    }
    
    // 에러 메시지 추출
    let errorMessage = '알 수 없는 에러가 발생했습니다.'
    if (error.response?.data?.error?.message) {
      errorMessage = error.response.data.error.message
    } else if (error.message) {
      errorMessage = error.message
    }

    // Gmail API 스코프 부족 에러인지 확인
    const isScopeError = errorMessage.includes('insufficient authentication scopes') ||
                        errorMessage.includes('insufficient') ||
                        errorMessage.toLowerCase().includes('scope') ||
                        (error.response?.data?.error?.status === 'PERMISSION_DENIED' && 
                         errorMessage.toLowerCase().includes('gmail'))

    if (isScopeError) {
      return {
        success: false,
        error: `이메일 발송 실패: Request had insufficient authentication scopes. Gmail API 권한이 필요합니다. 다음을 확인해주세요:\n1. Google Cloud Console에서 Gmail API 활성화 확인\n2. OAuth 동의 화면에 gmail.send 스코프 추가 확인\n3. 구글 캘린더 재연동 시 모든 권한 승인`,
      }
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

/**
 * Gmail에서 메시지 목록 조회
 * @param accessToken Google OAuth access token
 * @param refreshToken Google OAuth refresh token
 * @param query 검색 쿼리 (예: 'from:example@gmail.com' 또는 'to:example@gmail.com')
 * @param maxResults 최대 결과 수 (기본값: 50)
 * @returns 메시지 ID 목록
 */
export async function listMessages(
  accessToken: string,
  refreshToken: string,
  query: string,
  maxResults: number = 50
): Promise<string[]> {
  try {
    const gmail = await getGmailClient(accessToken, refreshToken)
    
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults,
    })
    
    return response.data.messages?.map(msg => msg.id || '') || []
  } catch (error: any) {
    console.error('Gmail 메시지 목록 조회 실패:', error)
    throw new Error(`메시지 목록 조회 실패: ${error.message || '알 수 없는 오류'}`)
  }
}

/**
 * Gmail에서 특정 메시지 상세 조회
 * @param accessToken Google OAuth access token
 * @param refreshToken Google OAuth refresh token
 * @param messageId 메시지 ID
 * @returns 메시지 상세 정보
 */
export async function getMessage(
  accessToken: string,
  refreshToken: string,
  messageId: string
): Promise<{
  id: string
  threadId: string
  subject: string
  from: string
  to: string
  body: string
  sentAt: string
  receivedAt?: string
}> {
  try {
    const gmail = await getGmailClient(accessToken, refreshToken)
    
    const response = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    })
    
    const message = response.data
    const headers = message.payload?.headers || []
    
    // 헤더에서 정보 추출
    const getHeader = (name: string): string => {
      const header = headers.find(h => h.name?.toLowerCase() === name.toLowerCase())
      return header?.value || ''
    }
    
    const subject = getHeader('Subject')
    const from = getHeader('From')
    const to = getHeader('To')
    const date = getHeader('Date')
    
    // 본문 추출
    let body = ''
    if (message.payload?.body?.data) {
      body = Buffer.from(message.payload.body.data, 'base64').toString('utf-8')
    } else if (message.payload?.parts) {
      // 멀티파트 메시지인 경우
      for (const part of message.payload.parts) {
        if (part.mimeType === 'text/plain' || part.mimeType === 'text/html') {
          if (part.body?.data) {
            body = Buffer.from(part.body.data, 'base64').toString('utf-8')
            break
          }
        }
      }
    }
    
    return {
      id: message.id || messageId,
      threadId: message.threadId || '',
      subject,
      from,
      to,
      body,
      sentAt: date || new Date().toISOString(),
      receivedAt: message.internalDate ? new Date(parseInt(message.internalDate)).toISOString() : undefined,
    }
  } catch (error: any) {
    console.error('Gmail 메시지 조회 실패:', error)
    throw new Error(`메시지 조회 실패: ${error.message || '알 수 없는 오류'}`)
  }
}