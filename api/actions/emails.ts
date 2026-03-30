'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
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
    const isAdmin = user.role === 'admin';
    // 관리자일 경우 Service Role Client를 사용하여 RLS 정책 우회
    const supabase = isAdmin ? createServiceClient() : await createClient();

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

    // 후보자 정보 조회 (이메일 확인) - 관리자는 이미 Service Client 사용 중이므로 RLS 우회
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

    // Gmail API를 사용하여 이메일 발송 (userId 전달하여 토큰 갱신 시 DB 저장)
    const emailResult = await sendEmailViaGmail(
      currentUserData.calendar_access_token,
      currentUserData.calendar_refresh_token,
      {
        to: toEmail,
        from: currentUserData.email || user.email,
        subject,
        html: body.replace(/\n/g, '<br>'), // 줄바꿈을 HTML로 변환
        replyTo: currentUserData.email || user.email,
      },
      user.userId
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
        direction: 'outbound', // 방향 정보 포함
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
 * @param daysBack 동기화할 기간 (일 수, 기본값: 90일)
 * @returns 동기화된 이메일 수
 */
export async function syncCandidateEmails(candidateId: string, daysBack: number = 90) {
  return withErrorHandling(async () => {
    console.log(`[이메일 동기화] 시작 - 후보자 ID: ${candidateId}`);
    
    const user = await getCurrentUser();
    
    // 입력값 검증
    let validatedCandidateId: string;
    try {
      validatedCandidateId = validateUUID(candidateId, '후보자 ID');
      console.log(`[이메일 동기화] 후보자 ID 검증 성공: ${validatedCandidateId}`);
    } catch (error: any) {
      console.error(`[이메일 동기화] 후보자 ID 검증 실패:`, error.message);
      throw new Error(`잘못된 후보자 ID입니다: ${error.message}`);
    }

    // 후보자 접근 권한 확인 (이미 후보자 정보를 반환하므로 재사용)
    let candidate;
    try {
      candidate = await verifyCandidateAccess(validatedCandidateId);
      console.log(`[이메일 동기화] 후보자 접근 권한 확인 성공: ${candidate.id}`);
    } catch (error: any) {
      console.error(`[이메일 동기화] 후보자 접근 권한 확인 실패:`, error.message);
      throw error; // verifyCandidateAccess의 에러 메시지를 그대로 전달
    }

    // verifyCandidateAccess가 반환한 candidate 정보 확인
    if (!candidate || !candidate.id) {
      console.error(`[이메일 동기화] 후보자 정보가 없습니다.`);
      throw new Error('후보자 정보를 가져올 수 없습니다.');
    }

    const supabase = await createClient();
    const isAdmin = user.role === 'admin';
    // 관리자일 경우 Service Role Client 사용 (RLS 정책 우회)
    const candidateSupabase = isAdmin ? createServiceClient() : supabase;

    // candidate 객체에서 email과 name 추출 (verifyCandidateAccess는 id, job_post_id만 반환할 수 있음)
    let candidateEmail = (candidate as any).email;
    let candidateName = (candidate as any).name;

    // email이나 name이 없으면 다시 조회
    if (!candidateEmail || !candidateName) {
      console.log(`[이메일 동기화] 후보자 상세 정보 재조회 필요`);
      const { data: candidateDetail, error: candidateDetailError } = await candidateSupabase
        .from('candidates')
        .select('id, email, name')
        .eq('id', validatedCandidateId)
        .single();

      if (candidateDetailError || !candidateDetail) {
        console.error(`[이메일 동기화] 후보자 상세 정보 조회 실패:`, candidateDetailError);
        throw new Error('후보자 정보를 찾을 수 없습니다.');
      }

      candidateEmail = candidateDetail.email;
      candidateName = candidateDetail.name;
      console.log(`[이메일 동기화] 후보자 상세 정보 조회 성공: ${candidateName} (${candidateEmail})`);
    }

    if (!candidateEmail) {
      console.error(`[이메일 동기화] 후보자 이메일이 없습니다.`);
      throw new Error('후보자 이메일 정보를 찾을 수 없습니다.');
    }

    // 현재 사용자의 Google Workspace 토큰 조회
    // 관리자인 경우 Service Role Client 사용 (RLS 정책 우회)
    const userSupabase = isAdmin ? createServiceClient() : supabase;
    
    console.log(`[이메일 동기화] 사용자 정보 조회 시작 - 사용자 ID: ${user.userId}, 관리자: ${isAdmin}`);
    
    const { data: currentUserData, error: userTokenError } = await userSupabase
      .from('users')
      .select('calendar_access_token, calendar_refresh_token, email')
      .eq('id', user.userId)
      .single();

    if (userTokenError) {
      console.error(`[이메일 동기화] 사용자 정보 조회 실패:`, userTokenError);
      
      // RLS 정책 위반인 경우
      if (userTokenError.code === 'PGRST116' || userTokenError.message?.includes('row-level security') || userTokenError.message?.includes('RLS')) {
        throw new Error('사용자 정보에 접근할 권한이 없습니다. 관리자에게 문의하세요.');
      }
      
      // 데이터가 없는 경우
      if (userTokenError.code === 'PGRST116' || userTokenError.message?.includes('No rows') || userTokenError.message?.includes('0 rows')) {
        throw new Error('사용자 정보를 찾을 수 없습니다. 로그인 상태를 확인해주세요.');
      }
      
      throw new Error(`사용자 정보 조회 실패: ${userTokenError.message || '알 수 없는 오류'}`);
    }

    if (!currentUserData) {
      console.error(`[이메일 동기화] 사용자 데이터가 없습니다.`);
      throw new Error('사용자 정보를 찾을 수 없습니다.');
    }

    console.log(`[이메일 동기화] 사용자 정보 조회 성공: ${currentUserData.email}`);

    if (!currentUserData.calendar_access_token || !currentUserData.calendar_refresh_token) {
      console.warn(`[이메일 동기화] Google Workspace 토큰이 없습니다.`);
      throw new Error('Google Workspace 계정이 연동되지 않았습니다. 구글 캘린더를 먼저 연동해주세요.');
    }

    console.log(`[이메일 동기화] Google Workspace 토큰 확인 완료`);

    // 이메일 주소 정규화 함수 (이름 부분 제거, 공백 제거, 소문자 변환)
    const normalizeEmail = (email: string): string => {
      if (!email) return '';
      
      // 이메일 주소에서 이름 부분 제거 (예: "이름 <email@example.com>" → "email@example.com")
      const emailMatch = email.match(/<([^>]+)>/) || email.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      const extractedEmail = emailMatch ? emailMatch[1] || emailMatch[0] : email;
      
      // 공백 제거 및 소문자 변환
      return extractedEmail.trim().toLowerCase();
    };

    // 사용자 이메일과 후보자 이메일 정규화
    const normalizedUserEmail = normalizeEmail(currentUserData.email || '');
    const normalizedCandidateEmail = normalizeEmail(candidateEmail);
    
    console.log(`[이메일 동기화] 이메일 주소 정규화:`);
    console.log(`[이메일 동기화]   사용자 이메일: "${currentUserData.email}" → "${normalizedUserEmail}"`);
    console.log(`[이메일 동기화]   후보자 이메일: "${candidateEmail}" → "${normalizedCandidateEmail}"`);
    
    // 사용자 이메일과 후보자 이메일이 같은 경우 경고
    if (normalizedUserEmail === normalizedCandidateEmail) {
      console.warn(`[이메일 동기화] ⚠️ 사용자 이메일과 후보자 이메일이 동일합니다. 자기 자신에게 보낸 이메일도 검색합니다.`);
    }

    // 날짜 범위 계산
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    // Gmail API 날짜 형식으로 변환 (YYYY/MM/DD)
    const formatDateForGmail = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}/${month}/${day}`;
    };

    const startDateStr = formatDateForGmail(startDate);
    const endDateStr = formatDateForGmail(endDate);

    // Gmail 검색 쿼리 생성 (후보자 이메일과 주고받은 이메일)
    // Gmail API 검색 쿼리: 공백은 AND를 의미, 괄호로 그룹화
    // 가장 단순하고 확실한 형식부터 우선 시도 (우선순위 높음)
    // 날짜 필터 없이 먼저 검색하여 모든 이메일을 찾은 후, 날짜로 필터링
    const searchQueries = [
      // 패턴 1: 가장 단순 - 후보자 이메일이 포함된 모든 이메일 (from만) - 최우선
      `from:${normalizedCandidateEmail}`,
      // 패턴 2: 가장 단순 - 후보자 이메일이 포함된 모든 이메일 (to만) - 최우선
      `to:${normalizedCandidateEmail}`,
      // 패턴 3: 사용자 → 후보자 (직접 주고받은 이메일) - 우선순위 높음
      `from:${normalizedUserEmail} to:${normalizedCandidateEmail}`,
      // 패턴 4: 후보자 → 사용자 (직접 주고받은 이메일) - 우선순위 높음
      `from:${normalizedCandidateEmail} to:${normalizedUserEmail}`,
      // 패턴 5: 후보자 이메일이 포함된 모든 이메일 (from OR to)
      `from:${normalizedCandidateEmail} OR to:${normalizedCandidateEmail}`,
      // 패턴 6: 사용자와 후보자 간 주고받은 이메일 (괄호로 그룹화)
      `(from:${normalizedUserEmail} to:${normalizedCandidateEmail}) OR (from:${normalizedCandidateEmail} to:${normalizedUserEmail})`,
      // 패턴 7: 따옴표 포함 - 후보자 이메일 (from)
      `from:"${normalizedCandidateEmail}"`,
      // 패턴 8: 따옴표 포함 - 후보자 이메일 (to)
      `to:"${normalizedCandidateEmail}"`,
      // 패턴 9: 따옴표 포함 - 사용자 → 후보자
      `from:"${normalizedUserEmail}" to:"${normalizedCandidateEmail}"`,
      // 패턴 10: 따옴표 포함 - 후보자 → 사용자
      `from:"${normalizedCandidateEmail}" to:"${normalizedUserEmail}"`,
      // 패턴 11: CC, BCC 포함
      `from:${normalizedCandidateEmail} OR to:${normalizedCandidateEmail} OR cc:${normalizedCandidateEmail} OR bcc:${normalizedCandidateEmail}`,
      // 패턴 12: 이메일 주소만으로 검색 (Gmail이 자동으로 from/to에서 찾음)
      normalizedCandidateEmail,
    ];
    
    // 날짜 필터가 있는 쿼리들 (검색이 실패한 경우에만 시도)
    // Gmail API 날짜 형식: after:YYYY/MM/DD 또는 newer_than:Nd
    const daysBackStr = `${daysBack}d`;
    const searchQueriesWithDate = [
      // 가장 단순한 쿼리에 날짜 필터만 추가 (우선순위 높음)
      `from:${normalizedCandidateEmail} newer_than:${daysBackStr}`,
      `to:${normalizedCandidateEmail} newer_than:${daysBackStr}`,
      `from:${normalizedUserEmail} to:${normalizedCandidateEmail} newer_than:${daysBackStr}`,
      `from:${normalizedCandidateEmail} to:${normalizedUserEmail} newer_than:${daysBackStr}`,
      // after 형식도 시도
      `from:${normalizedCandidateEmail} after:${startDateStr}`,
      `to:${normalizedCandidateEmail} after:${startDateStr}`,
      `from:${normalizedUserEmail} to:${normalizedCandidateEmail} after:${startDateStr}`,
      `from:${normalizedCandidateEmail} to:${normalizedUserEmail} after:${startDateStr}`,
    ];

    console.log(`[이메일 동기화] ========== 검색 시작 ==========`);
    console.log(`[이메일 동기화] 후보자 정보: ${candidateName}`);
    console.log(`[이메일 동기화]   원본 이메일: ${candidateEmail}`);
    console.log(`[이메일 동기화]   정규화된 이메일: ${normalizedCandidateEmail}`);
    console.log(`[이메일 동기화] 사용자 정보:`);
    console.log(`[이메일 동기화]   원본 이메일: ${currentUserData.email}`);
    console.log(`[이메일 동기화]   정규화된 이메일: ${normalizedUserEmail}`);
    console.log(`[이메일 동기화] 검색 기간: 최근 ${daysBack}일 (${startDateStr} ~ ${endDateStr})`);
    console.log(`[이메일 동기화] 검색 쿼리 패턴 (날짜 필터 없음): ${searchQueries.length}개`);
    console.log(`[이메일 동기화] 검색 쿼리 패턴 (날짜 필터 있음): ${searchQueriesWithDate.length}개`);
    console.log(`[이메일 동기화] 검색 쿼리 목록 (날짜 필터 없음):`);
    searchQueries.forEach((q, i) => {
      console.log(`[이메일 동기화]   ${i + 1}. ${q}`);
    });

    // Gmail에서 메시지 목록 조회
    // 모든 검색 쿼리 패턴을 시도하고 결과를 합침 (중복 제거)
    const allMessageIds = new Set<string>();
    const successfulQueries: string[] = [];
    const queryResults: Array<{ query: string; count: number; resultSizeEstimate?: number }> = [];
    let messageIds: string[] = []; // try 블록 밖에서 초기화
    let successfulQuery = ''; // try 블록 밖에서 초기화
    
    try {
      // 1단계: 날짜 필터 없이 가장 단순한 쿼리부터 우선 시도
      // 첫 번째 성공한 쿼리에서 결과를 확인하고, 결과가 있으면 날짜 필터를 적용하여 필터링
      console.log(`[이메일 동기화] ========== 1단계: 날짜 필터 없이 검색 (우선순위 높음) ==========`);
      console.log(`[이메일 동기화] 총 ${searchQueries.length}개 패턴 시도 예정`);
      console.log(`[이메일 동기화] 전략: 첫 번째 성공한 쿼리에서 결과 확인 후, 모든 패턴 결과 합침`);
      
      let firstSuccessfulQuery = '';
      let firstSuccessfulResult: string[] = [];
      
      for (let i = 0; i < searchQueries.length; i++) {
        const query = searchQueries[i];
        const startTime = Date.now();
        console.log(`[이메일 동기화] ──────────────────────────────────────────`);
        console.log(`[이메일 동기화] 패턴 ${i + 1}/${searchQueries.length} 시도 중...`);
        console.log(`[이메일 동기화] 검색 쿼리: ${query}`);
        
        try {
          const result = await listMessages(
            currentUserData.calendar_access_token,
            currentUserData.calendar_refresh_token,
            query,
            500, // 최대 500개까지 조회 (페이지네이션으로 더 많이 조회 가능)
            user.userId // userId 전달하여 토큰 갱신 시 DB에 자동 저장
          );
          
          const elapsedTime = Date.now() - startTime;
          
          // 결과를 Set에 추가 (중복 자동 제거)
          const beforeCount = allMessageIds.size;
          result.forEach(id => allMessageIds.add(id));
          const newCount = allMessageIds.size - beforeCount;
          
          if (result.length > 0) {
            successfulQueries.push(query);
            if (!firstSuccessfulQuery) {
              firstSuccessfulQuery = query;
              firstSuccessfulResult = result;
              console.log(`[이메일 동기화] ✅✅✅ 첫 번째 성공한 쿼리 발견! ✅✅✅`);
              console.log(`[이메일 동기화]   성공한 쿼리: ${query}`);
              console.log(`[이메일 동기화]   조회된 메시지 수: ${result.length}개`);
            } else {
              console.log(`[이메일 동기화] ✅ 패턴 ${i + 1} 성공!`);
              console.log(`[이메일 동기화]   조회된 메시지 수: ${result.length}개`);
              console.log(`[이메일 동기화]   새로 추가된 메시지: ${newCount}개 (중복 제외)`);
            }
            console.log(`[이메일 동기화]   소요 시간: ${elapsedTime}ms`);
            console.log(`[이메일 동기화]   메시지 ID 샘플 (처음 3개):`, result.slice(0, 3));
          } else {
            console.log(`[이메일 동기화] ❌ 패턴 ${i + 1} 결과 없음 (소요 시간: ${elapsedTime}ms)`);
          }
          
          // 결과 통계 저장
          queryResults.push({
            query,
            count: result.length,
          });
        } catch (queryError: any) {
          const elapsedTime = Date.now() - startTime;
          console.error(`[이메일 동기화] ❌ 패턴 ${i + 1} 실패 (소요 시간: ${elapsedTime}ms)`);
          console.error(`[이메일 동기화]   에러 메시지: ${queryError.message}`);
          console.error(`[이메일 동기화]   에러 코드: ${queryError.code}`);
          console.error(`[이메일 동기화]   에러 응답:`, JSON.stringify(queryError.response?.data, null, 2));
          
          // 실패한 쿼리도 기록
          queryResults.push({
            query,
            count: 0,
          });
        }
      }
      
      console.log(`[이메일 동기화] ========== 1단계 완료 ==========`);
      console.log(`[이메일 동기화] 총 조회된 고유 메시지 수: ${allMessageIds.size}개`);
      console.log(`[이메일 동기화] 성공한 검색 쿼리: ${successfulQueries.length}개`);
      
      // 2단계: 날짜 필터 있는 쿼리로 추가 검색 (1단계에서 결과가 없을 경우에만)
      if (allMessageIds.size === 0) {
        console.log(`[이메일 동기화] ========== 2단계: 날짜 필터 있는 검색 (1단계 실패 시) ==========`);
        console.log(`[이메일 동기화] 총 ${searchQueriesWithDate.length}개 패턴 시도 예정`);
        
        for (let i = 0; i < searchQueriesWithDate.length; i++) {
          const query = searchQueriesWithDate[i];
          const startTime = Date.now();
          console.log(`[이메일 동기화] ──────────────────────────────────────────`);
          console.log(`[이메일 동기화] 날짜 필터 패턴 ${i + 1}/${searchQueriesWithDate.length} 시도 중...`);
          console.log(`[이메일 동기화] 검색 쿼리: ${query}`);
          
          try {
            const result = await listMessages(
              currentUserData.calendar_access_token,
              currentUserData.calendar_refresh_token,
              query,
              500, // 최대 500개까지 조회
              user.userId // userId 전달하여 토큰 갱신 시 DB에 자동 저장
            );
            
            const elapsedTime = Date.now() - startTime;
            
            // 결과를 Set에 추가 (중복 자동 제거)
            const beforeCount = allMessageIds.size;
            result.forEach(id => allMessageIds.add(id));
            const newCount = allMessageIds.size - beforeCount;
            
            if (result.length > 0) {
              successfulQueries.push(query);
              console.log(`[이메일 동기화] ✅ 날짜 필터 패턴 ${i + 1} 성공!`);
              console.log(`[이메일 동기화]   조회된 메시지 수: ${result.length}개`);
              console.log(`[이메일 동기화]   새로 추가된 메시지: ${newCount}개 (중복 제외)`);
              console.log(`[이메일 동기화]   소요 시간: ${elapsedTime}ms`);
              console.log(`[이메일 동기화]   메시지 ID 샘플 (처음 3개):`, result.slice(0, 3));
            } else {
              console.log(`[이메일 동기화] ❌ 날짜 필터 패턴 ${i + 1} 결과 없음 (소요 시간: ${elapsedTime}ms)`);
            }
            
            // 결과 통계 저장
            queryResults.push({
              query,
              count: result.length,
            });
          } catch (queryError: any) {
            const elapsedTime = Date.now() - startTime;
            console.error(`[이메일 동기화] ❌ 날짜 필터 패턴 ${i + 1} 실패 (소요 시간: ${elapsedTime}ms)`);
            console.error(`[이메일 동기화]   에러 메시지: ${queryError.message}`);
            console.error(`[이메일 동기화]   에러 코드: ${queryError.code}`);
            console.error(`[이메일 동기화]   에러 응답:`, JSON.stringify(queryError.response?.data, null, 2));
            
            // 실패한 쿼리도 기록
            queryResults.push({
              query,
              count: 0,
            });
          }
        }
        
        console.log(`[이메일 동기화] ========== 2단계 완료 ==========`);
        console.log(`[이메일 동기화] 최종 총 조회된 고유 메시지 수: ${allMessageIds.size}개`);
        console.log(`[이메일 동기화] 총 성공한 검색 쿼리: ${successfulQueries.length}개`);
      } else {
        console.log(`[이메일 동기화] ========== 2단계 건너뜀 ==========`);
        console.log(`[이메일 동기화] 1단계에서 이미 ${allMessageIds.size}개의 메시지를 찾았으므로 날짜 필터 검색은 건너뜁니다.`);
        console.log(`[이메일 동기화] 날짜 필터링은 메시지 상세 조회 시 적용됩니다.`);
      }
      
      // Set을 배열로 변환
      messageIds = Array.from(allMessageIds);
      successfulQuery = successfulQueries.length > 0 ? successfulQueries[0] : '';
      
      // 최종 결과
      if (messageIds.length > 0) {
        console.log(`[이메일 동기화] ✅✅✅ 검색 성공! ✅✅✅`);
        console.log(`[이메일 동기화] ✅ 총 ${messageIds.length}개의 고유 메시지 ID 조회`);
        console.log(`[이메일 동기화] ✅ 성공한 검색 쿼리 수: ${successfulQueries.length}개`);
        console.log(`[이메일 동기화] ✅ 검색 통계:`, {
          totalMessages: messageIds.length,
          successfulQueries: successfulQueries.length,
          totalQueriesTried: queryResults.length,
          candidateEmail: normalizedCandidateEmail,
          userEmail: normalizedUserEmail,
          dateRange: `${startDateStr} ~ ${endDateStr}`,
        });
        console.log(`[이메일 동기화] ✅ 성공한 검색 쿼리 목록:`);
        successfulQueries.forEach((q, i) => {
          const result = queryResults.find(r => r.query === q);
          console.log(`[이메일 동기화]   ${i + 1}. ${q} (${result?.count || 0}개)`);
        });
      } else {
        console.warn(`[이메일 동기화] ⚠️⚠️⚠️ 모든 검색 패턴에서 결과가 없습니다. ⚠️⚠️⚠️`);
        console.warn(`[이메일 동기화] ⚠️ 검색 통계:`, {
          totalQueriesTried: queryResults.length,
          successfulQueries: successfulQueries.length,
          candidateEmail: normalizedCandidateEmail,
          userEmail: normalizedUserEmail,
          originalCandidateEmail: candidateEmail,
          originalUserEmail: currentUserData.email,
          dateRange: `${startDateStr} ~ ${endDateStr}`,
          daysBack,
        });
        console.warn(`[이메일 동기화] ⚠️ 각 검색 쿼리별 결과:`);
        queryResults.forEach((r, i) => {
          const status = r.count > 0 ? '✅' : '❌';
          console.warn(`[이메일 동기화]   ${i + 1}. ${status} ${r.query} → ${r.count}개`);
        });
        
        // 상세한 디버깅 정보 및 해결 방법 제시
        console.error(`[이메일 동기화] ❌❌❌ 이메일 검색 실패 - 디버깅 정보 ❌❌❌`);
        console.error(`[이메일 동기화] ❌ 문제 진단:`);
        console.error(`[이메일 동기화]   1. 사용자 Gmail 계정: ${normalizedUserEmail}`);
        console.error(`[이메일 동기화]   2. 후보자 이메일: ${normalizedCandidateEmail}`);
        console.error(`[이메일 동기화]   3. 검색 기간: 최근 ${daysBack}일 (${startDateStr} ~ ${endDateStr})`);
        console.error(`[이메일 동기화]   4. 시도한 검색 쿼리 수: ${queryResults.length}개`);
        console.error(`[이메일 동기화] ❌ 가능한 원인:`);
        console.error(`[이메일 동기화]   1. Gmail에 해당 이메일 주소(${normalizedCandidateEmail})와 주고받은 이메일이 없을 수 있습니다.`);
        console.error(`[이메일 동기화]   2. 검색 기간(${daysBack}일)이 너무 짧아서 오래된 이메일을 찾지 못했을 수 있습니다.`);
        console.error(`[이메일 동기화]   3. Gmail 인덱싱 지연으로 최근 이메일이 아직 검색되지 않을 수 있습니다.`);
        console.error(`[이메일 동기화]   4. Gmail API 권한 문제일 수 있습니다 (gmail.readonly 스코프 필요).`);
        console.error(`[이메일 동기화]   5. 검색 쿼리 형식이 Gmail API와 맞지 않을 수 있습니다.`);
        console.error(`[이메일 동기화]   6. Gmail 웹 인터페이스와 API의 검색 결과가 다를 수 있습니다.`);
        console.error(`[이메일 동기화] ❌ 해결 방법:`);
        console.error(`[이메일 동기화]   1. Gmail 웹 인터페이스에서 직접 다음 검색을 시도해보세요 (검색창에 복사해서 붙여넣기):`);
        console.error(`[이메일 동기화]      📋 테스트 쿼리 1: from:${normalizedCandidateEmail}`);
        console.error(`[이메일 동기화]      📋 테스트 쿼리 2: to:${normalizedCandidateEmail}`);
        console.error(`[이메일 동기화]      📋 테스트 쿼리 3: from:${normalizedUserEmail} to:${normalizedCandidateEmail}`);
        console.error(`[이메일 동기화]      📋 테스트 쿼리 4: from:${normalizedCandidateEmail} to:${normalizedUserEmail}`);
        console.error(`[이메일 동기화]      📋 테스트 쿼리 5: ${normalizedCandidateEmail}`);
        console.error(`[이메일 동기화]   2. 위 쿼리 중 하나라도 결과가 나오면, Gmail API가 해당 쿼리를 인식하지 못하는 것입니다.`);
        console.error(`[이메일 동기화]   3. 검색 기간을 늘려보세요 (현재: ${daysBack}일 → 180일 또는 365일 시도).`);
        console.error(`[이메일 동기화]   4. Gmail에서 실제로 해당 이메일과 주고받은 이메일이 있는지 확인하세요.`);
        console.error(`[이메일 동기화]   5. 구글 캘린더를 재연동하여 Gmail 읽기 권한을 다시 승인하세요.`);
        console.error(`[이메일 동기화]   6. 서버 로그에서 Gmail API 에러 메시지를 확인하세요.`);
        console.error(`[이메일 동기화] ❌ 시도한 모든 검색 쿼리 목록 (Gmail 웹에서 테스트 가능):`);
        queryResults.forEach((r, i) => {
          const status = r.count > 0 ? '✅' : '❌';
          console.error(`[이메일 동기화]   ${i + 1}. ${status} "${r.query}" → ${r.count}개`);
        });
      }
    } catch (error: any) {
      const errorMessage = error.message || '알 수 없는 오류';
      console.error(`[이메일 동기화] ❌ Gmail 메시지 목록 조회 실패:`, errorMessage);
      console.error(`[이메일 동기화] 에러 상세:`, {
        message: errorMessage,
        code: error.code,
        response: error.response?.data,
      });
      
      // Gmail 읽기 권한 관련 에러인 경우 명확한 메시지 반환
      if (errorMessage.includes('Gmail 읽기 권한') || errorMessage.includes('GMAIL_READ_SCOPE_MISSING') || errorMessage.includes('insufficient authentication scopes')) {
        throw new Error('Gmail 읽기 권한이 필요합니다. 구글 캘린더를 재연동하여 Gmail 읽기 권한을 승인해주세요.');
      }
      
      // 환경 변수 관련 에러
      if (errorMessage.includes('GOOGLE_CLIENT_ID') || errorMessage.includes('GOOGLE_CLIENT_SECRET')) {
        throw new Error('Gmail API 환경 변수가 설정되지 않았습니다. .env 파일에 GOOGLE_CLIENT_ID와 GOOGLE_CLIENT_SECRET을 추가하세요.');
      }
      
      throw error;
    }

    if (messageIds.length === 0) {
      console.warn(`[이메일 동기화] ⚠️ 동기화할 이메일이 없습니다.`);
      console.warn(`[이메일 동기화] ⚠️ 검색 조건 요약:`, {
        originalEmail: candidateEmail,
        normalizedEmail: normalizedCandidateEmail,
        userEmail: normalizedUserEmail,
        searchQueries: searchQueries.length,
        searchQueriesWithDate: searchQueriesWithDate.length,
        dateRange: `${startDateStr} ~ ${endDateStr}`,
        daysBack,
      });
      console.warn(`[이메일 동기화] ⚠️ 시도한 검색 쿼리 패턴 (처음 5개):`, searchQueries.slice(0, 5));
      console.warn(`[이메일 동기화] ⚠️ 가능한 원인:`);
      console.warn(`[이메일 동기화]   1. Gmail에 해당 이메일 주소(${normalizedCandidateEmail})와 주고받은 이메일이 없을 수 있습니다.`);
      console.warn(`[이메일 동기화]   2. Gmail 인덱싱 지연으로 방금 보낸 이메일이 아직 검색되지 않을 수 있습니다.`);
      console.warn(`[이메일 동기화]   3. Gmail 검색 쿼리 권한 문제일 수 있습니다.`);
      console.warn(`[이메일 동기화]   4. 날짜 범위(${daysBack}일)가 너무 좁을 수 있습니다.`);
      console.warn(`[이메일 동기화]   5. 사용자 Gmail 계정(${normalizedUserEmail})과 후보자 이메일(${normalizedCandidateEmail}) 간 실제 주고받은 이메일이 없을 수 있습니다.`);
      console.warn(`[이메일 동기화] ⚠️ 해결 방법:`);
      console.warn(`[이메일 동기화]   1. Gmail 웹 인터페이스에서 다음 검색을 직접 시도해보세요:`);
      console.warn(`[이메일 동기화]      - "from:${normalizedUserEmail} to:${normalizedCandidateEmail}"`);
      console.warn(`[이메일 동기화]      - "from:${normalizedCandidateEmail}"`);
      console.warn(`[이메일 동기화]   2. 몇 분 후 다시 시도하세요 (Gmail 인덱싱 지연).`);
      console.warn(`[이메일 동기화]   3. 검색 기간을 늘려보세요 (현재: ${daysBack}일).`);
      console.warn(`[이메일 동기화]   4. 구글 캘린더를 재연동하여 Gmail 읽기 권한을 다시 승인하세요.`);
      
      return { 
        synced: 0, 
        message: `동기화할 이메일이 없습니다. Gmail에서 "${normalizedCandidateEmail}"과 주고받은 이메일이 있는지 확인하세요. 서버 로그에서 상세한 디버깅 정보를 확인할 수 있습니다.`,
        debug: {
          candidateEmail: normalizedCandidateEmail,
          userEmail: normalizedUserEmail,
          totalQueriesTried: queryResults.length,
          successfulQueries: successfulQueries.length,
          queryResults: queryResults.slice(0, 10), // 처음 10개만
          dateRange: `${startDateStr} ~ ${endDateStr}`,
          daysBack,
        }
      };
    }

    // 기존에 저장된 이메일의 message_id 조회 (중복 방지)
    // 같은 message_id가 여러 후보자에게 저장될 수 있으므로, 이 후보자에게만 해당하는 이메일만 확인
    const { data: existingEmails } = await supabase
      .from('emails')
      .select('message_id')
      .eq('candidate_id', validatedCandidateId);

    const existingMessageIds = new Set(existingEmails?.map(e => e.message_id) || []);
    console.log(`[이메일 동기화] 기존에 저장된 이메일: ${existingMessageIds.size}개`);

    // 각 메시지 상세 조회 및 저장
    let syncedCount = 0;
    const errors: string[] = [];
    let skippedCount = 0;
    let processedCount = 0;

    console.log(`[이메일 동기화] 총 ${messageIds.length}개의 메시지를 처리합니다.`);

    for (const messageId of messageIds) {
      processedCount++;
      try {
        // 이미 저장된 이메일이면 건너뛰기
        if (existingMessageIds.has(messageId)) {
          skippedCount++;
          if (processedCount <= 5) {
            console.log(`[이메일 동기화] 메시지 ${messageId}는 이미 저장되어 있어 건너뜁니다.`);
          }
          continue;
        }

        // 메시지 상세 조회
        let message;
        try {
          message = await getMessage(
            currentUserData.calendar_access_token,
            currentUserData.calendar_refresh_token,
            messageId,
            user.userId // userId 전달하여 토큰 갱신 시 DB에 자동 저장
          );
        } catch (error: any) {
          const errorMessage = error.message || '알 수 없는 오류';
          console.error(`[이메일 동기화] 메시지 ${messageId} 조회 실패:`, errorMessage);
          errors.push(`메시지 ${messageId} 조회 실패: ${errorMessage}`);
          continue;
        }

        // 이메일 방향 결정 (from이 후보자면 inbound, to가 후보자면 outbound)
        const isInbound = message.from.toLowerCase().includes(candidateEmail.toLowerCase());
        const isOutbound = message.to.toLowerCase().includes(candidateEmail.toLowerCase());

        // 방향이 명확하지 않으면 from 기준으로 판단
        const direction = isInbound ? 'inbound' : 'outbound';

        // 이메일 저장 (RLS 정책 우회를 위해 Service Role Client 사용)
        const emailSupabase = createServiceClient();
        const { data: emailRecord, error: emailInsertError } = await emailSupabase.from('emails').insert({
          candidate_id: validatedCandidateId,
          message_id: messageId,
          subject: message.subject,
          body: message.body,
          from_email: message.from,
          to_email: message.to,
          direction,
          sent_at: direction === 'outbound' ? message.sentAt : null,
          received_at: direction === 'inbound' ? (message.receivedAt || message.sentAt) : null,
        }).select().single();

        if (emailInsertError) {
          // UNIQUE 제약 조건 위반은 이미 저장된 것으로 간주
          if (emailInsertError.code !== '23505') {
            errors.push(`메시지 ${messageId} 저장 실패: ${emailInsertError.message}`);
            continue;
          }
          // 이미 저장된 이메일인 경우, 기존 이메일 레코드를 조회
          const { data: existingEmail } = await supabase
            .from('emails')
            .select('id, direction, subject')
            .eq('message_id', messageId)
            .eq('candidate_id', validatedCandidateId)
            .single();
          
          if (existingEmail) {
            // 기존 이메일의 타임라인 이벤트 확인 및 생성
            const { data: existingTimeline } = await supabase
              .from('timeline_events')
              .select('id')
              .eq('candidate_id', validatedCandidateId)
              .eq('type', existingEmail.direction === 'inbound' ? 'email_received' : 'email')
              .contains('content', { email_id: existingEmail.id })
              .limit(1);
            
            if (!existingTimeline || existingTimeline.length === 0) {
              // 타임라인 이벤트가 없으면 생성 (Service Role Client 사용)
              const timelineSupabase = createServiceClient();
              const timelineType = existingEmail.direction === 'inbound' ? 'email_received' : 'email';
              const { error: timelineInsertError } = await timelineSupabase.from('timeline_events').insert({
                candidate_id: validatedCandidateId,
                type: timelineType,
                content: {
                  message: existingEmail.direction === 'inbound' 
                    ? `이메일을 수신했습니다: ${existingEmail.subject || '제목 없음'}` 
                    : `이메일이 발송되었습니다: ${existingEmail.subject || '제목 없음'}`,
                  subject: existingEmail.subject,
                  email_id: existingEmail.id,
                  direction: existingEmail.direction,
                },
                created_by: existingEmail.direction === 'inbound' ? null : user.userId,
              });
              
              if (timelineInsertError) {
                console.error(`[타임라인] 기존 이메일의 타임라인 이벤트 생성 실패:`, timelineInsertError);
              } else {
                console.log(`[타임라인] 기존 이메일의 타임라인 이벤트 생성 성공`);
              }
            }
          }
          continue;
        }

        // 타임라인 이벤트 생성 (모든 이메일: inbound와 outbound 모두)
        if (emailRecord) {
          // 이미 타임라인 이벤트가 있는지 확인 (중복 방지)
          // RLS 정책 우회를 위해 Service Role Client 사용
          const timelineSupabase = createServiceClient();
          const { data: existingTimeline } = await timelineSupabase
            .from('timeline_events')
            .select('id')
            .eq('candidate_id', validatedCandidateId)
            .eq('type', direction === 'inbound' ? 'email_received' : 'email')
            .contains('content', { email_id: emailRecord.id })
            .limit(1);
          
          // 타임라인 이벤트가 없을 때만 생성
          if (!existingTimeline || existingTimeline.length === 0) {
            const timelineType = direction === 'inbound' ? 'email_received' : 'email';
            
            // 타임라인 이벤트 생성 함수 (재시도 로직 포함)
            const createTimelineEvent = async (retryCount: number = 0): Promise<boolean> => {
              try {
                // RLS 정책 우회를 위해 Service Role Client 사용
                const { data: timelineData, error: timelineError } = await timelineSupabase.from('timeline_events').insert({
                  candidate_id: validatedCandidateId,
                  type: timelineType,
                  content: {
                    message: direction === 'inbound' 
                      ? `이메일을 수신했습니다: ${message.subject}` 
                      : `이메일이 발송되었습니다: ${message.subject}`,
                    subject: message.subject,
                    body: message.body, // 이메일 본문 내용 포함
                    from_email: message.from,
                    to_email: message.to,
                    message_id: messageId,
                    email_id: emailRecord.id, // emails 테이블의 id 포함
                    direction: direction, // 방향 정보 포함
                  },
                  created_by: direction === 'inbound' ? null : user.userId, // outbound는 발신자 정보 포함
                  created_at: direction === 'inbound' 
                    ? (message.receivedAt || message.sentAt || new Date().toISOString())
                    : (message.sentAt || new Date().toISOString()),
                }).select();

                if (timelineError) {
                  // RLS 정책 위반인 경우 재시도 (Service Role Client 사용)
                  if ((timelineError.code === '42501' || timelineError.message?.includes('row-level security')) && retryCount === 0) {
                    console.warn(`[타임라인] RLS 정책 위반 감지, Service Role Client로 재시도...`);
                    return await createTimelineEvent(1);
                  }
                  
                  console.error(`[타임라인] 이벤트 생성 실패 (이메일 ${direction}):`, {
                    error: timelineError,
                    code: timelineError.code,
                    message: timelineError.message,
                    details: timelineError.details,
                    hint: timelineError.hint,
                    candidateId: validatedCandidateId,
                    type: timelineType,
                    messageId,
                    retryCount,
                  });
                  console.error('[타임라인] 에러 상세:', JSON.stringify(timelineError, null, 2));
                  
                  // DB 제약 조건 위반인지 확인
                  if (timelineError.code === '23514') {
                    console.error(`[타임라인] DB 스키마 제약 조건 위반 - ${timelineType} 타입이 허용되지 않음. 마이그레이션을 확인하세요.`);
                    errors.push(`타임라인 이벤트 생성 실패 (메시지 ${messageId}): DB 스키마 제약 조건 위반`);
                  } else {
                    errors.push(`타임라인 이벤트 생성 실패 (메시지 ${messageId}): ${timelineError.message}`);
                  }
                  return false;
                } else {
                  console.log(`[타임라인] 이벤트 생성 성공 (이메일 ${direction}):`, timelineData?.[0]?.id);
                  return true;
                }
              } catch (error: any) {
                console.error(`[타임라인] 이벤트 생성 중 예외 발생:`, error);
                if (retryCount === 0) {
                  console.warn(`[타임라인] 재시도 중...`);
                  return await createTimelineEvent(1);
                }
                errors.push(`타임라인 이벤트 생성 실패 (메시지 ${messageId}): ${error.message || '알 수 없는 오류'}`);
                return false;
              }
            };
            
            // 타임라인 이벤트 생성 시도
            await createTimelineEvent();
          } else {
            console.log(`[타임라인] 이미 타임라인 이벤트가 존재함 (메시지 ${messageId}), 건너뜀`);
          }
        }

        syncedCount++;
        if (syncedCount % 10 === 0) {
          console.log(`[이메일 동기화] 진행 상황: ${syncedCount}개 동기화 완료, ${processedCount}/${messageIds.length}개 처리됨`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
        errors.push(`메시지 ${messageId} 처리 실패: ${errorMessage}`);
        console.error(`[이메일 동기화] 메시지 ${messageId} 처리 중 오류:`, errorMessage);
      }
    }
    
    console.log(`[이메일 동기화] 처리 완료 - 동기화: ${syncedCount}개, 건너뜀: ${skippedCount}개, 에러: ${errors.length}개`);

    // 캐시 무효화
    revalidatePath(`/dashboard/candidates/${validatedCandidateId}`);
    revalidatePath(`/candidates/${validatedCandidateId}`);

    console.log(`[이메일 동기화] 완료 - 동기화 통계:`, {
      synced: syncedCount,
      skipped: skippedCount,
      errors: errors.length,
      totalMessages: messageIds.length,
      processed: processedCount,
      candidateId: validatedCandidateId,
      candidateEmail: normalizedCandidateEmail,
      successfulQuery: successfulQuery,
    });
    
    if (errors.length > 0) {
      console.warn(`[이메일 동기화] ⚠️ 에러 발생:`, errors.slice(0, 5)); // 처음 5개만 로깅
    }

    return {
      synced: syncedCount,
      total: messageIds.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `${syncedCount}개의 이메일이 동기화되었습니다.`,
      debug: {
        candidateEmail: normalizedCandidateEmail,
        userEmail: normalizedUserEmail,
        successfulQuery: successfulQuery,
        totalQueriesTried: queryResults.length,
        successfulQueries: successfulQueries.length,
      }
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
        // `withErrorHandling()` 래퍼로 감싸져 있으므로 실제 값은 `result.data`에 들어있습니다.
        const syncedCount = result.data?.synced ?? 0;
        results.push({
          candidateId: candidate.id,
          candidateName: candidate.name,
          synced: syncedCount,
        });
        totalSynced += syncedCount;
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
