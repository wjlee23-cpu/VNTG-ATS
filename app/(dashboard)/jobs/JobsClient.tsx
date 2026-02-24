'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Briefcase, Search, Plus, Calendar, Users, MapPin, Eye, TrendingUp, Clock, DollarSign } from 'lucide-react';

interface Job {
  id: string;
  title: string;
  description: string;
  organization_id: string;
  process_id: string;
  created_at: string;
  updated_at: string;
  category?: string;
  location?: string;
  salary_min?: number;
  salary_max?: number;
  views?: number;
  match_rate?: number;
  employment_type?: string;
  status?: string;
  processes?: {
    id: string;
    name: string;
    stages: Array<{
      id: string;
      name: string;
      order: number;
    }>;
  };
  _count?: {
    candidates?: number;
  };
}

interface JobsClientProps {
  initialJobs: Job[];
  stats: {
    activeJobs: number;
    totalApplicants: number;
    avgMatchRate: number;
    totalViews: number;
  };
  error?: string;
}

export function JobsClient({ initialJobs, stats, error }: JobsClientProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  // 검색 필터링
  const filteredJobs = initialJobs.filter(job => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      job.title.toLowerCase().includes(query) ||
      job.description?.toLowerCase().includes(query) ||
      job.processes?.name.toLowerCase().includes(query) ||
      job.category?.toLowerCase().includes(query) ||
      job.location?.toLowerCase().includes(query)
    );
  });

  // Active positions 계산
  const activePositions = initialJobs.filter(job => job.status === 'active').length;

  // 급여 포맷팅
  const formatSalary = (min?: number, max?: number) => {
    if (!min && !max) return '급여 협의';
    if (min && max) return `₩${(min / 1000000).toFixed(0)}M - ₩${(max / 1000000).toFixed(0)}M`;
    if (min) return `₩${(min / 1000000).toFixed(0)}M 이상`;
    return `₩${(max! / 1000000).toFixed(0)}M 이하`;
  };

  // 조회수 포맷팅
  const formatViews = (views?: number) => {
    if (!views) return '0 views';
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K views`;
    return `${views} views`;
  };

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="px-8 py-6">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Job Postings</h1>
            <p className="text-muted-foreground">{activePositions} active positions</p>
          </div>
          <button
            onClick={() => router.push('/jobs/create')}
            className="px-6 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
          >
            <Plus size={18} />
            Create Job
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="card-modern p-6">
            <div className="text-3xl font-bold text-primary mb-1">{stats.activeJobs}</div>
            <div className="text-sm text-muted-foreground">Active Jobs</div>
          </div>
          <div className="card-modern p-6">
            <div className="text-3xl font-bold text-foreground mb-1">{stats.totalApplicants}</div>
            <div className="text-sm text-muted-foreground">Total Applicants</div>
          </div>
          <div className="card-modern p-6">
            <div className="text-3xl font-bold text-primary mb-1">{stats.avgMatchRate}%</div>
            <div className="text-sm text-muted-foreground">Avg. Match Rate</div>
          </div>
          <div className="card-modern p-6">
            <div className="text-3xl font-bold text-accent mb-1">
              {stats.totalViews >= 1000 ? `${(stats.totalViews / 1000).toFixed(1)}K` : stats.totalViews}
            </div>
            <div className="text-sm text-muted-foreground">Total Views</div>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={20} />
            <input
              type="text"
              placeholder="채용 공고 제목, 설명으로 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive">
            {error}
          </div>
        )}

        {/* Jobs List */}
        {filteredJobs.length === 0 ? (
          <div className="card-modern p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Briefcase className="text-muted-foreground" size={32} />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">채용 공고가 없습니다</h2>
            <p className="text-muted-foreground mb-6">
              {searchQuery ? '검색 결과가 없습니다.' : '아직 등록된 채용 공고가 없습니다.'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => router.push('/jobs/create')}
                className="px-6 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors"
              >
                첫 채용 공고 만들기
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredJobs.map((job) => (
              <div
                key={job.id}
                onClick={() => router.push(`/jobs/${job.id}`)}
                className="card-modern p-6 cursor-pointer relative"
              >
                {/* Status Badge */}
                <div className="absolute top-4 right-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    job.status === 'active' 
                      ? 'bg-primary/10 text-primary' 
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {job.status === 'active' ? 'active' : job.status || 'draft'}
                  </span>
                </div>

                <h3 className="text-xl font-bold text-foreground mb-2 pr-20">{job.title}</h3>
                <p className="text-sm text-muted-foreground mb-4">{job.category || 'Uncategorized'}</p>

                <div className="space-y-3 mb-4">
                  {/* Location */}
                  {job.location && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin size={14} className="text-muted-foreground" />
                      <span>{job.location}</span>
                    </div>
                  )}

                  {/* Salary */}
                  {(job.salary_min || job.salary_max) && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <DollarSign size={14} className="text-muted-foreground" />
                      <span>{formatSalary(job.salary_min, job.salary_max)}</span>
                    </div>
                  )}

                  {/* Views */}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Eye size={14} className="text-muted-foreground" />
                    <span>{formatViews(job.views)}</span>
                  </div>

                  {/* Match Rate */}
                  {job.match_rate !== null && job.match_rate !== undefined && (
                    <div className="flex items-center gap-2 text-sm text-primary">
                      <TrendingUp size={14} />
                      <span>{job.match_rate}% match rate</span>
                    </div>
                  )}

                  {/* Employment Type */}
                  {job.employment_type && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock size={14} className="text-muted-foreground" />
                      <span className="capitalize">{job.employment_type.replace('-', ' ')}</span>
                    </div>
                  )}

                  {/* Applicants */}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users size={14} className="text-muted-foreground" />
                    <span>{job._count?.candidates || 0} applicants</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary */}
        {filteredJobs.length > 0 && (
          <div className="mt-6 text-sm text-muted-foreground">
            총 {filteredJobs.length}개의 채용 공고
          </div>
        )}
      </div>
    </div>
  );
}
