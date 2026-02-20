import { getProcesses } from '@/api/queries/processes';
import { getApprovedJDRequests } from '@/api/queries/jd-requests';
import { getUsers } from '@/api/queries/users';
import { JobCreateClient } from './JobCreateClient';

export default async function JobCreatePage() {
  // 프로세스 목록 조회
  const processesResult = await getProcesses();
  const processes = processesResult.data || [];
  const processesError = processesResult.error;

  // 승인된 JD 목록 조회
  const jdRequestsResult = await getApprovedJDRequests();
  const jdRequests = jdRequestsResult.data || [];
  const jdRequestsError = jdRequestsResult.error;

  // 사용자 목록 조회 (담당자 선택용)
  const usersResult = await getUsers();
  const users = usersResult.data || [];
  const usersError = usersResult.error;

  // 에러가 발생한 경우 콘솔에 로그 출력 (개발 환경)
  if (processesError) {
    console.error('프로세스 목록 조회 실패:', processesError);
  }
  if (jdRequestsError) {
    console.error('승인된 JD 목록 조회 실패:', jdRequestsError);
  }
  if (usersError) {
    console.error('사용자 목록 조회 실패:', usersError);
  }

  const error = processesError || jdRequestsError || usersError;

  return (
    <JobCreateClient 
      processes={processes}
      jdRequests={jdRequests}
      users={users}
      error={error}
    />
  );
}
