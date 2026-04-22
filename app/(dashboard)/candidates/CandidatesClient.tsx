"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getStageNameByStageId, getStageNameById } from "@/constants/stages";
import { CANDIDATE_STATUS_CONFIG } from "@/constants/candidates";
import {
  getArchivedCandidates,
  getConfirmedCandidates,
} from "@/api/queries/candidates";
import { getCandidateDetailBundle } from "@/api/queries/candidate-detail-bundle";
import { confirmHire } from "@/api/actions/offers";
import { sendEmailToCandidate } from "@/api/actions/emails";
import {
  bulkArchiveCandidates,
  bulkMoveToStage,
} from "@/api/actions/candidates-archive";
import { toast } from "sonner";
import type { Candidate, CandidateWithArchiveReason } from "@/types/candidates";
import { ArchiveCandidateModal } from "@/components/candidates/ArchiveCandidateModal";
import { AddCandidateModal } from "@/components/candidates/AddCandidateModal";
import { CandidateDetailDialog } from "@/components/candidates/CandidateDetailDialog";
import { BulkArchiveModal } from "@/components/candidates/BulkArchiveModal";
import { BulkMoveModal } from "@/components/candidates/BulkMoveModal";
import { BulkEmailModal } from "@/components/candidates/BulkEmailModal";
import { CandidatesHeader } from "@/components/candidates/CandidatesHeader";
import { StageFilters } from "@/components/candidates/StageFilters";
import { ArchiveReasonFilters } from "@/components/candidates/ArchiveReasonFilters";
import { BulkActionBar } from "@/components/candidates/BulkActionBar";
import { CandidatesTable } from "@/components/candidates/CandidatesTable";
import { CandidatesEmptyState } from "@/components/candidates/CandidatesEmptyState";
import { CandidatesTableLoading } from "@/components/candidates/CandidatesTableLoading";
import { Search, ChevronDown, RotateCcw } from "lucide-react";
import { cn } from "@/components/ui/utils";

// ─── Props ─────────────────────────────────────────────────────
interface CandidatesClientProps {
  initialCandidates: Candidate[];
  stageCounts?: Record<string, number>;
  error?: string;
}

// ─── 메인 컴포넌트 ─────────────────────────────────────────────
export function CandidatesClient({
  initialCandidates,
  stageCounts = {},
  error,
}: CandidatesClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const openedFromListRef = useRef(false);
  const lastLoadedCandidateIdRef = useRef<string | null>(null);
  const detailBundleCacheRef = useRef<
    Map<
      string,
      {
        at: number;
        candidate: Candidate;
        schedules: unknown[];
        timelineEvents: unknown[];
      }
    >
  >(new Map());

  // 목록/필터 상태
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStage, setSelectedStage] = useState<string>("all");
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(
    null,
  );
  const [archiveFilter, setArchiveFilter] = useState<
    "active" | "archived" | "confirmed"
  >("active");
  const [selectedArchiveReason, setSelectedArchiveReason] =
    useState<string>("all");

  // Smart Filter Bar 상태 (포지션/경력/접수일)
  const [positionFilter, setPositionFilter] = useState<string>("all");
  const [experienceFilter, setExperienceFilter] = useState<string>("all");
  const [appliedFrom, setAppliedFrom] = useState<string>("");
  const [appliedTo, setAppliedTo] = useState<string>("");

  const [openFilter, setOpenFilter] = useState<
    null | "position" | "experience" | "applied"
  >(null);
  const filterBarRef = useRef<HTMLDivElement | null>(null);

  // 상세 패널(모달) 상태
  const [candidateDetail, setCandidateDetail] = useState<Candidate | null>(
    null,
  );
  const [schedules, setSchedules] = useState<unknown[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<unknown[]>([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // 아카이브/입사확정 목록
  const [archivedCandidates, setArchivedCandidates] = useState<Candidate[]>(
    [],
  );
  const [confirmedCandidates, setConfirmedCandidates] = useState<Candidate[]>(
    [],
  );
  const [isLoadingArchived, setIsLoadingArchived] = useState(false);
  const [isLoadingConfirmed, setIsLoadingConfirmed] = useState(false);

  const [isMounted, setIsMounted] = useState(false);
  const [currentStageCounts, setCurrentStageCounts] =
    useState<Record<string, number>>(stageCounts);

  // 개별 아카이브 / 후보자 추가 모달
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [selectedCandidateForArchive, setSelectedCandidateForArchive] =
    useState<{ id: string; name: string } | null>(null);
  const [addCandidateModalOpen, setAddCandidateModalOpen] = useState(false);

  // Bulk 선택 및 모달
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkArchiveModalOpen, setBulkArchiveModalOpen] = useState(false);
  const [bulkArchiveReason, setBulkArchiveReason] = useState("");
  const [isBulkArchiving, setIsBulkArchiving] = useState(false);
  const [bulkMoveModalOpen, setBulkMoveModalOpen] = useState(false);
  const [bulkMoveTargetStage, setBulkMoveTargetStage] = useState("");
  const [isBulkMoving, setIsBulkMoving] = useState(false);
  const [bulkEmailModalOpen, setBulkEmailModalOpen] = useState(false);
  const [bulkEmailSubject, setBulkEmailSubject] = useState("");
  const [bulkEmailBody, setBulkEmailBody] = useState("");
  const [isBulkEmailing, setIsBulkEmailing] = useState(false);
  const isAnyBulkModalOpen =
    bulkArchiveModalOpen || bulkMoveModalOpen || bulkEmailModalOpen;

  // Hydration 방지
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted && archiveFilter === "active") {
      setCurrentStageCounts(stageCounts);
    }
  }, [isMounted, stageCounts, archiveFilter]);

  // 필터 변경 시 아카이브/입사확정 목록 로드 및 선택 초기화
  useEffect(() => {
    if (!isMounted) return;
    setSelectedIds(new Set());
    if (archiveFilter === "archived") {
      loadArchivedCandidates();
      setCurrentStageCounts({});
      setSelectedArchiveReason("all");
    } else if (archiveFilter === "confirmed") {
      loadConfirmedCandidates();
      setCurrentStageCounts({});
    } else {
      setCurrentStageCounts(stageCounts);
      setSelectedArchiveReason("all");
    }
  }, [archiveFilter, isMounted]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [selectedStage, searchQuery, positionFilter, experienceFilter, appliedFrom, appliedTo]);

  // Smart Filter Bar: 바깥 클릭 시 드롭다운 닫기
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (!filterBarRef.current) return;
      if (!filterBarRef.current.contains(e.target as Node)) {
        setOpenFilter(null);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const loadArchivedCandidates = async () => {
    setIsLoadingArchived(true);
    try {
      const result = await getArchivedCandidates();
      if (result.error) {
        console.error("Failed to load archived candidates:", result.error);
      } else {
        setArchivedCandidates(result.data || []);
      }
    } catch (err) {
      console.error("Load archived candidates error:", err);
    } finally {
      setIsLoadingArchived(false);
    }
  };

  const loadConfirmedCandidates = async () => {
    setIsLoadingConfirmed(true);
    try {
      const result = await getConfirmedCandidates();
      if (result.error) {
        console.error("Failed to load confirmed candidates:", result.error);
      } else {
        setConfirmedCandidates(result.data || []);
      }
    } catch (err) {
      console.error("Load confirmed candidates error:", err);
    } finally {
      setIsLoadingConfirmed(false);
    }
  };

  // URL selected 쿼리와 상세 로드
  useEffect(() => {
    const selected = searchParams.get("selected");
    setSelectedCandidateId(selected);
    if (selected) {
      // ✅ URL이 바뀐 경우에만 상세를 다시 로드합니다.
      // - 리스트 클릭 시에는 클릭 핸들러에서 이미 로드를 시작했을 수 있습니다.
      if (lastLoadedCandidateIdRef.current !== selected) {
        lastLoadedCandidateIdRef.current = selected;
        loadCandidateDetail(selected);
      }
    } else {
      lastLoadedCandidateIdRef.current = null;
      setCandidateDetail(null);
      setSchedules([]);
      setTimelineEvents([]);
    }
  }, [searchParams]);

  const loadCandidateDetail = async (candidateId: string) => {
    setIsLoadingDetail(true);
    setDetailError(null);
    const initialCandidate = initialCandidates.find((c) => c.id === candidateId);
    if (initialCandidate) {
      setCandidateDetail({ ...initialCandidate });
    }
    try {
      // ✅ 체감 속도 개선(짧은 캐시): 같은 후보자를 다시 열 때는 30초 동안 상세 번들을 재사용합니다.
      const cached = detailBundleCacheRef.current.get(candidateId);
      const now = Date.now();
      if (cached && now - cached.at <= 30_000) {
        setCandidateDetail(cached.candidate);
        setSchedules(cached.schedules || []);
        setTimelineEvents(cached.timelineEvents || []);
        setDetailError(null);
        return;
      }

      // ✅ 상세 데이터는 서버에서 한 번에 번들로 가져와 네트워크 요청 수를 줄입니다.
      // - 타임라인은 기본적으로 포함하지 않고(빈 배열), 탭 진입 시 로드합니다.
      const bundleResult = await getCandidateDetailBundle(candidateId);

      if (bundleResult.error || !bundleResult.data?.candidate) {
        if (!initialCandidate) {
          setDetailError(
            bundleResult.error || "후보자를 찾을 수 없습니다.",
          );
          setCandidateDetail(null);
        } else {
          setDetailError(null);
        }
      } else {
        setCandidateDetail(bundleResult.data.candidate);
        setSchedules(bundleResult.data.schedules || []);
        setTimelineEvents(bundleResult.data.timelineEvents || []);
        setDetailError(null);

        // ✅ 짧은 캐시 저장
        detailBundleCacheRef.current.set(candidateId, {
          at: Date.now(),
          candidate: bundleResult.data.candidate,
          schedules: bundleResult.data.schedules || [],
          timelineEvents: bundleResult.data.timelineEvents || [],
        });
      }
    } catch (err) {
      if (!initialCandidate) {
        setDetailError("후보자 정보를 불러오는 중 오류가 발생했습니다.");
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

  const getStageName = useCallback((stageId: string | null): string => {
    if (!stageId) return "New Application";
    const mappedName = getStageNameByStageId(stageId);
    if (mappedName) return mappedName;
    const stageNames = [
      "New Application",
      "Application Review",
      "Competency Assessment",
      "Technical Test",
      "1st Interview",
      "Reference Check",
      "2nd Interview",
    ];
    if (stageNames.includes(stageId)) return stageId;
    return "New Application";
  }, []);

  const candidatesToFilter =
    archiveFilter === "archived"
      ? archivedCandidates
      : archiveFilter === "confirmed"
        ? confirmedCandidates
        : initialCandidates;

  const positionOptions = useMemo(() => {
    const titles = new Set<string>();
    for (const c of candidatesToFilter) {
      const title = c.job_posts?.title?.trim();
      if (title) titles.add(title);
    }
    return Array.from(titles).sort((a, b) => a.localeCompare(b));
  }, [candidatesToFilter]);

  const experienceOptions = useMemo(() => {
    const values = new Set<string>();
    for (const c of candidatesToFilter) {
      const exp = (c.experience || c.parsed_data?.experience || "").trim();
      if (exp) values.add(exp);
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [candidatesToFilter]);

  const filteredCandidates = candidatesToFilter.filter((candidate) => {
    if (archiveFilter === "archived" && selectedArchiveReason !== "all") {
      if ((candidate as CandidateWithArchiveReason).archive_reason !== selectedArchiveReason)
        return false;
    }
    if (archiveFilter === "active" && selectedStage !== "all") {
      const candidateStage = getStageName(candidate.current_stage_id);
      const selectedStageName = getStageNameById(selectedStage);
      if (
        !candidateStage ||
        !selectedStageName ||
        candidateStage !== selectedStageName
      )
        return false;
    }
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      candidate.name.toLowerCase().includes(query) ||
      candidate.email.toLowerCase().includes(query) ||
      candidate.job_posts?.title?.toLowerCase().includes(query) ||
      candidate.parsed_data?.skills?.some((skill) =>
        skill.toLowerCase().includes(query),
      )
    );
  });

  const smartFilteredCandidates = useMemo(() => {
    return filteredCandidates.filter((candidate) => {
    // 포지션 필터
    if (positionFilter !== "all") {
      const title = candidate.job_posts?.title || "";
      if (title !== positionFilter) return false;
    }

    // 경력 필터
    if (experienceFilter !== "all") {
      const exp = candidate.experience || candidate.parsed_data?.experience || "";
      if (!exp) return false;
      if (exp !== experienceFilter) return false;
    }

    // 접수일 필터 (from/to)
    if (appliedFrom || appliedTo) {
      const createdAt = new Date(candidate.created_at);
      if (Number.isNaN(createdAt.getTime())) return false;

      if (appliedFrom) {
        const from = new Date(`${appliedFrom}T00:00:00`);
        if (createdAt < from) return false;
      }
      if (appliedTo) {
        const to = new Date(`${appliedTo}T23:59:59`);
        if (createdAt > to) return false;
      }
    }

    return true;
    });
  }, [filteredCandidates, positionFilter, experienceFilter, appliedFrom, appliedTo]);

  const getStatusConfig = useCallback((status: string) => {
    return (
      CANDIDATE_STATUS_CONFIG[status] || {
        label: status,
        dotColor: "bg-slate-400",
        bgColor: "bg-slate-50 border-slate-200/60",
        textColor: "text-slate-700",
      }
    );
  }, []);

  const activeCandidatesCount =
    isMounted && archiveFilter === "archived"
      ? archivedCandidates.length
      : isMounted && archiveFilter === "confirmed"
        ? confirmedCandidates.length
        : initialCandidates.length;

  const handleCandidateClick = (candidateId: string) => {
    // 사용자가 리스트에서 상세를 연 경우, 닫을 때 back()으로 즉시 복귀할 수 있게 플래그를 기록합니다.
    openedFromListRef.current = true;
    // ✅ 체감 속도 개선: URL 반영을 기다리지 말고 즉시 모달을 엽니다.
    setSelectedCandidateId(candidateId);
    lastLoadedCandidateIdRef.current = candidateId;
    // ✅ 클릭 즉시 상세 로딩을 시작합니다.
    loadCandidateDetail(candidateId);
    // ✅ URL은 뒤에서 동기화합니다.
    router.push(`/candidates?selected=${candidateId}`);
  };

  const handleCloseDetail = () => {
    // 상세를 닫을 때는 히스토리를 불필요하게 쌓지 않고, 전환 비용을 줄이기 위해 replace를 사용합니다.
    // - 리스트에서 클릭해서 들어온 경우: back()이 캐시를 더 잘 활용해 체감이 빠른 편입니다.
    // - 링크로 직접 진입한 경우(예: 공유 링크): back()이 다른 페이지로 나갈 수 있어 replace로 안전하게 복귀합니다.
    if (openedFromListRef.current) {
      openedFromListRef.current = false;
      router.back();
      return;
    }

    router.replace("/candidates");
  };

  const toggleSelect = useCallback(
    (candidateId: string, e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(candidateId)) next.delete(candidateId);
        else next.add(candidateId);
        return next;
      });
    },
    [],
  );

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === smartFilteredCandidates.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(smartFilteredCandidates.map((c) => c.id)));
    }
  }, [selectedIds.size, smartFilteredCandidates]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const selectedCandidates = smartFilteredCandidates.filter((c) =>
    selectedIds.has(c.id),
  );
  const isAllSelected =
    smartFilteredCandidates.length > 0 &&
    selectedIds.size === smartFilteredCandidates.length;
  const isSomeSelected = selectedIds.size > 0;

  const handleBulkArchive = async () => {
    if (!bulkArchiveReason) {
      toast.error("아카이브 사유를 선택해주세요.");
      return;
    }
    setIsBulkArchiving(true);
    try {
      const result = await bulkArchiveCandidates(
        Array.from(selectedIds),
        bulkArchiveReason,
      );
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(
          `${result.data?.count ?? selectedIds.size}명의 후보자가 아카이브되었습니다.`,
        );
        setBulkArchiveModalOpen(false);
        setBulkArchiveReason("");
        clearSelection();
        router.refresh();
      }
    } catch (err) {
      toast.error("일괄 아카이브 처리 중 오류가 발생했습니다.");
      console.error("Bulk archive error:", err);
    } finally {
      setIsBulkArchiving(false);
    }
  };

  const handleBulkMove = async () => {
    if (!bulkMoveTargetStage) {
      toast.error("이동할 전형 단계를 선택해주세요.");
      return;
    }
    setIsBulkMoving(true);
    try {
      const result = await bulkMoveToStage(
        Array.from(selectedIds),
        bulkMoveTargetStage,
      );
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(
          `${result.data?.count ?? selectedIds.size}명의 후보자가 ${result.data?.targetStageName ?? ""}(으)로 이동되었습니다.`,
        );
        setBulkMoveModalOpen(false);
        setBulkMoveTargetStage("");
        clearSelection();
        router.refresh();
      }
    } catch (err) {
      toast.error("일괄 전형 이동 중 오류가 발생했습니다.");
      console.error("Bulk move error:", err);
    } finally {
      setIsBulkMoving(false);
    }
  };

  const handleBulkEmail = async () => {
    if (!bulkEmailSubject || !bulkEmailBody) {
      toast.error("제목과 내용을 모두 입력해주세요.");
      return;
    }
    setIsBulkEmailing(true);
    try {
      let successCount = 0;
      let failCount = 0;
      for (const candidate of selectedCandidates) {
        try {
          const formData = new FormData();
          formData.append("candidate_id", candidate.id);
          formData.append("to_email", candidate.email);
          formData.append("subject", bulkEmailSubject);
          formData.append("body", bulkEmailBody);
          const result = await sendEmailToCandidate(formData);
          if (result.error) {
            failCount++;
          } else {
            successCount++;
          }
        } catch {
          failCount++;
        }
      }
      if (successCount > 0) {
        toast.success(`${successCount}명에게 이메일이 발송되었습니다.`);
      }
      if (failCount > 0) {
        toast.error(`${failCount}명에게 이메일 발송에 실패했습니다.`);
      }
      setBulkEmailModalOpen(false);
      setBulkEmailSubject("");
      setBulkEmailBody("");
      clearSelection();
      router.refresh();
    } catch (err) {
      toast.error("일괄 이메일 발송 중 오류가 발생했습니다.");
      console.error("Bulk email error:", err);
    } finally {
      setIsBulkEmailing(false);
    }
  };

  const handleConfirmHire = async (candidateId: string) => {
    try {
      const result = await confirmHire(candidateId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("입사 확정 처리되었습니다.");
        router.refresh();
      }
    } catch (err) {
      toast.error("입사 확정 처리 중 오류가 발생했습니다.");
      console.error("Confirm hire error:", err);
    }
  };

  const showLoading =
    (isLoadingArchived && archiveFilter === "archived") ||
    (isLoadingConfirmed && archiveFilter === "confirmed");
  const showEmpty = smartFilteredCandidates.length === 0;
  const showTable = !showLoading && !showEmpty;

  return (
    <div className="min-h-screen bg-[#F7F7F8] p-6">
      <div className="bg-white rounded-xl shadow-[0_4px_24px_-8px_rgba(0,0,0,0.05)] border border-neutral-200 overflow-hidden flex flex-col">
        <div className="p-8">
        <CandidatesHeader
          archiveFilter={archiveFilter}
          onArchiveFilterChange={setArchiveFilter}
          activeCandidatesCount={activeCandidatesCount}
          onAddCandidateClick={() => setAddCandidateModalOpen(true)}
        />

        {archiveFilter === "active" && (
          <StageFilters
            selectedStage={selectedStage}
            onStageChange={setSelectedStage}
            stageCounts={currentStageCounts}
            totalCount={activeCandidatesCount}
          />
        )}

        {archiveFilter === "archived" && (
          <ArchiveReasonFilters
            selectedReason={selectedArchiveReason}
            onReasonChange={setSelectedArchiveReason}
            archivedCandidates={archivedCandidates as CandidateWithArchiveReason[]}
            totalCount={activeCandidatesCount}
          />
        )}

        {error && (
          <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive">
            {error}
          </div>
        )}

        {isSomeSelected && !isAnyBulkModalOpen && (
          <BulkActionBar
            selectedCount={selectedIds.size}
            onClearSelection={clearSelection}
            onBulkMove={() => setBulkMoveModalOpen(true)}
            onBulkEmail={() => setBulkEmailModalOpen(true)}
            onBulkArchive={() => setBulkArchiveModalOpen(true)}
          />
        )}
        </div>

        {/* Smart Filter Bar (Stage 탭 아래 / 테이블 위) */}
        {archiveFilter === "active" && (
          <div
            ref={filterBarRef}
            className="px-6 py-3 bg-[#FCFCFC] border-b border-neutral-100 flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <div className="relative w-64">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="이름, 이메일 검색..."
                  className="w-full pl-9 pr-3 py-1.5 text-sm bg-white border border-neutral-200 rounded-md focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 outline-none transition-all placeholder:text-neutral-400"
                />
              </div>

              <div className="w-px h-5 bg-neutral-200 mx-2" />

              {/* 포지션 필터 */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setOpenFilter((prev) => (prev === "position" ? null : "position"))
                  }
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold bg-white border border-neutral-200 rounded-md text-neutral-600 hover:bg-neutral-50 shadow-sm transition-colors"
                >
                  포지션 <ChevronDown className="w-3 h-3" />
                </button>
                {openFilter === "position" && (
                  <div className="absolute z-50 mt-2 w-60 rounded-lg border border-neutral-200 bg-white shadow-[0_24px_60px_-15px_rgba(0,0,0,0.12)] p-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPositionFilter("all");
                        setOpenFilter(null);
                      }}
                      className={cn(
                        "w-full text-left px-2 py-2 rounded-md text-sm hover:bg-neutral-50",
                        positionFilter === "all" && "bg-neutral-100/60 font-semibold",
                      )}
                    >
                      전체
                    </button>
                    <div className="max-h-64 overflow-auto">
                      {positionOptions.map((title) => (
                        <button
                          key={title}
                          type="button"
                          onClick={() => {
                            setPositionFilter(title);
                            setOpenFilter(null);
                          }}
                          className={cn(
                            "w-full text-left px-2 py-2 rounded-md text-sm hover:bg-neutral-50",
                            positionFilter === title && "bg-neutral-100/60 font-semibold",
                          )}
                        >
                          {title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 경력 필터 */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setOpenFilter((prev) => (prev === "experience" ? null : "experience"))
                  }
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold bg-white border border-neutral-200 rounded-md text-neutral-600 hover:bg-neutral-50 shadow-sm transition-colors"
                >
                  경력 <ChevronDown className="w-3 h-3" />
                </button>
                {openFilter === "experience" && (
                  <div className="absolute z-50 mt-2 w-56 rounded-lg border border-neutral-200 bg-white shadow-[0_24px_60px_-15px_rgba(0,0,0,0.12)] p-2">
                    <button
                      type="button"
                      onClick={() => {
                        setExperienceFilter("all");
                        setOpenFilter(null);
                      }}
                      className={cn(
                        "w-full text-left px-2 py-2 rounded-md text-sm hover:bg-neutral-50",
                        experienceFilter === "all" && "bg-neutral-100/60 font-semibold",
                      )}
                    >
                      전체
                    </button>
                    <div className="max-h-64 overflow-auto">
                      {experienceOptions.map((exp) => (
                        <button
                          key={exp}
                          type="button"
                          onClick={() => {
                            setExperienceFilter(exp);
                            setOpenFilter(null);
                          }}
                          className={cn(
                            "w-full text-left px-2 py-2 rounded-md text-sm hover:bg-neutral-50",
                            experienceFilter === exp && "bg-neutral-100/60 font-semibold",
                          )}
                        >
                          {exp}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 접수일 필터 */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setOpenFilter((prev) => (prev === "applied" ? null : "applied"))
                  }
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold bg-white border border-neutral-200 rounded-md text-neutral-600 hover:bg-neutral-50 shadow-sm transition-colors"
                >
                  접수일 <ChevronDown className="w-3 h-3" />
                </button>
                {openFilter === "applied" && (
                  <div className="absolute z-50 mt-2 w-72 rounded-lg border border-neutral-200 bg-white shadow-[0_24px_60px_-15px_rgba(0,0,0,0.12)] p-3">
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                            From
                          </p>
                          <input
                            type="date"
                            value={appliedFrom}
                            onChange={(e) => setAppliedFrom(e.target.value)}
                            className="w-full px-2 py-1.5 text-sm bg-white border border-neutral-200 rounded-md focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 outline-none"
                          />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                            To
                          </p>
                          <input
                            type="date"
                            value={appliedTo}
                            onChange={(e) => setAppliedTo(e.target.value)}
                            className="w-full px-2 py-1.5 text-sm bg-white border border-neutral-200 rounded-md focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 outline-none"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setAppliedFrom("");
                            setAppliedTo("");
                            setOpenFilter(null);
                          }}
                          className="text-xs font-semibold text-neutral-500 hover:text-neutral-900"
                        >
                          초기화
                        </button>
                        <button
                          type="button"
                          onClick={() => setOpenFilter(null)}
                          className="px-2.5 py-1.5 text-xs font-semibold bg-neutral-900 text-white rounded-md hover:bg-neutral-800 active:scale-[0.98] transition-all"
                        >
                          적용
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setPositionFilter("all");
                setExperienceFilter("all");
                setAppliedFrom("");
                setAppliedTo("");
                setOpenFilter(null);
              }}
              className="text-xs font-semibold text-neutral-400 hover:text-neutral-900 flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3 h-3" /> 필터 초기화
            </button>
          </div>
        )}

        {showLoading && <CandidatesTableLoading />}
        {!showLoading && smartFilteredCandidates.length === 0 && (
          <CandidatesEmptyState hasSearchQuery={!!searchQuery} />
        )}
        {!showLoading && smartFilteredCandidates.length > 0 && (
          <>
            <CandidatesTable
              candidates={smartFilteredCandidates}
              selectedStage={selectedStage}
              selectedCandidateId={selectedCandidateId}
              selectedIds={selectedIds}
              isAllSelected={isAllSelected}
              isSomeSelected={isSomeSelected}
              getStageName={getStageName}
              onRowClick={handleCandidateClick}
              onToggleSelect={toggleSelect}
              onToggleSelectAll={toggleSelectAll}
              onArchiveClick={(c) => {
                setSelectedCandidateForArchive(c);
                setArchiveModalOpen(true);
              }}
              onConfirmHire={handleConfirmHire}
            />
            <div className="mt-4 text-sm text-slate-600">
              총 {smartFilteredCandidates.length}명의 후보자
            </div>
          </>
        )}
      </div>

      <CandidateDetailDialog
        open={!!selectedCandidateId}
        onOpenChange={() => {}}
        candidateId={selectedCandidateId}
        candidate={candidateDetail}
        schedules={schedules}
        timelineEvents={timelineEvents}
        isLoading={isLoadingDetail}
        error={detailError}
        onClose={handleCloseDetail}
      />

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

      <AddCandidateModal
        isOpen={addCandidateModalOpen}
        onClose={() => {
          setAddCandidateModalOpen(false);
          router.refresh();
        }}
      />

      <BulkArchiveModal
        open={bulkArchiveModalOpen}
        onOpenChange={setBulkArchiveModalOpen}
        selectedCandidates={selectedCandidates}
        selectedCount={selectedIds.size}
        reason={bulkArchiveReason}
        onReasonChange={setBulkArchiveReason}
        isLoading={isBulkArchiving}
        onConfirm={handleBulkArchive}
        onCancel={() => {
          setBulkArchiveModalOpen(false);
          setBulkArchiveReason("");
        }}
      />

      <BulkMoveModal
        open={bulkMoveModalOpen}
        onOpenChange={setBulkMoveModalOpen}
        selectedCandidates={selectedCandidates}
        selectedCount={selectedIds.size}
        targetStageId={bulkMoveTargetStage}
        onTargetStageChange={setBulkMoveTargetStage}
        isLoading={isBulkMoving}
        onConfirm={handleBulkMove}
        onCancel={() => {
          setBulkMoveModalOpen(false);
          setBulkMoveTargetStage("");
        }}
      />

      <BulkEmailModal
        open={bulkEmailModalOpen}
        onOpenChange={setBulkEmailModalOpen}
        selectedCandidates={selectedCandidates}
        selectedCount={selectedIds.size}
        subject={bulkEmailSubject}
        body={bulkEmailBody}
        onSubjectChange={setBulkEmailSubject}
        onBodyChange={setBulkEmailBody}
        isLoading={isBulkEmailing}
        onConfirm={handleBulkEmail}
        onCancel={() => {
          setBulkEmailModalOpen(false);
          setBulkEmailSubject("");
          setBulkEmailBody("");
        }}
      />
    </div>
  );
}
