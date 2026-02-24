'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { getCurrentUser, verifyCandidateAccess } from '@/api/utils/auth';
import { validateRequired, validateEmail, validateUUID } from '@/api/utils/validation';
import { withErrorHandling } from '@/api/utils/errors';
import { sendEmail } from '@/lib/email/resend';
import { sendEmailViaGmail, listMessages, getMessage } from '@/lib/email/gmail';

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
    const { error: timelineError } = await supabase.from('timeline_events').insert({
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

    if (timelineError) {
      console.error('[타임라인] 이벤트 생성 실패 (이메일 발송):', {
        error: timelineError,
        code: timelineError.code,
        message: timelineError.message,
        details: timelineError.details,
        hint: timelineError.hint,
        candidateId,
        type: 'email',
        emailId: emailRecord.id,
      });
      if (timelineError.code === '23514') {
        console.error('[타임라인] DB 스키마 제약 조건 위반 - email 타입이 허용되지 않음.');
      }
      if (timelineError.code === '42501' || timelineError.message?.includes('row-level security')) {
        console.error('[타임라인] RLS 정책 위반 - 권한 문제.');
      }
    }

    // 캐시 무효화
    revalidatePath(`/dashboard/candidates/${candidateId}`);

    if (!emailResult.success) {
      console.warn('이메일 발송 실패:', emailResult.error)
      // 이메일 발송 실패해도 DB에는 저장되었으므로 성공으로 처리
    }

    return { success: true, emailSent: emailResult.success };
  });
}

/**
 * 후보자와 주고받은 Gmail 이메일 동기화
 * @param candidateId 후보자 ID
 * @param daysBack 동기화할 기간 (일 수, 기본값: 30일)
 * @returns 동기화된 이메일 수
 */
export async function syncCandidateEmails(candidateId: string, daysBack: number = 30) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    await verifyCandidateAccess(candidateId);
    const supabase = await createClient();

    // 입력값 검증
    const validatedCandidateId = validateUUID(candidateId, '후보자 ID');

    // 후보자 정보 조회
    const { data: candidate, error: candidateError } = await supabase
      .from('candidates')
      .select('id, email, name')
      .eq('id', validatedCandidateId)
      .single();

    if (candidateError || !candidate) {
      throw new Error('후보자를 찾을 수 없습니다.');
    }

    // 현재 사용자의 Google Workspace 토큰 조회
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

    // 날짜 범위 계산
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    // Gmail 검색 쿼리 생성 (후보자 이메일과 주고받은 이메일)
    const query = `(from:${candidate.email} OR to:${candidate.email}) after:${Math.floor(startDate.getTime() / 1000)} before:${Math.floor(endDate.getTime() / 1000)}`;

    // Gmail에서 메시지 목록 조회
    const messageIds = await listMessages(
      currentUserData.calendar_access_token,
      currentUserData.calendar_refresh_token,
      query,
      100 // 최대 100개까지 조회
    );

    if (messageIds.length === 0) {
      return { synced: 0, message: '동기화할 이메일이 없습니다.' };
    }

    // 기존에 저장된 이메일의 message_id 조회 (중복 방지)
    const { data: existingEmails } = await supabase
      .from('emails')
      .select('message_id')
      .eq('candidate_id', validatedCandidateId);

    const existingMessageIds = new Set(existingEmails?.map(e => e.message_id) || []);

    // 각 메시지 상세 조회 및 저장
    let syncedCount = 0;
    const errors: string[] = [];

    for (const messageId of messageIds) {
      try {
        // 이미 저장된 이메일이면 건너뛰기
        if (existingMessageIds.has(messageId)) {
          continue;
        }

        // 메시지 상세 조회
        const message = await getMessage(
          currentUserData.calendar_access_token,
          currentUserData.calendar_refresh_token,
          messageId
        );

        // 이메일 방향 결정 (from이 후보자면 inbound, to가 후보자면 outbound)
        const isInbound = message.from.toLowerCase().includes(candidate.email.toLowerCase());
        const isOutbound = message.to.toLowerCase().includes(candidate.email.toLowerCase());

        // 방향이 명확하지 않으면 from 기준으로 판단
        const direction = isInbound ? 'inbound' : 'outbound';

        // 이메일 저장
        const { error: emailInsertError } = await supabase.from('emails').insert({
          candidate_id: validatedCandidateId,
          message_id: messageId,
          subject: message.subject,
          body: message.body,
          from_email: message.from,
          to_email: message.to,
          direction,
          sent_at: direction === 'outbound' ? message.sentAt : null,
          received_at: direction === 'inbound' ? (message.receivedAt || message.sentAt) : null,
        });

        if (emailInsertError) {
          // UNIQUE 제약 조건 위반은 이미 저장된 것으로 간주
          if (emailInsertError.code !== '23505') {
            errors.push(`메시지 ${messageId} 저장 실패: ${emailInsertError.message}`);
          }
          continue;
        }

        // 타임라인 이벤트 생성 (수신 이메일만)
        if (direction === 'inbound') {
          const { data: timelineData, error: timelineError } = await supabase.from('timeline_events').insert({
            candidate_id: validatedCandidateId,
            type: 'email_received',
            content: {
              message: `이메일을 수신했습니다: ${message.subject}`,
              subject: message.subject,
              from_email: message.from,
              to_email: message.to,
              message_id: messageId,
            },
            created_by: null, // 시스템 자동 생성
          }).select();

          if (timelineError) {
            console.error('[타임라인] 이벤트 생성 실패 (이메일 수신):', {
              error: timelineError,
              code: timelineError.code,
              message: timelineError.message,
              details: timelineError.details,
              hint: timelineError.hint,
              candidateId: validatedCandidateId,
              type: 'email_received',
              messageId,
            });
            console.error('[타임라인] 에러 상세:', JSON.stringify(timelineError, null, 2));
            // DB 제약 조건 위반인지 확인
            if (timelineError.code === '23514') {
              console.error('[타임라인] DB 스키마 제약 조건 위반 - email_received 타입이 허용되지 않음. 마이그레이션을 확인하세요.');
              console.error('[타임라인] 마이그레이션 파일: 20260225000000_extend_timeline_event_types.sql');
              errors.push(`타임라인 이벤트 생성 실패 (메시지 ${messageId}): DB 스키마 제약 조건 위반`);
            } else if (timelineError.code === '42501' || timelineError.message?.includes('row-level security')) {
              console.error('[타임라인] RLS 정책 위반 - 권한 문제. Service Role Client 사용 필요할 수 있음.');
              errors.push(`타임라인 이벤트 생성 실패 (메시지 ${messageId}): RLS 정책 위반`);
            } else {
              errors.push(`타임라인 이벤트 생성 실패 (메시지 ${messageId}): ${timelineError.message}`);
            }
          } else {
            console.log(`[타임라인] 이벤트 생성 성공 (이메일 수신):`, timelineData?.[0]?.id);
          }
        }

        syncedCount++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
        errors.push(`메시지 ${messageId} 처리 실패: ${errorMessage}`);
        console.error(`이메일 동기화 중 오류 (messageId: ${messageId}):`, error);
      }
    }

    // 캐시 무효화
    revalidatePath(`/dashboard/candidates/${validatedCandidateId}`);

    return {
      synced: syncedCount,
      total: messageIds.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `${syncedCount}개의 이메일이 동기화되었습니다.`,
    };
  });
}

/**
 * 모든 후보자의 이메일 일괄 동기화
 * @param daysBack 동기화할 기간 (일 수, 기본값: 30일)
 * @returns 동기화 결과 요약
 */
export async function syncAllCandidateEmails(daysBack: number = 30) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const supabase = await createClient();

    // 현재 사용자의 Google Workspace 토큰 조회
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

    // 조직의 모든 후보자 조회
    const { data: jobPosts } = await supabase
      .from('job_posts')
      .select('id')
      .eq('organization_id', user.organizationId);

    if (!jobPosts || jobPosts.length === 0) {
      return { totalCandidates: 0, totalSynced: 0, results: [] };
    }

    const jobPostIds = jobPosts.map(jp => jp.id);
    const { data: candidates } = await supabase
      .from('candidates')
      .select('id, email, name')
      .in('job_post_id', jobPostIds);

    if (!candidates || candidates.length === 0) {
      return { totalCandidates: 0, totalSynced: 0, results: [] };
    }

    // 각 후보자별로 동기화 실행
    const results: Array<{ candidateId: string; candidateName: string; synced: number; error?: string }> = [];
    let totalSynced = 0;

    for (const candidate of candidates) {
      try {
        const result = await syncCandidateEmails(candidate.id, daysBack);
        results.push({
          candidateId: candidate.id,
          candidateName: candidate.name,
          synced: result.synced || 0,
        });
        totalSynced += result.synced || 0;
      } catch (error) {
        results.push({
          candidateId: candidate.id,
          candidateName: candidate.name,
          synced: 0,
          error: error instanceof Error ? error.message : '알 수 없는 오류',
        });
      }
    }

    return {
      totalCandidates: candidates.length,
      totalSynced,
      results,
    };
  });
}
