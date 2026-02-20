import { getOffers, getOfferStats } from '@/api/queries/offers';
import { OffersClient } from './OffersClient';

export default async function OffersPage() {
  const offersResult = await getOffers();
  const statsResult = await getOfferStats();
  
  // 에러가 발생한 경우 콘솔에 로그 출력 (개발 환경)
  if (offersResult.error) {
    console.error('제안 조회 실패:', offersResult.error);
  }
  if (statsResult.error) {
    console.error('제안 통계 조회 실패:', statsResult.error);
  }
  
  const offers = offersResult.data || [];
  const error = offersResult.error;
  const stats = statsResult.data || {
    accepted: 0,
    pending: 0,
    negotiating: 0,
    acceptRate: 0,
  };

  return (
    <OffersClient 
      offers={offers}
      stats={stats}
      error={error}
    />
  );
}
