'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Plus, Briefcase, User, Calendar, Clock, AlertCircle, Check, X } from 'lucide-react';
import { approveJDRequest, rejectJDRequest } from '@/api/actions/jd-requests';
import { toast } from 'sonner';

interface JDRequest {
  id: string;
  title: string;
  description: string;
  category?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'approved' | 'rejected';
  requested_by: string;
  submitted_at: string;
  requested_by_user?: {
    id: string;
    email: string;
  };
}

interface JDRequestsClientProps {
  initialRequests: JDRequest[];
  stats: {
    all: number;
    pending: number;
    approved: number;
    rejected: number;
  };
  error?: string;
  isAdmin?: boolean;
}

type FilterStatus = 'all' | 'pending' | 'approved' | 'rejected';

export function JDRequestsClient({ initialRequests, stats, error, isAdmin = false }: JDRequestsClientProps) {
  const router = useRouter();
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('pending');
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  // 필터링된 요청 목록
  const filteredRequests = filterStatus === 'all'
    ? initialRequests
    : initialRequests.filter(req => req.status === filterStatus);

  // Priority 색상
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'medium':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  // Status 색상
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-700';
      case 'rejected':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-orange-100 text-orange-700';
    }
  };

  // Status 텍스트
  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved':
        return 'Approved';
      case 'rejected':
        return 'Rejected';
      default:
        return 'Pending Review';
    }
  };

  // 요청자 이름 추출
  const getRequesterName = (request: JDRequest) => {
    if (request.requested_by_user?.email) {
      const email = request.requested_by_user.email;
      const name = email.split('@')[0];
      return name.split('.').map(n => n.charAt(0).toUpperCase() + n.slice(1)).join(' ');
    }
    return 'Unknown';
  };

  // JD 요청 승인
  const handleApprove = async (id: string) => {
    setProcessingIds(prev => new Set(prev).add(id));
    try {
      const result = await approveJDRequest(id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('JD 요청이 승인되었습니다.');
        router.refresh();
      }
    } catch (error) {
      toast.error('JD 요청 승인에 실패했습니다.');
      console.error(error);
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  // JD 요청 거부
  const handleReject = async (id: string) => {
    setProcessingIds(prev => new Set(prev).add(id));
    try {
      const result = await rejectJDRequest(id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('JD 요청이 거부되었습니다.');
        router.refresh();
      }
    } catch (error) {
      toast.error('JD 요청 거부에 실패했습니다.');
      console.error(error);
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  return (
    <div className="h-full overflow-auto bg-[#FAFAFA]">
      <div className="px-8 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">JD Requests</h1>
            <p className="text-gray-600">
              {isAdmin 
                ? 'Review and approve job description requests from hiring managers'
                : 'View your submitted JD requests'}
            </p>
          </div>
          {!isAdmin && (
            <button
              onClick={() => router.push('/jd-requests/create')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              새 JD 요청
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-4 py-2 rounded-xl font-medium transition-colors ${
              filterStatus === 'all'
                ? 'bg-orange-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            All ({stats.all})
          </button>
          <button
            onClick={() => setFilterStatus('pending')}
            className={`px-4 py-2 rounded-xl font-medium transition-colors ${
              filterStatus === 'pending'
                ? 'bg-orange-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            Pending ({stats.pending})
          </button>
          <button
            onClick={() => setFilterStatus('approved')}
            className={`px-4 py-2 rounded-xl font-medium transition-colors ${
              filterStatus === 'approved'
                ? 'bg-orange-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            Approved ({stats.approved})
          </button>
          <button
            onClick={() => setFilterStatus('rejected')}
            className={`px-4 py-2 rounded-xl font-medium transition-colors ${
              filterStatus === 'rejected'
                ? 'bg-orange-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            Rejected ({stats.rejected})
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
            {error}
          </div>
        )}

        {/* Requests List */}
        {filteredRequests.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <FileText className="text-gray-400" size={32} />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">JD 요청이 없습니다</h2>
            <p className="text-gray-600">
              {filterStatus === 'all' 
                ? '아직 등록된 JD 요청이 없습니다.' 
                : `${filterStatus} 상태의 요청이 없습니다.`}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRequests.map((request) => (
              <div
                key={request.id}
                className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-gray-900">{request.title}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getPriorityColor(request.priority)}`}>
                        {request.priority === 'high' ? 'High Priority' : request.priority === 'medium' ? 'Medium' : 'Low'}
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-3">
                      {request.category && (
                        <div className="flex items-center gap-2">
                          <Briefcase size={14} className="text-gray-400" />
                          <span>{request.category}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <User size={14} className="text-gray-400" />
                        <span>{getRequesterName(request)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-gray-400" />
                        <span>Submitted {new Date(request.submitted_at).toISOString().split('T')[0]}</span>
                      </div>
                    </div>

                    {request.description && (
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {request.description}
                      </p>
                    )}
                  </div>

                  <div className="ml-4 flex flex-col items-end gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(request.status)}`}>
                      <Clock size={12} />
                      {getStatusText(request.status)}
                    </span>
                    {isAdmin && request.status === 'pending' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApprove(request.id)}
                          disabled={processingIds.has(request.id)}
                          className="px-3 py-1 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                        >
                          <Check size={14} />
                          승인
                        </button>
                        <button
                          onClick={() => handleReject(request.id)}
                          disabled={processingIds.has(request.id)}
                          className="px-3 py-1 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                        >
                          <X size={14} />
                          거부
                        </button>
                      </div>
                    )}
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
