import { getOffers, getOfferStats } from '@/api/queries/offers';
import { OffersClient } from './OffersClient';

export default async function OffersPage() {
  const offersResult = await getOffers();
  const statsResult = await getOfferStats();
  
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
