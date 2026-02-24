import { CandidateScheduleClient } from './CandidateScheduleClient';
import { createClient, createServiceClient } from '@/lib/supabase/server';

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

  // 후보자는 로그인하지 않았으므로 Service Role Client를 사용하여 RLS 우회
  // 먼저 일반 클라이언트로 토큰 검증만 수행
  const supabase = await createClient();
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

  // 토큰 검증 완료 후 Service Role Client로 전환하여 RLS 우회
  const serviceClient = createServiceClient();

  // 스케줄 조회 (확정된 일정 또는 선택 대기 중인 일정 모두 조회)
  const { data: schedule } = await serviceClient
    .from('schedules')
    .select(`
      *,
      schedule_options (
        id,
        scheduled_at,
        status,
        interviewer_responses
      )
    `)
    .eq('candidate_id', candidateId)
    .in('workflow_status', ['pending_candidate', 'confirmed'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  // 스케줄 조회 실패 시 에러 처리
  if (!schedule) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">일정 옵션 없음</h1>
          <p className="text-gray-600">선택 가능한 일정 옵션이 없습니다.</p>
        </div>
      </div>
    );
  }

  // 이미 확정된 일정인 경우 확정된 일정 정보 표시
  if (schedule.workflow_status === 'confirmed') {
    // 확정된 일정 옵션 조회 (status가 'selected'인 옵션)
    const confirmedOption = schedule.schedule_options?.find((opt: any) => opt.status === 'selected');
    
    if (confirmedOption) {
      return (
        <CandidateScheduleClient
          candidate={candidate}
          schedule={schedule}
          options={[confirmedOption]}
          token={token}
          isConfirmed={true}
        />
      );
    }
    
    // 확정된 일정이지만 옵션 정보가 없는 경우 scheduled_at 사용
    return (
      <CandidateScheduleClient
        candidate={candidate}
        schedule={schedule}
        options={[{
          id: 'confirmed',
          scheduled_at: schedule.scheduled_at,
          status: 'selected'
        }]}
        token={token}
        isConfirmed={true}
      />
    );
  }

  // 선택 대기 중인 일정인 경우
  if (!schedule.schedule_options || schedule.schedule_options.length === 0) {
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
      isConfirmed={false}
    />
  );
}
