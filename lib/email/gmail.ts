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
export async function getGmailClient(accessToken: string, refreshToken: string, requireReadScope: boolean = false, userId?: string) {
  // 환경 변수 확인
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.error('[Gmail API] ❌ 환경 변수 미설정:', {
      hasClientId: !!process.env.GOOGLE_CLIENT_ID,
      hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
    });
    throw new Error('Gmail API를 사용하려면 GOOGLE_CLIENT_ID와 GOOGLE_CLIENT_SECRET 환경 변수가 필요합니다. .env 파일을 확인하세요.')
  }
  
  console.log('[Gmail API] 환경 변수 확인 완료');
  
  // 토큰이 만료되었을 수 있으므로 먼저 갱신 확인 (userId가 있으면 갱신된 토큰을 DB에 저장)
  const token = await refreshAccessTokenIfNeeded(accessToken, refreshToken, userId)
  
  // 토큰 스코프 확인
  const scopes = await getTokenScopes(token)
  console.log('[Gmail API] 토큰 스코프:', scopes);
  
  const hasGmailSendScope = scopes.some(scope => 
    scope.includes('gmail.send') || scope === 'https://www.googleapis.com/auth/gmail.send'
  )
  const hasGmailReadScope = scopes.some(scope => 
    scope.includes('gmail.readonly') || 
    scope === 'https://www.googleapis.com/auth/gmail.readonly' ||
    scope === 'https://www.googleapis.com/auth/gmail'
  )
  
  console.log('[Gmail API] 스코프 확인:', {
    hasGmailSendScope,
    hasGmailReadScope,
    requireReadScope,
  });

  // 읽기 권한이 필요한 경우 확인
  if (requireReadScope && !hasGmailReadScope) {
    console.error('[Gmail API] ❌ Gmail 읽기 권한이 없습니다.');
    console.error('[Gmail API] 현재 스코프:', scopes);
    console.error('[Gmail API] 필요한 스코프: gmail.readonly 또는 gmail');
    throw new Error('GMAIL_READ_SCOPE_MISSING: 토큰에 Gmail 읽기 권한이 없습니다. 구글 캘린더를 재연동하여 Gmail 읽기 권한을 승인해주세요. (필요한 스코프: gmail.readonly 또는 gmail)')
  }

  // 발송 권한 확인 (읽기만 필요한 경우는 체크하지 않음)
  if (!requireReadScope && !hasGmailSendScope) {
    console.error('[Gmail API] ❌ Gmail 발송 권한이 없습니다.');
    console.error('[Gmail API] 현재 스코프:', scopes);
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
  options: EmailOptions,
  userId?: string // userId가 전달되면 토큰 갱신 시 DB에 자동 저장
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // Gmail API 클라이언트 생성 (userId 전달하여 토큰 갱신 시 DB 저장)
    const gmail = await getGmailClient(accessToken, refreshToken, false, userId)

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
 * Gmail에서 메시지 목록 조회 (페이지네이션 지원)
 * @param accessToken Google OAuth access token
 * @param refreshToken Google OAuth refresh token
 * @param query 검색 쿼리 (예: 'from:example@gmail.com' 또는 'to:example@gmail.com')
 * @param maxResults 최대 결과 수 (기본값: 50, 최대 500)
 * @returns 메시지 ID 목록
 */
export async function listMessages(
  accessToken: string,
  refreshToken: string,
  query: string,
  maxResults: number = 50,
  userId?: string // userId가 전달되면 토큰 갱신 시 DB에 자동 저장
): Promise<string[]> {
  try {
    // 읽기 권한이 필요하므로 requireReadScope를 true로 설정 (userId 전달)
    const gmail = await getGmailClient(accessToken, refreshToken, true, userId)
    
    // Gmail API는 한 번에 최대 500개까지 조회 가능
    const pageSize = Math.min(maxResults, 500);
    console.log(`[Gmail API] 검색 쿼리 실행: ${query}, maxResults: ${maxResults}, pageSize: ${pageSize}`);
    
    const allMessageIds: string[] = [];
    let nextPageToken: string | undefined = undefined;
    let pageCount = 0;
    const maxPages = Math.ceil(maxResults / pageSize); // 최대 페이지 수 계산
    
    do {
      pageCount++;
      console.log(`[Gmail API] 페이지 ${pageCount} 조회 중... (이미 조회된 메시지: ${allMessageIds.length}개)`);
      
      // googleapis 타입 추론이 꼬여서(또는 응답 스키마 제네릭 추론 실패) `response`가 implicit any로 잡힐 수 있어,
      // 여기서는 실제 사용되는 형태만 유지하면서 타입 에러만 제거합니다.
      const response: any = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: pageSize,
        pageToken: nextPageToken,
      })
      
      const pageMessageIds =
        response.data.messages?.map((msg: any) => msg.id || '').filter((id: any) => id) || [];
      allMessageIds.push(...pageMessageIds);
      
      nextPageToken = response.data.nextPageToken;
      
      // 상세 로깅 (resultSizeEstimate 포함)
      const resultSizeEstimate = response.data.resultSizeEstimate || 0;
      console.log(`[Gmail API] 페이지 ${pageCount} 결과: ${pageMessageIds.length}개 메시지 조회`);
      console.log(`[Gmail API] 페이지 ${pageCount} 응답 정보:`, {
        resultSizeEstimate: resultSizeEstimate,
        actualMessages: pageMessageIds.length,
        nextPageToken: nextPageToken ? '있음' : '없음',
        totalCollected: allMessageIds.length,
      });
      
      // resultSizeEstimate 분석 및 경고
      if (resultSizeEstimate > 0 && pageMessageIds.length === 0) {
        console.warn(`[Gmail API] ⚠️ resultSizeEstimate(${resultSizeEstimate})가 있지만 실제 메시지가 없습니다.`);
        console.warn(`[Gmail API] ⚠️ 이는 Gmail API가 예상하는 결과 수와 실제 반환된 결과가 다를 수 있음을 의미합니다.`);
      } else if (resultSizeEstimate > pageMessageIds.length) {
        console.log(`[Gmail API] ℹ️ resultSizeEstimate(${resultSizeEstimate})가 실제 메시지 수(${pageMessageIds.length})보다 큽니다.`);
        console.log(`[Gmail API] ℹ️ 더 많은 메시지가 있을 수 있지만 현재 페이지에서는 일부만 반환되었습니다.`);
      } else if (resultSizeEstimate === pageMessageIds.length) {
        console.log(`[Gmail API] ✅ resultSizeEstimate(${resultSizeEstimate})와 실제 메시지 수(${pageMessageIds.length})가 일치합니다.`);
      }
      
      // 최대 결과 수에 도달하면 중단
      if (allMessageIds.length >= maxResults) {
        console.log(`[Gmail API] 최대 결과 수(${maxResults})에 도달하여 조회 중단`);
        break;
      }
      
      // 최대 페이지 수에 도달하면 중단
      if (pageCount >= maxPages) {
        console.log(`[Gmail API] 최대 페이지 수(${maxPages})에 도달하여 조회 중단`);
        break;
      }
      
    } while (nextPageToken);
    
    // 최대 결과 수만큼만 반환
    const finalMessageIds = allMessageIds.slice(0, maxResults);
    
    // 전체 resultSizeEstimate 요약 (첫 페이지의 값 사용)
    const firstPageEstimate = allMessageIds.length > 0 ? (allMessageIds.length > 0 ? '첫 페이지에서 확인됨' : '없음') : '없음';
    
    console.log(`[Gmail API] 검색 완료: 총 ${finalMessageIds.length}개의 메시지 ID 조회 성공 (${pageCount}페이지)`);
    console.log(`[Gmail API] 검색 요약:`, {
      query,
      totalMessages: finalMessageIds.length,
      pages: pageCount,
      resultSizeEstimate: firstPageEstimate,
    });
    
    // 검색 결과가 없을 때 추가 정보 로깅
    if (finalMessageIds.length === 0) {
      console.warn(`[Gmail API] ⚠️ 검색 결과가 없습니다. 쿼리: ${query}`);
      console.warn(`[Gmail API] ⚠️ 가능한 원인:`);
      console.warn(`[Gmail API]   1. Gmail에 해당 검색 조건에 맞는 이메일이 없을 수 있습니다.`);
      console.warn(`[Gmail API]   2. 검색 쿼리 형식이 잘못되었을 수 있습니다.`);
      console.warn(`[Gmail API]   3. Gmail 인덱싱 지연으로 최근 이메일이 아직 검색되지 않을 수 있습니다.`);
      console.warn(`[Gmail API] ⚠️ 해결 방법: Gmail 웹 인터페이스에서 직접 같은 검색 쿼리를 시도해보세요.`);
    }
    
    return finalMessageIds;
  } catch (error: any) {
    console.error('[Gmail API] 메시지 목록 조회 실패:', error);
    console.error('[Gmail API] 에러 상세:', {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText,
      response: error.response?.data,
      query: query, // 검색 쿼리도 로깅
    });
    
    // Gmail API 에러 응답 상세 분석
    if (error.response?.data) {
      const errorData = error.response.data;
      console.error('[Gmail API] 에러 응답 상세 분석:', {
        error: errorData.error,
        error_description: errorData.error_description,
        error_details: errorData.error_details,
        message: errorData.message,
      });
      
      // 에러 코드별 상세 정보
      if (errorData.error) {
        console.error('[Gmail API] 에러 코드:', errorData.error.code || errorData.error.status || 'N/A');
        console.error('[Gmail API] 에러 메시지:', errorData.error.message || errorData.message || 'N/A');
        if (errorData.error.errors) {
          console.error('[Gmail API] 에러 세부사항:', JSON.stringify(errorData.error.errors, null, 2));
        }
      }
    }
    
    // 권한 부족 에러인 경우 명확한 메시지 반환
    if (error.message && error.message.includes('GMAIL_READ_SCOPE_MISSING')) {
      throw new Error('Gmail 읽기 권한이 없습니다. 구글 캘린더를 재연동하여 Gmail 읽기 권한을 승인해주세요.')
    }
    
    // 스코프 부족 에러 확인
    const errorMessage = error.response?.data?.error?.message || error.message || '알 수 없는 오류'
    if (errorMessage.includes('insufficient authentication scopes') || 
        errorMessage.includes('insufficient') ||
        errorMessage.toLowerCase().includes('scope')) {
      throw new Error('Gmail 읽기 권한이 부족합니다. Google Cloud Console에서 Gmail API를 활성화하고, OAuth 동의 화면에 gmail.readonly 스코프를 추가한 후 구글 캘린더를 재연동해주세요.')
    }
    
    // 400 Bad Request 에러 (검색 쿼리 형식 오류 가능성)
    if (error.response?.status === 400) {
      console.error('[Gmail API] ⚠️ 400 Bad Request: 검색 쿼리 형식이 잘못되었을 수 있습니다.');
      console.error('[Gmail API] ⚠️ 시도한 검색 쿼리:', query);
      console.error('[Gmail API] ⚠️ Gmail 웹 인터페이스에서 다음 쿼리를 직접 테스트해보세요:', query);
    }
    
    throw new Error(`메시지 목록 조회 실패: ${errorMessage}`)
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
  messageId: string,
  userId?: string // userId가 전달되면 토큰 갱신 시 DB에 자동 저장
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
    // 읽기 권한이 필요하므로 requireReadScope를 true로 설정 (userId 전달)
    const gmail = await getGmailClient(accessToken, refreshToken, true, userId)
    
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
    
    // 권한 부족 에러인 경우 명확한 메시지 반환
    if (error.message && error.message.includes('GMAIL_READ_SCOPE_MISSING')) {
      throw new Error('Gmail 읽기 권한이 없습니다. 구글 캘린더를 재연동하여 Gmail 읽기 권한을 승인해주세요.')
    }
    
    // 스코프 부족 에러 확인
    const errorMessage = error.response?.data?.error?.message || error.message || '알 수 없는 오류'
    if (errorMessage.includes('insufficient authentication scopes') || 
        errorMessage.includes('insufficient') ||
        errorMessage.toLowerCase().includes('scope')) {
      throw new Error('Gmail 읽기 권한이 부족합니다. Google Cloud Console에서 Gmail API를 활성화하고, OAuth 동의 화면에 gmail.readonly 스코프를 추가한 후 구글 캘린더를 재연동해주세요.')
    }
    
    throw new Error(`메시지 조회 실패: ${errorMessage}`)
  }
}