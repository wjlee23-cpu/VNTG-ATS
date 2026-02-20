import { getJDRequests, getJDRequestStats } from '@/api/queries/jd-requests';
import { JDRequestsClient } from './JDRequestsClient';

export default async function JDRequestsPage() {
  const requestsResult = await getJDRequests();
  const statsResult = await getJDRequestStats();
  
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
