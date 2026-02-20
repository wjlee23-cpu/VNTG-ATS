import { getJDRequests, getJDRequestStats } from '@/api/queries/jd-requests';
import { JDRequestsClient } from './JDRequestsClient';

export default async function JDRequestsPage() {
  const requestsResult = await getJDRequests();
  const statsResult = await getJDRequestStats();
  
  // 에러가 발생한 경우 콘솔에 로그 출력 (개발 환경)
  if (requestsResult.error) {
    console.error('JD 요청 조회 실패:', requestsResult.error);
  }
  if (statsResult.error) {
    console.error('JD 요청 통계 조회 실패:', statsResult.error);
  }
  
  const requests = requestsResult.data || [];
  const error = requestsResult.error;
  const stats = statsResult.data || {
    all: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  };

  return (
    <JDRequestsClient 
      initialRequests={requests}
      stats={stats}
      error={error}
    />
  );
}
