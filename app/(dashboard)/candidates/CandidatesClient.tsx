"use client";

import { useState, useEffect, useCallback } from "react";
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
  }, [selectedStage, searchQuery]);

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
      loadCandidateDetail(selected);
    } else {
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
    router.push(`/candidates?selected=${candidateId}`);
  };

  const handleCloseDetail = () => {
    router.push("/candidates");
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
    if (selectedIds.size === filteredCandidates.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredCandidates.map((c) => c.id)));
    }
  }, [selectedIds.size, filteredCandidates]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const selectedCandidates = filteredCandidates.filter((c) =>
    selectedIds.has(c.id),
  );
  const isAllSelected =
    filteredCandidates.length > 0 &&
    selectedIds.size === filteredCandidates.length;
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
  const showEmpty = filteredCandidates.length === 0;
  const showTable = !showLoading && !showEmpty;

  return (
    <div className="min-h-screen bg-slate-50/50 p-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
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

        {isSomeSelected && (
          <BulkActionBar
            selectedCount={selectedIds.size}
            onClearSelection={clearSelection}
            onBulkMove={() => setBulkMoveModalOpen(true)}
            onBulkEmail={() => setBulkEmailModalOpen(true)}
            onBulkArchive={() => setBulkArchiveModalOpen(true)}
          />
        )}

        {showLoading && <CandidatesTableLoading />}
        {!showLoading && showEmpty && (
          <CandidatesEmptyState hasSearchQuery={!!searchQuery} />
        )}
        {showTable && (
          <>
            <CandidatesTable
              candidates={filteredCandidates}
              selectedStage={selectedStage}
              selectedCandidateId={selectedCandidateId}
              selectedIds={selectedIds}
              isAllSelected={isAllSelected}
              isSomeSelected={isSomeSelected}
              getStageName={getStageName}
              getStatusConfig={getStatusConfig}
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
              총 {filteredCandidates.length}명의 후보자
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
