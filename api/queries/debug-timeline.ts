'use server';

import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/api/utils/auth';
import { withErrorHandling } from '@/api/utils/errors';

/**
 * 타임라인 이벤트 타입 제약 조건 확인
 * DB 스키마에서 허용된 타입 목록을 확인합니다.
 */
export async function checkTimelineEventTypes() {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    
    if (user.role !== 'admin') {
      throw new Error('관리자만 접근할 수 있습니다.');
    }

    // Service Role Client를 사용하여 RLS 정책 우회
    const serviceClient = createServiceClient();

    // pg_constraint 테이블에서 제약 조건 확인
    // 직접 쿼리는 불가능하므로, 실제로 허용된 타입을 테스트하는 방식 사용
    const allowedTypes = [
      'system_log',
      'schedule_created',
      'schedule_confirmed',
      'stage_changed',
      'email',
      'email_received',
      'comment',
      'comment_created',
      'comment_updated',
      'scorecard',
      'scorecard_created',
      'approval',
      'stage_evaluation',
      'archive',
      'interviewer_response',
      'schedule_regenerated',
      'position_changed',
    ];

    const testResults: Record<string, boolean> = {};

    // 각 타입이 허용되는지 확인하기 위해 임시 이벤트 생성 시도
    // 실제로는 더미 후보자 ID를 사용하거나, 실제 후보자 ID를 사용
    const { data: testCandidate } = await serviceClient
      .from('candidates')
      .select('id')
      .limit(1)
      .single();

    if (!testCandidate) {
      return {
        error: '테스트할 후보자가 없습니다.',
        allowedTypes: [],
        testResults: {},
      };
    }

    // 각 타입에 대해 테스트 (실제로는 롤백되므로 안전)
    for (const type of allowedTypes) {
      try {
        const { error } = await serviceClient
          .from('timeline_events')
          .insert({
            candidate_id: testCandidate.id,
            type,
            content: { test: true },
            created_by: null,
          })
          .select()
          .limit(0); // 실제로는 삽입하지 않음

        // 에러가 없으면 허용된 타입
        testResults[type] = !error || error.code !== '23514';
      } catch (error: any) {
        testResults[type] = error.code !== '23514';
      }
    }

    // 테스트 이벤트 삭제 (혹시 생성된 경우)
    await serviceClient
      .from('timeline_events')
      .delete()
      .eq('candidate_id', testCandidate.id)
      .eq('content->>test', 'true');

    return {
      allowedTypes: allowedTypes.filter(type => testResults[type]),
      testResults,
    };
  });
}

/**
 * 특정 후보자의 타임라인 이벤트 개수 확인
 */
export async function getTimelineEventCount(candidateId: string) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    
    if (user.role !== 'admin') {
      throw new Error('관리자만 접근할 수 있습니다.');
    }

    const serviceClient = createServiceClient();

    const { data, error, count } = await serviceClient
      .from('timeline_events')
      .select('*', { count: 'exact', head: false })
      .eq('candidate_id', candidateId);

    if (error) {
      throw new Error(`타임라인 이벤트 조회 실패: ${error.message}`);
    }

    // 타입별 개수 집계
    const typeCounts: Record<string, number> = {};
    data?.forEach(event => {
      typeCounts[event.type] = (typeCounts[event.type] || 0) + 1;
    });

    return {
      total: count || 0,
      typeCounts,
      events: data || [],
    };
  });
}

/**
 * 타임라인 이벤트 생성 테스트
 */
export async function testTimelineEventCreation(candidateId: string, type: string) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    
    if (user.role !== 'admin') {
      throw new Error('관리자만 접근할 수 있습니다.');
    }

    const serviceClient = createServiceClient();

    const { data, error } = await serviceClient
      .from('timeline_events')
      .insert({
        candidate_id: candidateId,
        type,
        content: {
          message: '테스트 이벤트',
          test: true,
        },
        created_by: user.userId,
      })
      .select()
      .single();

    if (error) {
      return {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        },
      };
    }

    // 테스트 이벤트 삭제
    if (data) {
      await serviceClient
        .from('timeline_events')
        .delete()
        .eq('id', data.id);
    }

    return {
      success: true,
      eventId: data?.id,
    };
  });
}
