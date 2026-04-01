'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getCurrentUser, verifyCandidateAccess } from '@/api/utils/auth';
import { withErrorHandling } from '@/api/utils/errors';

/**
 * 후보자 상세 모달에 필요한 데이터를 한 번에 가져옵니다.
 * - 클릭 시 네트워크 요청을 1회로 줄여 체감 반응속도를 개선합니다.
 * - 무거운 타임라인/이메일은 기본적으로 포함하지 않습니다(탭 진입 시 별도 로드).
 */
export async function getCandidateDetailBundle(candidateId: string) {
  return withErrorHandling(async () => {
    // 1) 접근 권한 확인(필수)
    await verifyCandidateAccess(candidateId);

    // 2) 유저 role에 따라 클라이언트 선택(관리자는 Service Role로 RLS 우회)
    const user = await getCurrentUser();
    const supabase = user.role === 'admin' ? createServiceClient() : await createClient();

    // 3) 후보자 + job_post/process 정보(상세 화면에서 단계명/프로세스 표시에 사용)
    const { data: candidate, error: candidateError } = await supabase
      .from('candidates')
      .select(
        `
          *,
          job_posts (
            id,
            title,
            description,
            process_id,
            processes (
              id,
              name,
              stages
            )
          )
        `,
      )
      .eq('id', candidateId)
      .single();

    if (candidateError || !candidate) {
      throw new Error(`후보자 조회 실패: ${candidateError?.message || '데이터가 없습니다.'}`);
    }

    // 4) 일정(상세 화면에서 일정 영역/타임라인 상호작용에 사용)
    const { data: schedules, error: schedulesError } = await supabase
      .from('schedules')
      .select(
        `
          *,
          candidates (
            id,
            name,
            email
          )
        `,
      )
      .eq('candidate_id', candidateId)
      .order('scheduled_at', { ascending: true });

    if (schedulesError) {
      throw new Error(`면접 일정 조회 실패: ${schedulesError.message}`);
    }

    return {
      candidate,
      schedules: schedules || [],
      // 타임라인은 기본적으로 빈 배열(탭 진입 시 로드)
      timelineEvents: [],
    };
  });
}

