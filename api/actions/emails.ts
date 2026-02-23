'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { getCurrentUser, verifyCandidateAccess } from '@/api/utils/auth';
import { validateRequired, validateEmail, validateUUID } from '@/api/utils/validation';
import { withErrorHandling } from '@/api/utils/errors';
import { sendEmail } from '@/lib/email/resend';

/**
 * 후보자에게 이메일 발송
 * 초기 구현: 타임라인 이벤트만 생성 (실제 이메일 발송은 추후 구현)
 * @param formData 이메일 정보 (candidate_id, to_email, subject, body)
 * @returns 성공 여부
 */
export async function sendEmailToCandidate(formData: FormData) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const supabase = await createClient();

    // 현재 사용자의 Google Workspace 토큰 조회 (Gmail API 사용을 위해)
    const { data: currentUserData, error: userTokenError } = await supabase
      .from('users')
      .select('calendar_access_token, calendar_refresh_token, email')
      .eq('id', user.userId)
      .single();

    if (userTokenError || !currentUserData) {
      throw new Error('사용자 정보를 찾을 수 없습니다.');
    }

    if (!currentUserData.calendar_access_token || !currentUserData.calendar_refresh_token) {
      throw new Error('Google Workspace 계정이 연동되지 않았습니다. 구글 캘린더를 먼저 연동해주세요.');
    }

    // 입력값 검증
    const candidateId = validateUUID(validateRequired(formData.get('candidate_id'), '후보자 ID'), '후보자 ID');
    const toEmail = validateEmail(validateRequired(formData.get('to_email'), '수신자 이메일'));
    const subject = validateRequired(formData.get('subject'), '이메일 제목');
    const body = validateRequired(formData.get('body'), '이메일 내용');

    // 후보자 접근 권한 확인
    await verifyCandidateAccess(candidateId);

    // 후보자 정보 조회 (이메일 확인)
    const { data: candidate, error: candidateError } = await supabase
      .from('candidates')
      .select('id, email, name')
      .eq('id', candidateId)
      .single();

    if (candidateError || !candidate) {
      throw new Error('후보자를 찾을 수 없습니다.');
    }

    if (candidate.email !== toEmail) {
      throw new Error('수신자 이메일이 후보자 이메일과 일치하지 않습니다.');
    }

    // 이메일 테이블에 저장 (Phase 2)
    const { data: emailRecord, error: emailError } = await supabase
      .from('emails')
      .insert({
        candidate_id: candidateId,
        message_id: `email-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        subject,
        body,
        from_email: user.email,
        to_email: toEmail,
        direction: 'outbound',
        sent_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (emailError) {
      throw new Error(`이메일 저장 실패: ${emailError.message}`);
    }

    // Gmail API를 사용하여 이메일 발송
    const emailResult = await sendEmailViaGmail(
      currentUserData.calendar_access_token,
      currentUserData.calendar_refresh_token,
      {
        to: toEmail,
        from: currentUserData.email || user.email,
        subject,
        html: body.replace(/\n/g, '<br>'), // 줄바꿈을 HTML로 변환
        replyTo: currentUserData.email || user.email,
      }
    )

    // 이메일 발송 결과 업데이트
    if (emailResult.success && emailResult.messageId) {
      await supabase
        .from('emails')
        .update({ message_id: emailResult.messageId })
        .eq('id', emailRecord.id)
    }

    // 타임라인 이벤트 생성
    await supabase.from('timeline_events').insert({
      candidate_id: candidateId,
      type: 'email',
      content: {
        message: `이메일이 발송되었습니다: ${subject}`,
        subject,
        body,
        from_email: user.email,
        to_email: toEmail,
        email_id: emailRecord.id,
        sent: emailResult.success,
        error: emailResult.error,
      },
      created_by: user.userId,
    });

    // 캐시 무효화
    revalidatePath(`/dashboard/candidates/${candidateId}`);

    if (!emailResult.success) {
      console.warn('이메일 발송 실패:', emailResult.error)
      // 이메일 발송 실패해도 DB에는 저장되었으므로 성공으로 처리
    }

    return { success: true, emailSent: emailResult.success };
  });
}
