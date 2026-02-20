'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Briefcase, Search, Plus, Calendar, Users, MapPin } from 'lucide-react';

interface Job {
  id: string;
  title: string;
  description: string;
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

interface JobsClientProps {
  initialJobs: Job[];
  error?: string;
}

export function JobsClient({ initialJobs, error }: JobsClientProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  // 검색 필터링
  const filteredJobs = initialJobs.filter(job => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      job.title.toLowerCase().includes(query) ||
      job.description?.toLowerCase().includes(query) ||
      job.processes?.name.toLowerCase().includes(query)
    );
  });

  return (
    <div className="h-full overflow-auto">
      <div className="px-8 py-6">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Jobs</h1>
            <p className="text-gray-600">채용 공고를 확인하고 관리하세요.</p>
          </div>
          <button
            onClick={() => router.push('/jobs/create')}
            className="px-6 py-3 bg-brand-main text-white rounded-xl font-medium hover:bg-brand-dark transition-colors flex items-center gap-2"
          >
            <Plus size={18} />
            새 채용 공고
          </button>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="채용 공고 제목, 설명으로 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-main focus:border-transparent"
            />
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
            {error}
          </div>
        )}

        {/* Jobs List */}
        {filteredJobs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Briefcase className="text-gray-400" size={32} />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">채용 공고가 없습니다</h2>
            <p className="text-gray-600 mb-6">
              {searchQuery ? '검색 결과가 없습니다.' : '아직 등록된 채용 공고가 없습니다.'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => router.push('/jobs/create')}
                className="px-6 py-3 bg-brand-main text-white rounded-xl font-medium hover:bg-brand-dark transition-colors"
              >
                첫 채용 공고 만들기
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredJobs.map((job) => (
              <div
                key={job.id}
                onClick={() => router.push(`/jobs/${job.id}`)}
                className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-dark to-brand-main flex items-center justify-center">
                    <Briefcase className="text-white" size={24} />
                  </div>
                  <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                    모집중
                  </span>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2">
                  {job.title}
                </h3>
                <p className="text-sm text-gray-600 mb-4 line-clamp-3">
                  {job.description || '설명이 없습니다.'}
                </p>
                <div className="space-y-2 pt-4 border-t border-gray-100">
                  {job.processes && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Users size={14} />
                      <span>{job.processes.name}</span>
                      {job.processes.stages && (
                        <span className="text-gray-400">
                          ({job.processes.stages.length}단계)
                        </span>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Calendar size={14} />
                    <span>
                      {new Date(job.created_at).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary */}
        {filteredJobs.length > 0 && (
          <div className="mt-6 text-sm text-gray-600">
            총 {filteredJobs.length}개의 채용 공고
          </div>
        )}
      </div>
    </div>
  );
}
