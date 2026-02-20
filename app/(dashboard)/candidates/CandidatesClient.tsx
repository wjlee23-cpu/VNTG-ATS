'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Search, Filter, Mail, Phone, Briefcase, Calendar, MoreHorizontal } from 'lucide-react';
import { RECRUITMENT_STAGES, getStageNameByStageId } from '@/constants/stages';

interface Candidate {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: 'pending' | 'in_progress' | 'confirmed' | 'rejected' | 'issue';
  current_stage_id: string | null;
  job_post_id: string;
  parsed_data: {
    match_score?: number;
    skills?: string[];
    experience?: string;
    education?: string;
  } | null;
  created_at: string;
  job_posts?: {
    title: string;
  };
}

interface CandidatesClientProps {
  initialCandidates: Candidate[];
  stageCounts?: Record<string, number>;
  error?: string;
}

export function CandidatesClient({ initialCandidates, stageCounts = {}, error }: CandidatesClientProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStage, setSelectedStage] = useState<string>('all');

  // 단계별 필터링 함수
  // current_stage_id는 process의 stage ID("stage-1", "stage-2" 등)를 저장하므로
  // 매핑 상수를 사용하여 단계 이름으로 변환
  const getStageName = (stageId: string | null): string => {
    // current_stage_id가 null이거나 빈 문자열이면 'New Application'으로 간주
    if (!stageId) {
      return 'New Application';
    }
    
    // stage ID를 단계 이름으로 매핑
    const mappedName = getStageNameByStageId(stageId);
    if (mappedName) {
      return mappedName;
    }
    
    // 매핑되지 않은 경우, stageId가 이미 단계 이름인지 확인 (하위 호환성)
    const stageNames = [
      'New Application',
      'HR Screening',
      'Application Review',
      'Competency Assessment',
      'Technical Test',
      '1st Interview',
      'Reference Check',
      '2nd Interview',
    ];
    
    if (stageNames.includes(stageId)) {
      return stageId;
    }
    
    // 그 외의 경우는 'New Application'으로 간주
    return 'New Application';
  };

  // stage.id를 단계 이름으로 변환
  const getStageNameById = (stageId: string): string => {
    const stage = RECRUITMENT_STAGES.find(s => s.id === stageId);
    return stage?.name || '';
  };

  // 검색 및 단계 필터링
  const filteredCandidates = initialCandidates.filter(candidate => {
    // 단계 필터링
    if (selectedStage !== 'all') {
      const candidateStage = getStageName(candidate.current_stage_id);
      const selectedStageName = getStageNameById(selectedStage);
      if (candidateStage !== selectedStageName) {
        return false;
      }
    }

    // 검색 필터링
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      candidate.name.toLowerCase().includes(query) ||
      candidate.email.toLowerCase().includes(query) ||
      candidate.job_posts?.title.toLowerCase().includes(query) ||
      candidate.parsed_data?.skills?.some(skill => skill.toLowerCase().includes(query))
    );
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

  // 상태 텍스트
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

  // 전체 활성 후보자 수 계산 (필터링 전)
  const activeCandidatesCount = initialCandidates.length;

  return (
    <div className="h-full overflow-auto">
      <div className="px-8 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Candidates</h1>
          <p className="text-gray-600">{activeCandidatesCount} active candidates</p>
        </div>

        {/* Stage Filters */}
        <div className="mb-6 overflow-x-auto">
          <div className="flex gap-2 pb-2 min-w-max">
            {RECRUITMENT_STAGES.map((stage) => {
              const count = stage.id === 'all' 
                ? activeCandidatesCount 
                : (stageCounts[stage.name] || 0);
              const isSelected = selectedStage === stage.id;
              
              return (
                <button
                  key={stage.id}
                  onClick={() => setSelectedStage(stage.id)}
                  className={`
                    px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors
                    ${isSelected
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }
                  `}
                >
                  {stage.label}
                  {count > 0 && (
                    <span className={`ml-2 ${isSelected ? 'text-blue-100' : 'text-gray-500'}`}>
                      ({count})
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search candidates, jobs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-main focus:border-transparent"
            />
          </div>
          <button className="px-4 py-2 border border-gray-300 rounded-xl hover:bg-gray-50 flex items-center gap-2">
            <Filter size={18} />
            필터
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
            {error}
          </div>
        )}

        {/* Candidates List */}
        {filteredCandidates.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Users className="text-gray-400" size={32} />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">후보자가 없습니다</h2>
            <p className="text-gray-600 mb-6">
              {searchQuery ? '검색 결과가 없습니다.' : '아직 등록된 후보자가 없습니다.'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => router.push('/jobs')}
                className="px-6 py-3 bg-brand-main text-white rounded-xl font-medium hover:bg-brand-dark transition-colors"
              >
                채용 공고 보기
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">CANDIDATE</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">POSITION</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">STAGE</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">MATCH</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">APPLIED</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">STATUS</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredCandidates.map((candidate) => {
                    const stageName = getStageName(candidate.current_stage_id);
                    const matchScore = candidate.parsed_data?.match_score || 0;
                    
                    return (
                      <tr
                        key={candidate.id}
                        onClick={() => router.push(`/candidates/${candidate.id}`)}
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        {/* CANDIDATE */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold">
                              {candidate.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{candidate.name}</div>
                              <div className="text-sm text-gray-500">{candidate.email}</div>
                            </div>
                          </div>
                        </td>
                        {/* POSITION */}
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">
                            <div className="font-medium">{candidate.job_posts?.title || '알 수 없음'}</div>
                            <div className="text-gray-500 text-xs mt-1">Seoul, Korea</div>
                          </div>
                        </td>
                        {/* STAGE */}
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-3 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                            {stageName}
                          </span>
                        </td>
                        {/* MATCH */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[100px]">
                              <div 
                                className="bg-blue-600 h-2 rounded-full transition-all"
                                style={{ width: `${matchScore}%` }}
                              />
                            </div>
                            <span className="text-sm font-semibold text-gray-900">{matchScore}</span>
                          </div>
                        </td>
                        {/* APPLIED */}
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-600">
                            {new Date(candidate.created_at).toISOString().split('T')[0]}
                          </div>
                        </td>
                        {/* STATUS */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${
                              candidate.status === 'confirmed' ? 'bg-green-500' :
                              candidate.status === 'in_progress' ? 'bg-blue-500' :
                              candidate.status === 'pending' ? 'bg-yellow-500' :
                              candidate.status === 'rejected' ? 'bg-red-500' :
                              'bg-orange-500'
                            }`} />
                            <span className="text-sm text-gray-700 capitalize">
                              {candidate.status === 'confirmed' ? 'Active' :
                               candidate.status === 'in_progress' ? 'Active' :
                               candidate.status === 'pending' ? 'New' :
                               candidate.status === 'rejected' ? 'Rejected' :
                               'Scheduled'}
                            </span>
                          </div>
                        </td>
                        {/* Actions */}
                        <td className="px-6 py-4">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              // TODO: 메뉴 열기 기능 구현
                            }}
                            className="p-1 hover:bg-gray-100 rounded transition-colors"
                          >
                            <MoreHorizontal size={16} className="text-gray-400" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Summary */}
        {filteredCandidates.length > 0 && (
          <div className="mt-4 text-sm text-gray-600">
            총 {filteredCandidates.length}명의 후보자
          </div>
        )}
      </div>
    </div>
  );
}
