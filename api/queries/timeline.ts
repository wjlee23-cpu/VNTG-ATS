'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getCurrentUser, verifyCandidateAccess } from '@/api/utils/auth';
import { validateUUID } from '@/api/utils/validation';
import { withErrorHandling } from '@/api/utils/errors';

/**
 * 특정 후보자의 타임라인 이벤트 조회
 * @param candidateId 후보자 ID
 * @param limit 조회할 이벤트 수 (기본값: 50)
 * @returns 타임라인 이벤트 목록
 */
export async function getTimelineEvents(candidateId: string, limit: number = 50) {
  return withErrorHandling(async () => {
    // 접근 권한 확인
    await verifyCandidateAccess(candidateId);
    const user = await getCurrentUser();
    
    // 중요: 타임라인은 created_by_user(=users 테이블 조인)를 항상 포함합니다.
    // 프로덕션에서는 anon key 기반 createClient가 RLS 정책에 의해 조인이 누락되어 UI가 'System'으로 보일 수 있습니다.
    // 이미 verifyCandidateAccess로 권한 확인을 끝냈으니 Service Role로 안전하게 조회합니다.
    const supabase = createServiceClient();

    // 먼저 단순 조회로 테스트
    const { data: simpleData, error: simpleError } = await supabase
      .from('timeline_events')
      .select('*')
      .eq('candidate_id', candidateId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (simpleError) {
      console.error('[타임라인 조회] 단순 조회 실패:', simpleError);
      throw new Error(`타임라인 이벤트 조회 실패: ${simpleError.message}`);
    }

    // 조인 쿼리 시도 (LEFT JOIN 사용: created_by가 null인 경우에도 조회 가능)
    // 외래 키 관계를 명시하기 위해 `!` 사용
    const { data, error } = await supabase
      .from('timeline_events')
      .select(`
        *,
        created_by_user:users!created_by (
          id,
          email,
          name,
          avatar_url
        )
      `)
      .eq('candidate_id', candidateId)
      .order('created_at', { ascending: false })
      .limit(limit);

    // 조인 쿼리 결과 처리: data가 없거나 조인 실패 시 simpleData 사용
    let timelineData: any[] = [];
    let useSimpleData = false;
    
    if (error) {
      console.error('[타임라인 조회] 조인 쿼리 실패:', error);
      console.log('[타임라인 조회] 조인 없이 단순 조회 결과 사용');
      timelineData = simpleData || [];
      useSimpleData = true;
    } else if (data && simpleData && data.length < simpleData.length) {
      console.warn(`[타임라인 조회] 조인 결과가 단순 조회보다 적음 (조인: ${data.length}, 단순: ${simpleData.length}). 단순 조회 결과 사용`);
      // 단순 조회 결과에 created_by_user 정보를 수동으로 추가
      timelineData = simpleData.map((event: any) => {
        if (event.created_by) {
          const joinedEvent = data.find((e: any) => e.id === event.id);
          if (joinedEvent && joinedEvent.created_by_user) {
            return { ...event, created_by_user: joinedEvent.created_by_user };
          }
        }
        return event;
      });
      useSimpleData = true;
    } else {
      timelineData = data || [];
      console.log(`[타임라인 조회] 성공: ${timelineData.length}개 이벤트`);
    }
    
    // 이메일 타입 이벤트의 경우 emails 테이블에서 실제 이메일 내용 가져오기
    const emailEventIds: string[] = [];
    const emailIdMap = new Map<string, string>(); // event_id -> email_id 매핑
    
    // 이메일 타입 이벤트 찾기 및 email_id 추출 (timelineData 사용)
    timelineData.forEach((event: any) => {
      if (event.type === 'email' || event.type === 'email_received') {
        const emailId = event.content?.email_id;
        if (emailId) {
          emailEventIds.push(event.id);
          emailIdMap.set(event.id, emailId);
        }
      }
    });
    
    // emails 테이블에서 해당 후보자의 모든 이메일 조회 (타임라인 이벤트가 없는 이메일도 포함)
    // RLS 정책 우회를 위해 Service Role Client 사용
    const emailSupabase = createServiceClient();
    console.log(`[타임라인 조회] 이메일 조회 시작 - 후보자 ID: ${candidateId}`);
    const { data: allEmails, error: allEmailsError } = await emailSupabase
      .from('emails')
      .select('id, subject, body, from_email, to_email, direction, sent_at, received_at, created_at')
      .eq('candidate_id', candidateId)
      .order('created_at', { ascending: false })
      .limit(limit * 2); // 타임라인 이벤트보다 더 많이 조회하여 누락된 이메일도 찾기
    
    if (allEmailsError) {
      console.error('[타임라인 조회] 이메일 조회 실패:', allEmailsError);
      // 에러가 발생해도 계속 진행 (타임라인 이벤트는 표시)
    } else {
      console.log(`[타임라인 조회] 이메일 조회 성공: ${allEmails?.length || 0}개 이메일`);
      if (allEmails && allEmails.length > 0) {
        console.log(`[타임라인 조회] 이메일 방향 분포: inbound ${allEmails.filter((e: any) => e.direction === 'inbound').length}개, outbound ${allEmails.filter((e: any) => e.direction === 'outbound').length}개`);
        // 디버깅: 이메일 샘플 출력 (처음 5개만, 날짜 정보 포함)
        allEmails.slice(0, 5).forEach((email: any, index: number) => {
          const emailDate = email.received_at || email.sent_at || email.created_at;
          const dateStr = emailDate ? new Date(emailDate).toLocaleString('ko-KR') : '날짜 없음';
          console.log(`[타임라인 조회] 이메일 ${index + 1}: ${email.subject || '제목 없음'} (${email.direction}) - From: ${email.from_email}, To: ${email.to_email}, 날짜: ${dateStr}`);
        });
        
        // 특정 날짜(2월 24일) 이메일 확인
        const targetDate = new Date('2026-02-24T17:35:00');
        const targetDateStart = new Date(targetDate);
        targetDateStart.setHours(0, 0, 0, 0);
        const targetDateEnd = new Date(targetDate);
        targetDateEnd.setHours(23, 59, 59, 999);
        
        const emailsOnTargetDate = allEmails.filter((email: any) => {
          const emailDate = email.received_at || email.sent_at || email.created_at;
          if (!emailDate) return false;
          const date = new Date(emailDate);
          return date >= targetDateStart && date <= targetDateEnd;
        });
        
        if (emailsOnTargetDate.length > 0) {
          console.log(`[타임라인 조회] 2026-02-24 날짜의 이메일 발견: ${emailsOnTargetDate.length}개`);
          emailsOnTargetDate.forEach((email: any, index: number) => {
            const emailDate = email.received_at || email.sent_at || email.created_at;
            console.log(`[타임라인 조회] 2월 24일 이메일 ${index + 1}: ${email.subject || '제목 없음'} - ${new Date(emailDate).toLocaleString('ko-KR')}`);
          });
        } else {
          console.warn(`[타임라인 조회] 2026-02-24 날짜의 이메일을 찾을 수 없습니다.`);
        }
      } else {
        console.warn(`[타임라인 조회] 후보자 ID ${candidateId}에 대한 이메일이 없습니다. 이메일 동기화가 필요할 수 있습니다.`);
      }
    }
    
    // 타임라인 이벤트에 연결된 email_id 수집 (timelineData 사용)
    const timelineEmailIds = new Set<string>();
    timelineData.forEach((event: any) => {
      if (event.type === 'email' || event.type === 'email_received') {
        const emailId = event.content?.email_id;
        if (emailId) {
          timelineEmailIds.add(emailId);
        }
      }
    });
    
    // 타임라인 이벤트가 없는 이메일들을 타임라인 이벤트로 변환
    const missingEmailEvents: any[] = [];
    if (!allEmailsError && allEmails) {
      allEmails.forEach((email: any) => {
        if (!timelineEmailIds.has(email.id)) {
          // 이메일의 실제 날짜 계산 (sent_at 또는 received_at 우선)
          const emailDate = email.received_at || email.sent_at || email.created_at;
          
          // 타임라인 이벤트가 없는 이메일을 타임라인 이벤트 형태로 변환
          const emailEvent = {
            id: `email-${email.id}`, // 임시 ID
            candidate_id: candidateId,
            type: email.direction === 'inbound' ? 'email_received' : 'email',
            content: {
              message: email.direction === 'inbound' 
                ? `이메일을 수신했습니다: ${email.subject || '제목 없음'}` 
                : `이메일이 발송되었습니다: ${email.subject || '제목 없음'}`,
              subject: email.subject,
              body: email.body,
              from_email: email.from_email,
              to_email: email.to_email,
              email_id: email.id,
              direction: email.direction,
              sent_at: email.sent_at,
              received_at: email.received_at,
            },
            created_at: emailDate,
            created_by_user: null, // 이메일 동기화로 생성된 경우
          };
          
          missingEmailEvents.push(emailEvent);
          
          // 디버깅: 이메일 날짜 정보 로그
          if (process.env.NODE_ENV === 'development') {
            console.log(`[타임라인 조회] 누락된 이메일 이벤트 생성: ${email.subject || '제목 없음'} - 날짜: ${emailDate} (sent_at: ${email.sent_at}, received_at: ${email.received_at}, created_at: ${email.created_at})`);
          }
        }
      });
    }
    
    // 이메일 데이터 조회 (타임라인 이벤트에 연결된 이메일)
    // RLS 정책 우회를 위해 Service Role Client 사용
    let emailDataMap = new Map<string, any>();
    if (emailEventIds.length > 0) {
      const emailIds = Array.from(emailIdMap.values());
      const { data: emails, error: emailError } = await emailSupabase
        .from('emails')
        .select('id, subject, body, from_email, to_email, direction, sent_at, received_at')
        .in('id', emailIds);
      
      if (!emailError && emails) {
        // email_id를 키로 하는 맵 생성
        emails.forEach((email: any) => {
          emailDataMap.set(email.id, email);
        });
        console.log(`[타임라인 조회] 타임라인 이벤트 연결 이메일 조회 성공: ${emails.length}개`);
      } else if (emailError) {
        console.error('[타임라인 조회] 타임라인 이벤트 연결 이메일 조회 실패:', emailError);
      }
    }
    
    // 이메일 데이터를 타임라인 이벤트의 content에 병합 (timelineData 사용)
    const enrichedData = timelineData.map((event: any) => {
      if ((event.type === 'email' || event.type === 'email_received') && emailIdMap.has(event.id)) {
        // `.has()` 조건을 통과했으므로 값이 존재한다고 타입에 명시합니다.
        const emailId = emailIdMap.get(event.id)!;
        const emailData = emailDataMap.get(emailId);
        
        if (emailData) {
          // 이메일의 실제 날짜 계산 (sent_at 또는 received_at 우선)
          const emailDate = emailData.received_at || emailData.sent_at || event.created_at;
          
          // content에 이메일 데이터 병합 (기존 content는 유지하되, 이메일 데이터로 보강)
          return {
            ...event,
            // created_at을 이메일의 실제 날짜로 업데이트
            created_at: emailDate,
            content: {
              ...event.content,
              subject: emailData.subject || event.content?.subject,
              body: emailData.body || event.content?.body,
              from_email: emailData.from_email || event.content?.from_email,
              to_email: emailData.to_email || event.content?.to_email,
              direction: emailData.direction || event.content?.direction,
              sent_at: emailData.sent_at || event.content?.sent_at,
              received_at: emailData.received_at || event.content?.received_at,
              email_id: emailId, // email_id도 명시적으로 포함
            },
          };
        }
      }
      return event;
    });
    
    // 타임라인 이벤트와 누락된 이메일 이벤트를 합치고 날짜순으로 정렬
    const allEvents = [...enrichedData, ...missingEmailEvents].sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return dateB - dateA; // 최신순
    });
    
    // 이메일 이벤트 개수 확인
    const emailEventCount = allEvents.filter((e: any) => e.type === 'email' || e.type === 'email_received').length;
    const dataSource = useSimpleData ? '단순 조회' : '조인 조회';
    console.log(`[타임라인 조회] 최종 결과 (${dataSource}): 타임라인 이벤트 ${enrichedData.length}개, 누락된 이메일 ${missingEmailEvents.length}개, 총 ${allEvents.length}개 (이메일 이벤트: ${emailEventCount}개)`);
    
    // 이메일 동기화 상태 확인 및 경고
    if (!allEmailsError && allEmails && allEmails.length === 0) {
      console.warn(`[타임라인 조회] ⚠️ 후보자 ID ${candidateId}에 대한 이메일이 emails 테이블에 없습니다.`);
      console.warn(`[타임라인 조회] ⚠️ 이메일을 타임라인에 표시하려면 syncCandidateEmails 함수를 실행하여 Gmail에서 이메일을 동기화해야 합니다.`);
    } else if (allEmails && allEmails.length > 0 && emailEventCount === 0) {
      console.warn(`[타임라인 조회] ⚠️ emails 테이블에 ${allEmails.length}개의 이메일이 있지만, 타임라인에 표시되지 않았습니다.`);
      console.warn(`[타임라인 조회] ⚠️ 이메일의 candidate_id가 올바른지 확인하세요.`);
    }
    
    // ✅ 일정 자동화 타임라인 중복 정리(레거시 이벤트 대비)
    // - 과거에는 interviewer_response / schedule_regenerated가 매번 insert되어 타임라인이 과하게 쌓였습니다.
    // - 이제는 schedule_id 기준으로 대표 카드(=schedule_created)를 업서트로 갱신하므로,
    //   대표 카드가 존재하는 schedule_id에 대해서는 레거시 이벤트를 숨겨 UI 노이즈를 줄입니다.
    const scheduleCreatedIds = new Set<string>();
    for (const ev of allEvents as any[]) {
      const sid = ev?.schedule_id || ev?.content?.schedule_id;
      if (ev?.type === 'schedule_created' && sid) {
        scheduleCreatedIds.add(String(sid));
      }
    }

    const normalized = (allEvents as any[]).filter((ev) => {
      const sid = ev?.schedule_id || ev?.content?.schedule_id;
      if (!sid) return true;
      // schedule_created가 있으면 같은 schedule_id의 레거시 이벤트는 숨김
      if (scheduleCreatedIds.has(String(sid))) {
        if (ev.type === 'interviewer_response') return false;
        if (ev.type === 'schedule_regenerated') return false;
      }
      return true;
    });

    // limit만큼만 반환
    return normalized.slice(0, limit);
  });
}

/**
 * 최근 활동 조회 (대시보드용)
 * @param limit 조회할 이벤트 수 (기본값: 10)
 * @returns 최근 타임라인 이벤트 목록
 */
export async function getRecentActivity(limit: number = 10) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const supabase = await createClient();

    // organization_id에 속한 job_posts 조회
    const { data: jobPosts } = await supabase
      .from('job_posts')
      .select('id')
      .eq('organization_id', user.organizationId);

    if (!jobPosts || jobPosts.length === 0) {
      return [];
    }

    const jobPostIds = jobPosts.map(jp => jp.id);

    // 해당 job_posts의 후보자들 조회
    const { data: candidates } = await supabase
      .from('candidates')
      .select('id')
      .in('job_post_id', jobPostIds);

    if (!candidates || candidates.length === 0) {
      return [];
    }

    const candidateIds = candidates.map(c => c.id);

    // 최근 타임라인 이벤트 조회
    const { data, error } = await supabase
      .from('timeline_events')
      .select(`
        *,
        candidates (
          id,
          name,
          job_posts (
            id,
            title
          )
        ),
        created_by_user:users!created_by (
          id,
          email
        )
      `)
      .in('candidate_id', candidateIds)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`최근 활동 조회 실패: ${error.message}`);
    }

    return data || [];
  });
}
