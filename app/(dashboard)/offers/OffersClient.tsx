'use client';

import { Gift, CheckCircle2, Mail, Phone, Briefcase, Calendar, MoreVertical, DollarSign } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Offer {
  id: string;
  candidate_id: string;
  offer_salary: number;
  offer_currency: string;
  offer_sent_at: string;
  offer_response_at: string | null;
  offer_status: 'pending' | 'accepted' | 'rejected' | 'negotiating';
  candidates?: {
    id: string;
    name: string;
    email: string;
    job_posts?: {
      id: string;
      title: string;
    };
  };
}

interface OffersClientProps {
  offers: Offer[];
  stats: {
    accepted: number;
    pending: number;
    negotiating: number;
    acceptRate: number;
  };
  error?: string;
}

export function OffersClient({ offers, stats, error }: OffersClientProps) {
  const router = useRouter();

  // 급여 포맷팅
  const formatSalary = (salary: number, currency: string = 'KRW') => {
    if (currency === 'KRW') {
      return `₩${(salary / 1000000).toFixed(0)}M`;
    }
    return `${currency} ${salary.toLocaleString()}`;
  };

  // Status 색상
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted':
        return 'bg-green-100 text-green-700';
      case 'pending':
        return 'bg-yellow-100 text-yellow-700';
      case 'negotiating':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  // Status 텍스트
  const getStatusText = (status: string) => {
    switch (status) {
      case 'accepted':
        return 'Accepted';
      case 'pending':
        return 'Pending';
      case 'negotiating':
        return 'Negotiating';
      default:
        return status;
    }
  };

  // 후보자 아바타 이니셜
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="h-full overflow-auto bg-[#FAFAFA]">
      <div className="px-8 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Offer Management</h1>
            <p className="text-gray-600">Track and manage job offers</p>
          </div>
          <button
            onClick={() => router.push('/offers/create')}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Gift size={18} />
            Create Offer
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-green-50 rounded-2xl border border-green-200 p-6">
            <div className="text-3xl font-bold text-green-700 mb-1">{stats.accepted}</div>
            <div className="text-sm text-green-600">Accepted</div>
          </div>
          <div className="bg-yellow-50 rounded-2xl border border-yellow-200 p-6">
            <div className="text-3xl font-bold text-yellow-700 mb-1">{stats.pending}</div>
            <div className="text-sm text-yellow-600">Pending</div>
          </div>
          <div className="bg-blue-50 rounded-2xl border border-blue-200 p-6">
            <div className="text-3xl font-bold text-blue-700 mb-1">{stats.negotiating}</div>
            <div className="text-sm text-blue-600">Negotiating</div>
          </div>
          <div className="bg-purple-50 rounded-2xl border border-purple-200 p-6">
            <div className="text-3xl font-bold text-purple-700 mb-1">{stats.acceptRate}%</div>
            <div className="text-sm text-purple-600">Accept Rate</div>
          </div>
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
          <div className="space-y-4">
            {offers.map((offer) => (
              <div
                key={offer.id}
                className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg transition-all"
              >
                <div className="flex items-start justify-between">
                  {/* Left: Candidate Info */}
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold text-sm">
                      {offer.candidates?.name ? getInitials(offer.candidates.name) : '?'}
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-gray-900 mb-1">
                        {offer.candidates?.name || 'Unknown'}
                      </div>
                      <div className="text-sm text-gray-600 mb-3">
                        {offer.candidates?.job_posts?.title || 'No position'}
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                        <div>
                          <span className="text-gray-400">Sent:</span>{' '}
                          {new Date(offer.offer_sent_at).toISOString().split('T')[0]}
                        </div>
                        {offer.offer_response_at && (
                          <div>
                            <span className="text-gray-400">Response:</span>{' '}
                            {new Date(offer.offer_response_at).toISOString().split('T')[0]}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Salary & Status */}
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-sm text-gray-500 mb-1">Offered Salary</div>
                      <div className="text-xl font-bold text-gray-900">
                        {formatSalary(offer.offer_salary, offer.offer_currency)}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(offer.offer_status)}`}>
                        {getStatusText(offer.offer_status)}
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                            <MoreVertical size={18} className="text-gray-400" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/candidates/${offer.candidate_id}`)}>
                            View Candidate
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => router.push(`/offers/${offer.id}/edit`)}>
                            Edit Offer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
