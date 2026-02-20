import { getCandidates } from '@/api/queries/candidates';
import { OffersClient } from './OffersClient';

export default async function OffersPage() {
  const candidatesResult = await getCandidates();
  const candidates = candidatesResult.data || [];
  
  // status가 'confirmed'인 후보자만 필터링 (오퍼를 받은 후보자)
  const offers = candidates.filter(c => c.status === 'confirmed');

  return (
    <OffersClient 
      offers={offers}
      error={candidatesResult.error}
    />
  );
}
