import { CandidateScheduleClient } from './CandidateScheduleClient';
import { createClient } from '@/lib/supabase/server';

export default async function CandidateSchedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }> | { id: string };
  searchParams: Promise<{ token?: string }> | { token?: string };
}) {
  const resolvedParams = await (params instanceof Promise ? params : Promise.resolve(params));
  const resolvedSearchParams = await (searchParams instanceof Promise ? searchParams : Promise.resolve(searchParams));
  
  const candidateId = resolvedParams?.id;
  const token = resolvedSearchParams?.token;

  if (!candidateId || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">접근 권한 오류</h1>
          <p className="text-gray-600">유효하지 않은 링크입니다.</p>
        </div>
      </div>
    );
  }

  const supabase = await createClient();

  // 후보자 정보 조회 (토큰 검증)
  const { data: candidate, error: candidateError } = await supabase
    .from('candidates')
    .select('id, name, email, token')
    .eq('id', candidateId)
    .eq('token', token)
    .single();

  if (candidateError || !candidate) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">접근 권한 오류</h1>
          <p className="text-gray-600">인증 토큰이 올바르지 않습니다.</p>
        </div>
      </div>
    );
  }

  // 스케줄 및 옵션 조회
  const { data: schedule } = await supabase
    .from('schedules')
    .select(`
      *,
      schedule_options!inner (
        id,
        scheduled_at,
        status,
        interviewer_responses
      )
    `)
    .eq('candidate_id', candidateId)
    .eq('workflow_status', 'pending_candidate')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!schedule || !schedule.schedule_options || schedule.schedule_options.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">일정 옵션 없음</h1>
          <p className="text-gray-600">선택 가능한 일정 옵션이 없습니다.</p>
        </div>
      </div>
    );
  }

  // 모든 면접관이 수락한 옵션만 필터링
  const availableOptions = schedule.schedule_options.filter((opt: any) => {
    if (!opt.interviewer_responses || typeof opt.interviewer_responses !== 'object') {
      return false;
    }
    const responses = opt.interviewer_responses as Record<string, string>;
    return schedule.interviewer_ids.every((interviewerId: string) => {
      return responses[interviewerId] === 'accepted';
    });
  });

  if (availableOptions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">일정 옵션 없음</h1>
          <p className="text-gray-600">모든 면접관이 수락한 일정 옵션이 없습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <CandidateScheduleClient
      candidate={candidate}
      schedule={schedule}
      options={availableOptions}
      token={token}
    />
  );
}
