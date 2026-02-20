'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Briefcase, Users, Calendar, Mail, Phone, Search, Filter } from 'lucide-react';
import { useState } from 'react';

interface Job {
  id: string;
  title: string;
  description: string | null;
  organization_id: string;
  process_id: string;
  created_at: string;
  updated_at: string;
  processes?: {
    id: string;
    name: string;
    stages: Array<{
      id: string;
      name: string;
      order: number;
    }>;
  };
}

interface Candidate {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: 'pending' | 'in_progress' | 'confirmed' | 'rejected' | 'issue';
  current_stage_id: string;
  parsed_data: {
    match_score?: number;
    skills?: string[];
  } | null;
  created_at: string;
}

interface JobStats {
  totalJobs: number;
  totalCandidates: number;
  candidatesByJob: Array<{
    jobId: string;
    jobTitle: string;
    count: number;
  }>;
}

interface JobDetailClientProps {
  job: Job;
  candidates: Candidate[];
  stats?: JobStats;
}

export function JobDetailClient({ job, candidates, stats }: JobDetailClientProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // 검색 및 필터링
  const filteredCandidates = candidates.filter(candidate => {
    const matchesSearch = !searchQuery || 
      candidate.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      candidate.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || candidate.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // 상태별 색상
  const getStatusColor = (status: string) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      in_progress: 'bg-blue-100 text-blue-800',
      confirmed: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      issue: 'bg-orange-100 text-orange-800',
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getStatusText = (status: string) => {
    const texts = {
      pending: '대기중',
      in_progress: '진행중',
      confirmed: '확정',
      rejected: '거절',
      issue: '이슈',
    };
    return texts[status as keyof typeof texts] || status;
  };

  // 상태별 통계
  const statusCounts = candidates.reduce((acc, candidate) => {
    acc[candidate.status] = (acc[candidate.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="h-full overflow-auto">
      <div className="px-8 py-6">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft size={18} />
            뒤로가기
          </button>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{job.title}</h1>
              {job.processes && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Briefcase size={16} />
                  {job.processes.name}
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600">후보자</div>
              <div className="text-2xl font-bold text-gray-900">{candidates.length}명</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Job Description */}
            {job.description && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">상세 설명</h2>
                <p className="text-gray-600 whitespace-pre-wrap">{job.description}</p>
              </div>
            )}

            {/* Process Stages */}
            {job.processes && job.processes.stages && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">채용 프로세스</h2>
                <div className="flex items-center gap-2 overflow-x-auto pb-2">
                  {job.processes.stages.map((stage, index) => (
                    <div key={stage.id} className="flex items-center flex-shrink-0">
                      <div className="text-center">
                        <div className="w-12 h-12 rounded-full bg-brand-main text-white flex items-center justify-center font-semibold mb-2">
                          {index + 1}
                        </div>
                        <div className="text-xs text-gray-600 max-w-[80px]">{stage.name}</div>
                      </div>
                      {index < job.processes!.stages!.length - 1 && (
                        <div className="h-1 w-8 bg-gray-200 mx-2" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Candidates List */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">후보자 목록</h2>
                <span className="text-sm text-gray-600">{filteredCandidates.length}명</span>
              </div>

              {/* Search and Filter */}
              <div className="mb-4 flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    placeholder="이름, 이메일로 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-main focus:border-transparent text-sm"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-main focus:border-transparent text-sm"
                >
                  <option value="all">전체 상태</option>
                  <option value="pending">대기중</option>
                  <option value="in_progress">진행중</option>
                  <option value="confirmed">확정</option>
                  <option value="rejected">거절</option>
                  <option value="issue">이슈</option>
                </select>
              </div>

              {/* Candidates Table */}
              {filteredCandidates.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="mx-auto text-gray-400 mb-2" size={32} />
                  <p className="text-gray-500 text-sm">
                    {searchQuery || statusFilter !== 'all' ? '검색 결과가 없습니다.' : '등록된 후보자가 없습니다.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">이름</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">연락처</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">매치</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">상태</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">등록일</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredCandidates.map((candidate) => (
                        <tr
                          key={candidate.id}
                          onClick={() => router.push(`/candidates/${candidate.id}`)}
                          className="hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">{candidate.name}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-600">{candidate.email}</div>
                            {candidate.phone && (
                              <div className="text-xs text-gray-500">{candidate.phone}</div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {candidate.parsed_data?.match_score ? (
                              <div className="text-sm font-semibold text-brand-main">
                                {candidate.parsed_data.match_score}%
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(candidate.status)}`}>
                              {getStatusText(candidate.status)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-600">
                              {new Date(candidate.created_at).toLocaleDateString('ko-KR')}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* Status Statistics */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">상태별 통계</h2>
              <div className="space-y-3">
                {Object.entries(statusCounts).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">{getStatusText(status)}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${getStatusColor(status).split(' ')[0]}`}
                          style={{ width: `${(count / candidates.length) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-gray-900 w-8 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Job Info */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">정보</h2>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-gray-600">생성일</span>
                  <p className="text-gray-900 font-medium">
                    {new Date(job.created_at).toLocaleDateString('ko-KR')}
                  </p>
                </div>
                <div>
                  <span className="text-gray-600">수정일</span>
                  <p className="text-gray-900 font-medium">
                    {new Date(job.updated_at).toLocaleDateString('ko-KR')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
