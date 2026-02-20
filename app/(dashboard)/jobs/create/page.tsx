import { getProcesses } from '@/api/queries/processes';
import { JobCreateClient } from './JobCreateClient';

export default async function JobCreatePage() {
  // 프로세스 목록 조회
  const processesResult = await getProcesses();
  const processes = processesResult.data || [];
  const error = processesResult.error;

  // 에러가 발생한 경우 콘솔에 로그 출력 (개발 환경)
  if (processesResult.error) {
    console.error('프로세스 목록 조회 실패:', processesResult.error);
  }

  return (
    <JobCreateClient 
      processes={processes}
      error={error}
    />
  );
}
