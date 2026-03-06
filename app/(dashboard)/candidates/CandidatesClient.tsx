'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Users, Search, Filter, Mail, Phone, Briefcase, Calendar, MoreHorizontal, Archive } from 'lucide-react';
import { RECRUITMENT_STAGES, getStageNameByStageId } from '@/constants/stages';
import { getCandidateById, getArchivedCandidates } from '@/api/queries/candidates';
import { getSchedulesByCandidate } from '@/api/queries/schedules';
import { getTimelineEvents } from '@/api/queries/timeline';
import { CandidateDetailClient } from '@/app/(dashboard)/candidates/[id]/CandidateDetailClient';
import { ArchiveCandidateModal } from '@/components/candidates/ArchiveCandidateModal';
import { AddCandidateModal } from '@/components/candidates/AddCandidateModal';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';

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
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStage, setSelectedStage] = useState<string>('all');
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [candidateDetail, setCandidateDetail] = useState<any>(null);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<any[]>([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [archiveFilter, setArchiveFilter] = useState<'active' | 'archived'>('active');
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [selectedCandidateForArchive, setSelectedCandidateForArchive] = useState<{ id: string; name: string } | null>(null);
  const [addCandidateModalOpen, setAddCandidateModalOpen] = useState(false);
  const [archivedCandidates, setArchivedCandidates] = useState<Candidate[]>([]);
  const [isLoadingArchived, setIsLoadingArchived] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // 클라이언트 마운트 확인 (Hydration 에러 방지)
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 아카이브 필터 변경 시 아카이브된 후보자 로드
  useEffect(() => {
    if (archiveFilter === 'archived' && isMounted) {
      loadArchivedCandidates();
    }
  }, [archiveFilter, isMounted]);

  const loadArchivedCandidates = async () => {
    setIsLoadingArchived(true);
    try {
      const result = await getArchivedCandidates();
      if (result.error) {
        console.error('Failed to load archived candidates:', result.error);
      } else {
        setArchivedCandidates(result.data || []);
      }
    } catch (error) {
      console.error('Load archived candidates error:', error);
    } finally {
      setIsLoadingArchived(false);
    }
  };

  // URL query parameter에서 selected 값 읽기
  useEffect(() => {
    const selected = searchParams.get('selected');
    setSelectedCandidateId(selected);
    
    // selected가 있으면 해당 candidate 데이터 로드
    if (selected) {
      loadCandidateDetail(selected);
    } else {
      // selected가 없으면 detail 데이터 초기화
      setCandidateDetail(null);
      setSchedules([]);
      setTimelineEvents([]);
    }
  }, [searchParams]);

  // Candidate detail 데이터 로드
  const loadCandidateDetail = async (candidateId: string) => {
    setIsLoadingDetail(true);
    setDetailError(null);
    
    // initialCandidates에서 기본 정보 먼저 찾기
    const initialCandidate = initialCandidates.find(c => c.id === candidateId);
    if (initialCandidate) {
      // 기본 정보로 먼저 표시 (로딩 중에도 기본 정보는 보이도록)
      setCandidateDetail({
        ...initialCandidate,
        // 기본 정보만 있는 상태로 표시
      });
    }
    
    try {
      const [candidateResult, schedulesResult, timelineResult] = await Promise.all([
        getCandidateById(candidateId),
        getSchedulesByCandidate(candidateId),
        getTimelineEvents(candidateId),
      ]);

      if (candidateResult.error || !candidateResult.data) {
        // 에러가 발생해도 initialCandidates의 기본 정보가 있으면 계속 표시
        if (!initialCandidate) {
          setDetailError(candidateResult.error || '후보자를 찾을 수 없습니다.');
          setCandidateDetail(null);
        } else {
          // 기본 정보는 유지하고, 스케줄과 타임라인만 로드 시도
          setDetailError(null);
        }
      } else {
        // 성공적으로 로드된 경우 상세 정보로 업데이트
        setCandidateDetail(candidateResult.data);
        setSchedules(schedulesResult.data || []);
        setTimelineEvents(timelineResult.data || []);
        setDetailError(null);
      }
    } catch (err) {
      // 에러가 발생해도 initialCandidates의 기본 정보가 있으면 계속 표시
      if (!initialCandidate) {
        setDetailError('후보자 정보를 불러오는 중 오류가 발생했습니다.');
        setCandidateDetail(null);
      } else {
        // 기본 정보는 유지
        setDetailError(null);
        // 스케줄과 타임라인은 빈 배열로 설정
        setSchedules([]);
        setTimelineEvents([]);
      }
    } finally {
      setIsLoadingDetail(false);
    }
  };

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

  // 아카이브 필터에 따라 후보자 목록 선택
  const candidatesToFilter = archiveFilter === 'archived' ? archivedCandidates : initialCandidates;

  // 검색 및 단계 필터링
  const filteredCandidates = candidatesToFilter.filter(candidate => {
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
      pending: 'bg-accent/10 text-accent',
      in_progress: 'bg-primary/10 text-primary',
      confirmed: 'bg-primary/10 text-primary',
      rejected: 'bg-destructive/10 text-destructive',
      issue: 'bg-accent/10 text-accent',
    };
    return colors[status as keyof typeof colors] || 'bg-muted text-muted-foreground';
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
  // Hydration 에러 방지를 위해 초기 렌더링에서는 항상 initialCandidates 사용
  const activeCandidatesCount = isMounted && archiveFilter === 'archived'
    ? archivedCandidates.length 
    : initialCandidates.length;

  // Candidate 클릭 핸들러
  const handleCandidateClick = (candidateId: string) => {
    router.push(`/candidates?selected=${candidateId}`);
  };

  // Detail 패널 닫기
  const handleCloseDetail = () => {
    router.push('/candidates');
  };

  return (
    <div className="h-full overflow-auto">
      {/* Candidates 리스트 */}
      <div className="px-8 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Candidates</h1>
            <p className="text-muted-foreground">{activeCandidatesCount} active candidates</p>
          </div>
          <div className="flex items-center gap-3">
            {/* 아카이브 필터 */}
            <div className="flex gap-2">
              <button
                onClick={() => setArchiveFilter('active')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  archiveFilter === 'active'
                    ? 'bg-primary text-white'
                    : 'bg-background text-foreground border border-border hover:bg-muted'
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setArchiveFilter('archived')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  archiveFilter === 'archived'
                    ? 'bg-primary text-white'
                    : 'bg-background text-foreground border border-border hover:bg-muted'
                }`}
              >
                Archived
              </button>
            </div>
            {/* 후보자 추가 버튼 */}
            <Button
              onClick={() => setAddCandidateModalOpen(true)}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              <Users className="w-4 h-4 mr-2" />
              Add Candidate
            </Button>
          </div>
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
                      ? 'bg-primary text-white'
                      : 'bg-background text-foreground border border-border hover:bg-muted'
                    }
                  `}
                >
                  {stage.label}
                  {count > 0 && (
                    <span className={`ml-2 ${isSelected ? 'text-white' : 'text-muted-foreground'}`}>
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
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={20} />
            <input
              type="text"
              placeholder="Search candidates, jobs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <button className="px-4 py-2 border border-border rounded-xl hover:bg-muted flex items-center gap-2">
            <Filter size={18} />
            필터
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive">
            {error}
          </div>
        )}

        {/* Candidates List */}
        {isLoadingArchived && archiveFilter === 'archived' ? (
          <div className="card-modern p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">아카이브된 후보자를 불러오는 중...</p>
          </div>
        ) : filteredCandidates.length === 0 ? (
          <div className="card-modern p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Users className="text-muted-foreground" size={32} />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">후보자가 없습니다</h2>
            <p className="text-muted-foreground mb-6">
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
          <div className="card-modern overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted border-b border-border">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">CANDIDATE</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">POSITION</th>
                    {/* All Stages를 선택했을 때만 Stage 컬럼 표시 */}
                    {selectedStage === 'all' && (
                      <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">STAGE</th>
                    )}
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">MATCH</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">APPLIED</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">STATUS</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredCandidates.map((candidate) => {
                    const stageName = getStageName(candidate.current_stage_id);
                    const matchScore = candidate.parsed_data?.match_score || 0;
                    
                    return (
                      <tr
                        key={candidate.id}
                        onClick={() => handleCandidateClick(candidate.id)}
                        className={`hover:bg-muted cursor-pointer transition-colors ${
                          selectedCandidateId === candidate.id ? 'bg-primary/10' : ''
                        }`}
                      >
                        {/* CANDIDATE */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold">
                              {candidate.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-medium text-foreground">{candidate.name}</div>
                              <div className="text-sm text-muted-foreground">{candidate.email}</div>
                            </div>
                          </div>
                        </td>
                        {/* POSITION */}
                        <td className="px-6 py-4">
                          <div className="text-sm text-foreground">
                            <div className="font-medium">{candidate.job_posts?.title || '알 수 없음'}</div>
                            <div className="text-muted-foreground text-xs mt-1">Seoul, Korea</div>
                          </div>
                        </td>
                        {/* STAGE - All Stages를 선택했을 때만 표시 */}
                        {selectedStage === 'all' && (
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-3 py-1 rounded-md text-xs font-medium bg-primary/10 text-primary">
                              {stageName}
                            </span>
                          </td>
                        )}
                        {/* MATCH */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 bg-muted rounded-full h-2 max-w-[100px]">
                              <div 
                                className="bg-primary h-2 rounded-full transition-all"
                                style={{ width: `${matchScore}%` }}
                              />
                            </div>
                            <span className="text-sm font-semibold text-foreground">{matchScore}</span>
                          </div>
                        </td>
                        {/* APPLIED */}
                        <td className="px-6 py-4">
                          <div className="text-sm text-muted-foreground">
                            {new Date(candidate.created_at).toISOString().split('T')[0]}
                          </div>
                        </td>
                        {/* STATUS */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${
                              candidate.status === 'confirmed' ? 'bg-primary' :
                              candidate.status === 'in_progress' ? 'bg-primary' :
                              candidate.status === 'pending' ? 'bg-accent' :
                              candidate.status === 'rejected' ? 'bg-destructive' :
                              'bg-accent'
                            }`} />
                            <span className="text-sm text-foreground capitalize">
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
                              setSelectedCandidateForArchive({ id: candidate.id, name: candidate.name });
                              setArchiveModalOpen(true);
                            }}
                            className="p-1 hover:bg-muted rounded transition-colors"
                            title="아카이브"
                          >
                            <Archive size={16} className="text-muted-foreground" />
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
          <div className="mt-4 text-sm text-muted-foreground">
            총 {filteredCandidates.length}명의 후보자
          </div>
        )}
      </div>

      {/* 오른쪽 사이드 패널: Candidate Detail */}
      <Sheet open={!!selectedCandidateId} onOpenChange={(open) => {
        if (!open) {
          handleCloseDetail();
        }
      }}>
        <SheetContent 
          side="right"
          className="!w-full md:!w-[1000px] lg:!w-[1200px] !h-full p-0 overflow-y-auto !max-w-none sm:!max-w-none md:!max-w-none lg:!max-w-none [&>button]:hidden"
        >
          {/* 접근성을 위한 숨겨진 제목 */}
          <SheetTitle className="sr-only">
            {candidateDetail ? `${candidateDetail.name} 상세 정보` : '후보자 상세 정보'}
          </SheetTitle>
          <div className="h-full">
            {isLoadingDetail ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground">로딩 중...</p>
                </div>
              </div>
            ) : detailError ? (
              <div className="flex items-center justify-center h-full p-8">
                <div className="text-center">
                  <p className="text-destructive mb-4">{detailError}</p>
                  <button
                    onClick={handleCloseDetail}
                    className="px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors"
                  >
                    닫기
                  </button>
                </div>
              </div>
            ) : candidateDetail ? (
              <CandidateDetailClient
                candidate={candidateDetail}
                schedules={schedules}
                timelineEvents={timelineEvents}
                onClose={handleCloseDetail}
                isSidebar={true}
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      {/* 아카이브 모달 */}
      {selectedCandidateForArchive && (
        <ArchiveCandidateModal
          candidateId={selectedCandidateForArchive.id}
          candidateName={selectedCandidateForArchive.name}
          isOpen={archiveModalOpen}
          onClose={() => {
            setArchiveModalOpen(false);
            setSelectedCandidateForArchive(null);
            router.refresh();
          }}
        />
      )}

      {/* 후보자 추가 모달 */}
      <AddCandidateModal
        isOpen={addCandidateModalOpen}
        onClose={() => {
          setAddCandidateModalOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}
