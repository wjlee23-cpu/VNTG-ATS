'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Users, Search, Filter, Mail, Phone, Briefcase, Calendar, 
  MoreHorizontal, Archive, CheckCircle2, ArrowRightCircle,
  X, Check, Loader2, ChevronDown
} from 'lucide-react';
import { RECRUITMENT_STAGES, STAGE_ID_TO_NAME_MAP, getStageNameByStageId, getStageNameById } from '@/constants/stages';
import { ARCHIVE_REASONS } from '@/constants/archive-reasons';
import { getCandidateById, getArchivedCandidates, getConfirmedCandidates, getArchivedCandidatesByStage } from '@/api/queries/candidates';
import { confirmHire } from '@/api/actions/offers';
import { sendEmailToCandidate } from '@/api/actions/emails';
import { bulkArchiveCandidates, bulkMoveToStage } from '@/api/actions/candidates-archive';
import { toast } from 'sonner';
import { getSchedulesByCandidate } from '@/api/queries/schedules';
import { getTimelineEvents } from '@/api/queries/timeline';
import { CandidateDetailClient } from '@/app/(dashboard)/candidates/[id]/CandidateDetailClient';
import { ArchiveCandidateModal } from '@/components/candidates/ArchiveCandidateModal';
import { AddCandidateModal } from '@/components/candidates/AddCandidateModal';
import { CandidateDetailSkeleton } from '@/components/candidates/CandidateDetailSkeleton';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/components/ui/utils';

// ─── 인터페이스 정의 ───────────────────────────────────────────
interface Candidate {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: 'pending' | 'in_progress' | 'confirmed' | 'rejected' | 'issue';
  current_stage_id: string | null;
  job_post_id: string;
  ai_score?: number | null;
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

// ─── 상태 색상 & 텍스트 매핑 (실제 DB status와 연동) ─────────────
const STATUS_CONFIG: Record<string, { label: string; dotColor: string; bgColor: string; textColor: string }> = {
  pending: {
    label: '대기중',
    dotColor: 'bg-amber-400',
    bgColor: 'bg-amber-50 border-amber-200/60',
    textColor: 'text-amber-700',
  },
  in_progress: {
    label: '진행중',
    dotColor: 'bg-blue-400',
    bgColor: 'bg-blue-50 border-blue-200/60',
    textColor: 'text-blue-700',
  },
  confirmed: {
    label: '확정',
    dotColor: 'bg-emerald-400',
    bgColor: 'bg-emerald-50 border-emerald-200/60',
    textColor: 'text-emerald-700',
  },
  rejected: {
    label: '거절',
    dotColor: 'bg-rose-400',
    bgColor: 'bg-rose-50 border-rose-200/60',
    textColor: 'text-rose-700',
  },
  issue: {
    label: '이슈',
    dotColor: 'bg-orange-400',
    bgColor: 'bg-orange-50 border-orange-200/60',
    textColor: 'text-orange-700',
  },
};

// ─── 메인 컴포넌트 ─────────────────────────────────────────────
export function CandidatesClient({ initialCandidates, stageCounts = {}, error }: CandidatesClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 기존 상태들
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStage, setSelectedStage] = useState<string>('all');
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [candidateDetail, setCandidateDetail] = useState<any>(null);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<any[]>([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [archiveFilter, setArchiveFilter] = useState<'active' | 'archived' | 'confirmed'>('active');
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [selectedCandidateForArchive, setSelectedCandidateForArchive] = useState<{ id: string; name: string } | null>(null);
  const [addCandidateModalOpen, setAddCandidateModalOpen] = useState(false);
  const [archivedCandidates, setArchivedCandidates] = useState<Candidate[]>([]);
  const [confirmedCandidates, setConfirmedCandidates] = useState<Candidate[]>([]);
  const [isLoadingArchived, setIsLoadingArchived] = useState(false);
  const [isLoadingConfirmed, setIsLoadingConfirmed] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [currentStageCounts, setCurrentStageCounts] = useState<Record<string, number>>(stageCounts);
  const [selectedArchiveReason, setSelectedArchiveReason] = useState<string>('all');

  // ─── 다중 선택(Bulk) 관련 상태 ──────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Bulk Action 모달 상태들
  const [bulkArchiveModalOpen, setBulkArchiveModalOpen] = useState(false);
  const [bulkArchiveReason, setBulkArchiveReason] = useState('');
  const [isBulkArchiving, setIsBulkArchiving] = useState(false);
  
  const [bulkMoveModalOpen, setBulkMoveModalOpen] = useState(false);
  const [bulkMoveTargetStage, setBulkMoveTargetStage] = useState('');
  const [isBulkMoving, setIsBulkMoving] = useState(false);
  
  const [bulkEmailModalOpen, setBulkEmailModalOpen] = useState(false);
  const [bulkEmailSubject, setBulkEmailSubject] = useState('');
  const [bulkEmailBody, setBulkEmailBody] = useState('');
  const [isBulkEmailing, setIsBulkEmailing] = useState(false);

  // 클라이언트 마운트 확인 (Hydration 에러 방지)
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 초기 마운트 시 stageCounts 설정
  useEffect(() => {
    if (isMounted && archiveFilter === 'active') {
      setCurrentStageCounts(stageCounts);
    }
  }, [isMounted, stageCounts]);

  // 필터 변경 시 해당 후보자 및 단계별 카운트 로드
  useEffect(() => {
    if (!isMounted) return;

    // 필터 변경 시 선택 초기화
    setSelectedIds(new Set());

    if (archiveFilter === 'archived') {
      loadArchivedCandidates();
      setCurrentStageCounts({});
      setSelectedArchiveReason('all');
    } else if (archiveFilter === 'confirmed') {
      loadConfirmedCandidates();
      setCurrentStageCounts({});
    } else {
      setCurrentStageCounts(stageCounts);
      setSelectedArchiveReason('all');
    }
  }, [archiveFilter, isMounted]);

  // 단계/검색 필터 변경 시 선택 초기화
  useEffect(() => {
    setSelectedIds(new Set());
  }, [selectedStage, searchQuery]);

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

  const loadConfirmedCandidates = async () => {
    setIsLoadingConfirmed(true);
    try {
      const result = await getConfirmedCandidates();
      if (result.error) {
        console.error('Failed to load confirmed candidates:', result.error);
      } else {
        setConfirmedCandidates(result.data || []);
      }
    } catch (error) {
      console.error('Load confirmed candidates error:', error);
    } finally {
      setIsLoadingConfirmed(false);
    }
  };

  // 아카이브된 후보자의 단계별 카운트 로드
  const loadArchivedStageCounts = async () => {
    try {
      const result = await getArchivedCandidatesByStage();
      if (result.error) {
        console.error('Failed to load archived stage counts:', result.error);
        setCurrentStageCounts({});
      } else {
        setCurrentStageCounts(result.data || {});
      }
    } catch (error) {
      console.error('Load archived stage counts error:', error);
      setCurrentStageCounts({});
    }
  };

  // URL query parameter에서 selected 값 읽기
  useEffect(() => {
    const selected = searchParams.get('selected');
    setSelectedCandidateId(selected);
    
    if (selected) {
      loadCandidateDetail(selected);
    } else {
      setCandidateDetail(null);
      setSchedules([]);
      setTimelineEvents([]);
    }
  }, [searchParams]);

  // Candidate detail 데이터 로드
  const loadCandidateDetail = async (candidateId: string) => {
    setIsLoadingDetail(true);
    setDetailError(null);
    
    const initialCandidate = initialCandidates.find(c => c.id === candidateId);
    if (initialCandidate) {
      setCandidateDetail({ ...initialCandidate });
    }
    
    try {
      const [candidateResult, schedulesResult, timelineResult] = await Promise.all([
        getCandidateById(candidateId),
        getSchedulesByCandidate(candidateId),
        getTimelineEvents(candidateId),
      ]);

      if (candidateResult.error || !candidateResult.data) {
        if (!initialCandidate) {
          setDetailError(candidateResult.error || '후보자를 찾을 수 없습니다.');
          setCandidateDetail(null);
        } else {
          setDetailError(null);
        }
      } else {
        setCandidateDetail(candidateResult.data);
        setSchedules(schedulesResult.data || []);
        setTimelineEvents(timelineResult.data || []);
        setDetailError(null);
      }
    } catch (err) {
      if (!initialCandidate) {
        setDetailError('후보자 정보를 불러오는 중 오류가 발생했습니다.');
        setCandidateDetail(null);
      } else {
        setDetailError(null);
        setSchedules([]);
        setTimelineEvents([]);
      }
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // ─── 단계 이름 매핑 ─────────────────────────────────────────
  const getStageName = (stageId: string | null): string => {
    if (!stageId) return 'New Application';
    const mappedName = getStageNameByStageId(stageId);
    if (mappedName) return mappedName;
    const stageNames = [
      'New Application', 'Application Review', 'Competency Assessment',
      'Technical Test', '1st Interview', 'Reference Check', '2nd Interview',
    ];
    if (stageNames.includes(stageId)) return stageId;
    return 'New Application';
  };

  // ─── 필터링 ─────────────────────────────────────────────────
  const candidatesToFilter = 
    archiveFilter === 'archived' ? archivedCandidates :
    archiveFilter === 'confirmed' ? confirmedCandidates :
    initialCandidates;

  const filteredCandidates = candidatesToFilter.filter(candidate => {
    if (archiveFilter === 'archived' && selectedArchiveReason !== 'all') {
      if ((candidate as any).archive_reason !== selectedArchiveReason) return false;
    }
    if (archiveFilter === 'active' && selectedStage !== 'all') {
      const candidateStage = getStageName(candidate.current_stage_id);
      const selectedStageName = getStageNameById(selectedStage);
      if (!candidateStage || !selectedStageName || candidateStage !== selectedStageName) return false;
    }
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      candidate.name.toLowerCase().includes(query) ||
      candidate.email.toLowerCase().includes(query) ||
      candidate.job_posts?.title.toLowerCase().includes(query) ||
      candidate.parsed_data?.skills?.some(skill => skill.toLowerCase().includes(query))
    );
  });

  // ─── 상태 관련 유틸 ─────────────────────────────────────────
  const getStatusConfig = (status: string) => {
    return STATUS_CONFIG[status] || { label: status, dotColor: 'bg-slate-400', bgColor: 'bg-slate-50 border-slate-200/60', textColor: 'text-slate-700' };
  };

  // ─── 전체 활성 후보자 수 계산 ───────────────────────────────
  const activeCandidatesCount = isMounted && archiveFilter === 'archived'
    ? archivedCandidates.length 
    : isMounted && archiveFilter === 'confirmed'
    ? confirmedCandidates.length
    : initialCandidates.length;

  // ─── 클릭 핸들러 ───────────────────────────────────────────
  const handleCandidateClick = (candidateId: string) => {
    router.push(`/candidates?selected=${candidateId}`);
  };

  const handleCloseDetail = () => {
    router.push('/candidates');
  };

  // ─── 다중 선택 핸들러 ──────────────────────────────────────
  // 개별 체크박스 토글
  const toggleSelect = useCallback((candidateId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(candidateId)) {
        next.delete(candidateId);
      } else {
        next.add(candidateId);
      }
      return next;
    });
  }, []);

  // 전체 선택 / 해제
  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredCandidates.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredCandidates.map(c => c.id)));
    }
  }, [selectedIds.size, filteredCandidates]);

  // 선택 해제
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // 선택된 후보자 정보
  const selectedCandidates = filteredCandidates.filter(c => selectedIds.has(c.id));
  const isAllSelected = filteredCandidates.length > 0 && selectedIds.size === filteredCandidates.length;
  const isSomeSelected = selectedIds.size > 0;

  // ─── Bulk Action 핸들러 ────────────────────────────────────
  // 일괄 아카이브
  const handleBulkArchive = async () => {
    if (!bulkArchiveReason) {
      toast.error('아카이브 사유를 선택해주세요.');
      return;
    }
    setIsBulkArchiving(true);
    try {
      const result = await bulkArchiveCandidates(Array.from(selectedIds), bulkArchiveReason);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`${result.data?.count || selectedIds.size}명의 후보자가 아카이브되었습니다.`);
        setBulkArchiveModalOpen(false);
        setBulkArchiveReason('');
        clearSelection();
        router.refresh();
      }
    } catch (error) {
      toast.error('일괄 아카이브 처리 중 오류가 발생했습니다.');
      console.error('Bulk archive error:', error);
    } finally {
      setIsBulkArchiving(false);
    }
  };

  // 일괄 전형 이동
  const handleBulkMove = async () => {
    if (!bulkMoveTargetStage) {
      toast.error('이동할 전형 단계를 선택해주세요.');
      return;
    }
    setIsBulkMoving(true);
    try {
      const result = await bulkMoveToStage(Array.from(selectedIds), bulkMoveTargetStage);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`${result.data?.count || selectedIds.size}명의 후보자가 ${result.data?.targetStageName || ''}(으)로 이동되었습니다.`);
        setBulkMoveModalOpen(false);
        setBulkMoveTargetStage('');
        clearSelection();
        router.refresh();
      }
    } catch (error) {
      toast.error('일괄 전형 이동 중 오류가 발생했습니다.');
      console.error('Bulk move error:', error);
    } finally {
      setIsBulkMoving(false);
    }
  };

  // 일괄 이메일 발송
  const handleBulkEmail = async () => {
    if (!bulkEmailSubject || !bulkEmailBody) {
      toast.error('제목과 내용을 모두 입력해주세요.');
      return;
    }
    setIsBulkEmailing(true);
    try {
      let successCount = 0;
      let failCount = 0;

      // 각 후보자에게 개별 이메일 발송 (순차적으로)
      for (const candidate of selectedCandidates) {
        try {
          const formData = new FormData();
          formData.append('candidate_id', candidate.id);
          formData.append('to_email', candidate.email);
          formData.append('subject', bulkEmailSubject);
          formData.append('body', bulkEmailBody);

          const result = await sendEmailToCandidate(formData);
          if (result.error) {
            failCount++;
            console.error(`이메일 발송 실패 (${candidate.name}):`, result.error);
          } else {
            successCount++;
          }
        } catch (err) {
          failCount++;
          console.error(`이메일 발송 오류 (${candidate.name}):`, err);
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount}명에게 이메일이 발송되었습니다.`);
      }
      if (failCount > 0) {
        toast.error(`${failCount}명에게 이메일 발송에 실패했습니다.`);
      }

      setBulkEmailModalOpen(false);
      setBulkEmailSubject('');
      setBulkEmailBody('');
      clearSelection();
      router.refresh();
    } catch (error) {
      toast.error('일괄 이메일 발송 중 오류가 발생했습니다.');
      console.error('Bulk email error:', error);
    } finally {
      setIsBulkEmailing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-6">
      {/* 메인 콘텐츠 영역 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-foreground" />
            <h1 className="text-3xl font-bold text-foreground">Candidates</h1>
            <span className="bg-blue-50 text-[#5287FF] rounded-full px-3 py-1 text-sm font-medium">
              {archiveFilter === 'archived' 
                ? `${activeCandidatesCount} archived candidates`
                : archiveFilter === 'confirmed'
                ? `${activeCandidatesCount} confirmed candidates`
                : `${activeCandidatesCount} active candidates`}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {/* 필터 버튼 그룹 */}
            <div className="flex gap-2">
              <Button
                onClick={() => setArchiveFilter('active')}
                variant="outline"
                className={`h-10 px-4 border-slate-200 text-slate-600 hover:bg-slate-50 ${
                  archiveFilter === 'active' ? 'bg-slate-50 border-slate-300' : ''
                }`}
              >
                Active
              </Button>
              <Button
                onClick={() => setArchiveFilter('archived')}
                variant="outline"
                className={`h-10 px-4 border-slate-200 text-slate-600 hover:bg-slate-50 ${
                  archiveFilter === 'archived' ? 'bg-slate-50 border-slate-300' : ''
                }`}
              >
                Archived
              </Button>
              <Button
                onClick={() => setArchiveFilter('confirmed')}
                variant="outline"
                className={`h-10 px-4 border-slate-200 text-slate-600 hover:bg-slate-50 ${
                  archiveFilter === 'confirmed' ? 'bg-slate-50 border-slate-300' : ''
                }`}
              >
                입사확정
              </Button>
            </div>
            {/* 후보자 추가 버튼 */}
            <Button
              onClick={() => setAddCandidateModalOpen(true)}
              className="h-10 bg-gradient-to-r from-[#0248FF] to-[#5287FF] hover:from-[#0248FF]/90 hover:to-[#5287FF]/90 text-white border-0"
            >
              <Users className="w-4 h-4 mr-2" />
              Add Candidate
            </Button>
          </div>
        </div>

        {/* Stage Filters */}
        {archiveFilter === 'active' && (
          <div className="mb-6 overflow-x-auto">
            <div className="bg-slate-100 p-1 rounded-lg inline-flex gap-1 min-w-max">
              {RECRUITMENT_STAGES.map((stage) => {
                const count = stage.id === 'all' 
                  ? activeCandidatesCount 
                  : (currentStageCounts[stage.name] || 0);
                const isSelected = selectedStage === stage.id;
                
                return (
                  <button
                    key={stage.id}
                    onClick={() => setSelectedStage(stage.id)}
                    className={`
                      px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-all
                      ${isSelected
                        ? 'bg-white shadow-sm text-foreground'
                        : 'text-slate-600 hover:bg-slate-50/50'
                      }
                    `}
                  >
                    {stage.label}
                    {count > 0 && (
                      <span className={`ml-2 ${isSelected ? 'text-foreground' : 'text-slate-500'}`}>
                        ({count})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Archive Reason Filters */}
        {archiveFilter === 'archived' && (
          <div className="mb-6 overflow-x-auto">
            <div className="bg-slate-100 p-1 rounded-lg inline-flex gap-1 min-w-max">
              <button
                onClick={() => setSelectedArchiveReason('all')}
                className={`
                  px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-all
                  ${selectedArchiveReason === 'all'
                    ? 'bg-white shadow-sm text-foreground'
                    : 'text-slate-600 hover:bg-slate-50/50'
                  }
                `}
              >
                All Reasons
                {activeCandidatesCount > 0 && (
                  <span className={`ml-2 ${selectedArchiveReason === 'all' ? 'text-foreground' : 'text-slate-500'}`}>
                    ({activeCandidatesCount})
                  </span>
                )}
              </button>
              {ARCHIVE_REASONS.map((reason) => {
                const count = archivedCandidates.filter(c => (c as any).archive_reason === reason.id).length;
                const isSelected = selectedArchiveReason === reason.id;
                
                return (
                  <button
                    key={reason.id}
                    onClick={() => setSelectedArchiveReason(reason.id)}
                    className={`
                      px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-all
                      ${isSelected
                        ? 'bg-white shadow-sm text-foreground'
                        : 'text-slate-600 hover:bg-slate-50/50'
                      }
                    `}
                  >
                    {reason.label}
                    {count > 0 && (
                      <span className={`ml-2 ${isSelected ? 'text-foreground' : 'text-slate-500'}`}>
                        ({count})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive">
            {error}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            Floating Bulk Action Bar
            Notion / Linear 스타일 하단 Floating 바
           ══════════════════════════════════════════════════════════ */}
        {isSomeSelected && (
          <div className="fixed bottom-6 left-1/2 z-50 bulk-action-bar-enter">
            <div className="flex items-center gap-2 bg-slate-900 text-white rounded-xl px-4 py-2.5 shadow-2xl shadow-slate-900/30 border border-slate-700">
              {/* 선택 카운트 & 해제 */}
              <div className="flex items-center gap-2 pr-3 border-r border-slate-700">
                <div className="w-6 h-6 rounded-md bg-[#5287FF] flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-sm font-medium whitespace-nowrap">{selectedIds.size}명 선택</span>
                <button
                  onClick={clearSelection}
                  className="ml-1 p-1 rounded-md hover:bg-slate-700 transition-colors"
                  title="선택 해제"
                >
                  <X className="w-3.5 h-3.5 text-slate-400" />
                </button>
              </div>

              {/* 액션 버튼들 */}
              <div className="flex items-center gap-1.5 pl-1">
                {/* 전형 이동 */}
                <button
                  onClick={() => setBulkMoveModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors whitespace-nowrap"
                >
                  <ArrowRightCircle className="w-4 h-4 text-violet-400" />
                  전형 이동
                </button>

                {/* 이메일 */}
                <button
                  onClick={() => setBulkEmailModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors whitespace-nowrap"
                >
                  <Mail className="w-4 h-4 text-sky-400" />
                  이메일
                </button>

                {/* 아카이브 */}
                <button
                  onClick={() => setBulkArchiveModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors whitespace-nowrap"
                >
                  <Archive className="w-4 h-4 text-orange-400" />
                  아카이브
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Candidates List */}
        {(isLoadingArchived && archiveFilter === 'archived') || (isLoadingConfirmed && archiveFilter === 'confirmed') ? (
          <div className="p-12 text-center bg-slate-50 rounded-xl">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#5287FF] mx-auto mb-4"></div>
            <p className="text-muted-foreground">후보자를 불러오는 중...</p>
          </div>
        ) : filteredCandidates.length === 0 ? (
          <div className="p-12 text-center bg-slate-50 rounded-xl">
            <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center mx-auto mb-4">
              <Users className="text-slate-400" size={32} />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">후보자가 없습니다</h2>
            <p className="text-muted-foreground mb-6">
              {searchQuery ? '검색 결과가 없습니다.' : '아직 등록된 후보자가 없습니다.'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => router.push('/jobs')}
                className="px-6 py-3 bg-gradient-to-r from-[#0248FF] to-[#5287FF] text-white rounded-xl font-medium hover:from-[#0248FF]/90 hover:to-[#5287FF]/90 transition-colors"
              >
                채용 공고 보기
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-hidden border border-slate-200 rounded-xl">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {/* 체크박스 컬럼 */}
                    <th className="w-12 px-4 py-4">
                      <button
                        onClick={toggleSelectAll}
                        className={cn(
                          "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-150",
                          isAllSelected
                            ? "bg-[#5287FF] border-[#5287FF]"
                            : isSomeSelected
                            ? "bg-[#5287FF]/20 border-[#5287FF]"
                            : "border-slate-300 hover:border-slate-400"
                        )}
                      >
                        {isAllSelected && <Check className="w-3 h-3 text-white" />}
                        {!isAllSelected && isSomeSelected && (
                          <div className="w-2 h-0.5 bg-[#5287FF] rounded-full" />
                        )}
                      </button>
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">CANDIDATE</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">POSITION</th>
                    {selectedStage === 'all' && (
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">STAGE</th>
                    )}
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">MATCH</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">APPLIED</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">STATUS</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCandidates.map((candidate) => {
                    const stageName = getStageName(candidate.current_stage_id);
                    const matchScore = candidate.ai_score ?? 0;
                    const isChecked = selectedIds.has(candidate.id);
                    const statusCfg = getStatusConfig(candidate.status);
                    
                    return (
                      <tr
                        key={candidate.id}
                        onClick={() => handleCandidateClick(candidate.id)}
                        className={cn(
                          "cursor-pointer transition-colors border-b border-slate-100/50",
                          isChecked 
                            ? "bg-blue-50/60 hover:bg-blue-50/80" 
                            : "hover:bg-blue-50/40",
                          selectedCandidateId === candidate.id && "bg-blue-50/30"
                        )}
                      >
                        {/* 체크박스 */}
                        <td className="w-12 px-4 py-4">
                          <button
                            onClick={(e) => toggleSelect(candidate.id, e)}
                            className={cn(
                              "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-150",
                              isChecked 
                                ? "bg-[#5287FF] border-[#5287FF]"
                                : "border-slate-300 hover:border-[#5287FF]"
                            )}
                          >
                            {isChecked && <Check className="w-3 h-3 text-white" />}
                          </button>
                        </td>

                        {/* CANDIDATE */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-50 text-[#5287FF] font-medium flex items-center justify-center flex-shrink-0">
                              {candidate.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium text-foreground truncate">{candidate.name}</div>
                              <div className="text-sm text-muted-foreground truncate">{candidate.email}</div>
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

                        {/* STAGE */}
                        {selectedStage === 'all' && (
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                              {stageName}
                            </span>
                          </td>
                        )}

                        {/* MATCH */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {matchScore > 0 ? (
                              <>
                                <div className="flex-1 bg-slate-100 rounded-full h-2 max-w-[100px]">
                                  <div 
                                    className="bg-gradient-to-r from-[#0248FF] to-[#5287FF] h-2 rounded-full transition-all"
                                    style={{ width: `${matchScore}%` }}
                                  />
                                </div>
                                <span className="text-sm font-semibold text-foreground">{matchScore}</span>
                              </>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </div>
                        </td>

                        {/* APPLIED */}
                        <td className="px-6 py-4">
                          <div className="text-sm text-muted-foreground">
                            {new Date(candidate.created_at).toISOString().split('T')[0]}
                          </div>
                        </td>

                        {/* STATUS - 실제 DB 데이터 기반 상태 배지 (Dot 스타일) */}
                        <td className="px-6 py-4">
                          <span className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border",
                            statusCfg.bgColor,
                            statusCfg.textColor,
                          )}>
                            <span className={cn("w-1.5 h-1.5 rounded-full", statusCfg.dotColor)} />
                            {statusCfg.label}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {getStageNameByStageId(candidate.current_stage_id) === 'Offer' && (
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (!confirm('입사 확정 처리하시겠습니까? 입사 확정된 후보자는 입사확정 필터에서 조회할 수 있습니다.')) {
                                    return;
                                  }
                                  try {
                                    const result = await confirmHire(candidate.id);
                                    if (result.error) {
                                      toast.error(result.error);
                                    } else {
                                      toast.success('입사 확정 처리되었습니다.');
                                      router.refresh();
                                    }
                                  } catch (error) {
                                    toast.error('입사 확정 처리 중 오류가 발생했습니다.');
                                    console.error('Confirm hire error:', error);
                                  }
                                }}
                                className="p-1.5 hover:bg-green-100 rounded-lg transition-colors"
                                title="입사 확정"
                              >
                                <CheckCircle2 size={16} className="text-green-600" />
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCandidateForArchive({ id: candidate.id, name: candidate.name });
                                setArchiveModalOpen(true);
                              }}
                              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                              title="아카이브"
                            >
                              <Archive size={16} className="text-slate-400" />
                            </button>
                          </div>
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
          <div className="mt-4 text-sm text-slate-600">
            총 {filteredCandidates.length}명의 후보자
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════
          모달: Candidate Detail
         ══════════════════════════════════════════════════════════ */}
      <Dialog open={!!selectedCandidateId} onOpenChange={(open) => {
        if (!open) handleCloseDetail();
      }}>
        <DialogContent 
          className="!w-[95vw] !max-w-5xl !max-h-[90vh] p-0 overflow-hidden rounded-3xl shadow-2xl bg-slate-50/80 backdrop-blur-2xl [&>button]:hidden"
        >
          <DialogTitle className="sr-only">
            {candidateDetail ? `${candidateDetail.name} 상세 정보` : '후보자 상세 정보'}
          </DialogTitle>
          <div className="h-full overflow-hidden">
            {isLoadingDetail ? (
              <CandidateDetailSkeleton />
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
                isSidebar={false}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════════
          모달: 개별 아카이브
         ══════════════════════════════════════════════════════════ */}
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

      {/* ══════════════════════════════════════════════════════════
          모달: 후보자 추가
         ══════════════════════════════════════════════════════════ */}
      <AddCandidateModal
        isOpen={addCandidateModalOpen}
        onClose={() => {
          setAddCandidateModalOpen(false);
          router.refresh();
        }}
      />

      {/* ══════════════════════════════════════════════════════════
          Bulk 모달: 일괄 아카이브
         ══════════════════════════════════════════════════════════ */}
      <Dialog open={bulkArchiveModalOpen} onOpenChange={setBulkArchiveModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Archive className="w-5 h-5 text-orange-600" />
              일괄 아카이브
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* 선택된 후보자 미리보기 */}
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
              <p className="text-xs text-slate-500 mb-2 font-medium">선택된 후보자 ({selectedIds.size}명)</p>
              <div className="flex flex-wrap gap-1.5">
                {selectedCandidates.slice(0, 8).map(c => (
                  <span key={c.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-white rounded-md text-xs font-medium text-slate-700 border border-slate-200">
                    <span className="w-4 h-4 rounded-full bg-blue-50 text-[#5287FF] text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                      {c.name.charAt(0)}
                    </span>
                    {c.name}
                  </span>
                ))}
                {selectedCandidates.length > 8 && (
                  <span className="text-xs text-slate-500 px-2 py-0.5">+{selectedCandidates.length - 8}명</span>
                )}
              </div>
            </div>

            <p className="text-xs text-slate-500">
              아카이브된 후보자는 기본 목록에서 제외되지만, 필터를 통해 조회할 수 있습니다.
            </p>

            {/* 아카이브 사유 선택 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                아카이브 사유 <span className="text-red-500">*</span>
              </label>
              <select
                value={bulkArchiveReason}
                onChange={(e) => setBulkArchiveReason(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#5287FF]/30 focus:border-[#5287FF] transition-all"
              >
                <option value="">사유를 선택하세요</option>
                {ARCHIVE_REASONS.map((reason) => (
                  <option key={reason.id} value={reason.id}>
                    {reason.label}
                  </option>
                ))}
              </select>
              {bulkArchiveReason && (
                <p className="mt-1.5 text-xs text-slate-500">
                  {ARCHIVE_REASONS.find(r => r.id === bulkArchiveReason)?.description}
                </p>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => { setBulkArchiveModalOpen(false); setBulkArchiveReason(''); }}
              disabled={isBulkArchiving}
            >
              취소
            </Button>
            <Button
              onClick={handleBulkArchive}
              disabled={isBulkArchiving || !bulkArchiveReason}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {isBulkArchiving ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />처리 중...</>
              ) : (
                <><Archive className="w-4 h-4 mr-2" />{selectedIds.size}명 아카이브</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════════
          Bulk 모달: 일괄 전형 이동
         ══════════════════════════════════════════════════════════ */}
      <Dialog open={bulkMoveModalOpen} onOpenChange={setBulkMoveModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightCircle className="w-5 h-5 text-violet-600" />
              일괄 전형 이동
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* 선택된 후보자 미리보기 */}
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
              <p className="text-xs text-slate-500 mb-2 font-medium">선택된 후보자 ({selectedIds.size}명)</p>
              <div className="flex flex-wrap gap-1.5">
                {selectedCandidates.slice(0, 8).map(c => (
                  <span key={c.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-white rounded-md text-xs font-medium text-slate-700 border border-slate-200">
                    <span className="w-4 h-4 rounded-full bg-blue-50 text-[#5287FF] text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                      {c.name.charAt(0)}
                    </span>
                    {c.name}
                  </span>
                ))}
                {selectedCandidates.length > 8 && (
                  <span className="text-xs text-slate-500 px-2 py-0.5">+{selectedCandidates.length - 8}명</span>
                )}
              </div>
            </div>

            {/* 이동할 전형 단계 선택 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                이동할 전형 단계 <span className="text-red-500">*</span>
              </label>
              <div className="space-y-1.5">
                {Object.entries(STAGE_ID_TO_NAME_MAP).map(([stageId, stageName]) => {
                  const isSelected = bulkMoveTargetStage === stageId;
                  return (
                    <button
                      key={stageId}
                      type="button"
                      onClick={() => setBulkMoveTargetStage(stageId)}
                      className={cn(
                        "w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-all border",
                        isSelected
                          ? "bg-[#5287FF]/10 border-[#5287FF]/30 text-[#5287FF] ring-1 ring-[#5287FF]/20"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span>{stageName}</span>
                        {isSelected && <Check className="w-4 h-4 text-[#5287FF]" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => { setBulkMoveModalOpen(false); setBulkMoveTargetStage(''); }}
              disabled={isBulkMoving}
            >
              취소
            </Button>
            <Button
              onClick={handleBulkMove}
              disabled={isBulkMoving || !bulkMoveTargetStage}
              className="bg-gradient-to-r from-[#0248FF] to-[#5287FF] hover:from-[#0248FF]/90 hover:to-[#5287FF]/90 text-white"
            >
              {isBulkMoving ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />이동 중...</>
              ) : (
                <><ArrowRightCircle className="w-4 h-4 mr-2" />{selectedIds.size}명 이동</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════════
          Bulk 모달: 일괄 이메일 발송
         ══════════════════════════════════════════════════════════ */}
      <Dialog open={bulkEmailModalOpen} onOpenChange={setBulkEmailModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-sky-600" />
              일괄 이메일 발송
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* 수신자 미리보기 */}
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
              <p className="text-xs text-slate-500 mb-2 font-medium">수신자 ({selectedIds.size}명)</p>
              <div className="flex flex-wrap gap-1.5">
                {selectedCandidates.slice(0, 6).map(c => (
                  <span key={c.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-white rounded-md text-xs font-medium text-slate-700 border border-slate-200">
                    <span className="w-4 h-4 rounded-full bg-blue-50 text-[#5287FF] text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                      {c.name.charAt(0)}
                    </span>
                    {c.name}
                    <span className="text-slate-400 text-[10px]">{c.email}</span>
                  </span>
                ))}
                {selectedCandidates.length > 6 && (
                  <span className="text-xs text-slate-500 px-2 py-0.5">+{selectedCandidates.length - 6}명</span>
                )}
              </div>
            </div>

            {/* 제목 */}
            <div>
              <label htmlFor="bulk-email-subject" className="block text-sm font-medium text-slate-700 mb-1.5">
                제목 <span className="text-red-500">*</span>
              </label>
              <input
                id="bulk-email-subject"
                type="text"
                value={bulkEmailSubject}
                onChange={(e) => setBulkEmailSubject(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#5287FF]/30 focus:border-[#5287FF] transition-all"
                placeholder="이메일 제목을 입력하세요"
              />
            </div>

            {/* 내용 */}
            <div>
              <label htmlFor="bulk-email-body" className="block text-sm font-medium text-slate-700 mb-1.5">
                내용 <span className="text-red-500">*</span>
              </label>
              <textarea
                id="bulk-email-body"
                value={bulkEmailBody}
                onChange={(e) => setBulkEmailBody(e.target.value)}
                rows={8}
                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#5287FF]/30 focus:border-[#5287FF] transition-all resize-none"
                placeholder="이메일 내용을 입력하세요"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => { setBulkEmailModalOpen(false); setBulkEmailSubject(''); setBulkEmailBody(''); }}
              disabled={isBulkEmailing}
            >
              취소
            </Button>
            <Button
              onClick={handleBulkEmail}
              disabled={isBulkEmailing || !bulkEmailSubject || !bulkEmailBody}
              className="bg-gradient-to-r from-[#0248FF] to-[#5287FF] hover:from-[#0248FF]/90 hover:to-[#5287FF]/90 text-white"
            >
              {isBulkEmailing ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />발송 중...</>
              ) : (
                <><Mail className="w-4 h-4 mr-2" />{selectedIds.size}명에게 발송</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
