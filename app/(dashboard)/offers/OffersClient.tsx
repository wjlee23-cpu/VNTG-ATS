'use client';

import { Gift, CheckCircle2, Mail, Phone, Briefcase, Calendar } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Offer {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  job_posts?: {
    title: string;
  };
  created_at: string;
}

interface OffersClientProps {
  offers: Offer[];
  error?: string;
}

export function OffersClient({ offers, error }: OffersClientProps) {
  const router = useRouter();

  return (
    <div className="h-full overflow-auto">
      <div className="px-8 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Offers</h1>
          <p className="text-gray-600">오퍼를 받은 후보자를 관리하세요.</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
            {error}
          </div>
        )}

        {/* Offers List */}
        {offers.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Gift className="text-gray-400" size={32} />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">오퍼가 없습니다</h2>
            <p className="text-gray-600">아직 오퍼를 받은 후보자가 없습니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {offers.map((offer) => (
              <div
                key={offer.id}
                onClick={() => router.push(`/candidates/${offer.id}`)}
                className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                    <CheckCircle2 className="text-white" size={24} />
                  </div>
                  <span className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium">
                    오퍼 확정
                  </span>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{offer.name}</h3>
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <Mail size={14} />
                    {offer.email}
                  </div>
                  {offer.phone && (
                    <div className="flex items-center gap-2">
                      <Phone size={14} />
                      {offer.phone}
                    </div>
                  )}
                  {offer.job_posts && (
                    <div className="flex items-center gap-2">
                      <Briefcase size={14} />
                      {offer.job_posts.title}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Calendar size={14} />
                    {new Date(offer.created_at).toLocaleDateString('ko-KR')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary */}
        {offers.length > 0 && (
          <div className="mt-6 text-sm text-gray-600">
            총 {offers.length}명의 후보자가 오퍼를 받았습니다.
          </div>
        )}
      </div>
    </div>
  );
}
