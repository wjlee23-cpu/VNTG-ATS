import { Resend } from 'resend'

// Resend 클라이언트 초기화 (API 키가 있을 때만)
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

export interface EmailOptions {
  to: string
  from?: string
  subject: string
  html: string
  replyTo?: string
}

/**
 * 이메일 발송 함수
 */
export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    if (!resend || !process.env.RESEND_API_KEY) {
      console.warn('RESEND_API_KEY가 설정되지 않았습니다. 이메일이 발송되지 않습니다.')
      return { success: false, error: 'RESEND_API_KEY가 설정되지 않았습니다.' }
    }

    const fromEmail = options.from || process.env.RESEND_FROM_EMAIL || 'noreply@example.com'
    const fromName = process.env.RESEND_FROM_NAME || 'VNTG ATS'

    if (!resend) {
      return { success: false, error: 'RESEND_API_KEY가 설정되지 않았습니다.' }
    }

    const result = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      replyTo: options.replyTo,
    })

    if (result.error) {
      console.error('Resend API 에러:', result.error)
      return { success: false, error: result.error.message || '이메일 발송에 실패했습니다.' }
    }

    return { success: true, messageId: result.data?.id }
  } catch (error) {
    console.error('이메일 발송 중 에러:', error)
    return { success: false, error: error instanceof Error ? error.message : '알 수 없는 에러가 발생했습니다.' }
  }
}

/**
 * 일정 선택 링크 생성
 */
export function generateScheduleSelectionUrl(candidateId: string, token: string, baseUrl?: string): string {
  const appUrl = baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${appUrl}/candidates/${candidateId}/schedule?token=${token}`
}
