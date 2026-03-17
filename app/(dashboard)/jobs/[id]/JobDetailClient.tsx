"use client";

import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Briefcase,
  Users,
  Calendar,
  Mail,
  Phone,
  Search,
  Filter,
  Settings,
} from "lucide-react";
import { useState, useEffect } from "react";
import { updateJob } from "@/api/actions/jobs";
import { toast } from "sonner";
import { ProcessStageBuilder } from "@/components/jobs/ProcessStageBuilder";
import { CustomStage } from "@/types/job";

interface Job {
  id: string;
  title: string;
  description: string | null;
  organization_id: string;
  process_id: string;
  custom_stages?: CustomStage[] | null;
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

interface User {
  id: string;
  email: string;
  role: string;
}

interface JobDetailClientProps {
  job: Job;
  candidates: Candidate[];
  users: User[];
  stats?: JobStats;
}

interface Candidate {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: "pending" | "in_progress" | "confirmed" | "rejected" | "issue";
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

export function JobDetailClient({
  job,
  candidates,
  users,
  stats,
}: JobDetailClientProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isStageSettingsOpen, setIsStageSettingsOpen] = useState(false);
  const [customStages, setCustomStages] = useState<CustomStage[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // custom_stages 초기화
  useEffect(() => {
    if (job.custom_stages && Array.isArray(job.custom_stages)) {
      setCustomStages(job.custom_stages as CustomStage[]);
    } else {
      setCustomStages([]);
    }
  }, [job]);

  // 검색 및 필터링
  const filteredCandidates = candidates.filter((candidate) => {
    const matchesSearch =
      !searchQuery ||
      candidate.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      candidate.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || candidate.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // 상태별 색상
  const getStatusColor = (status: string) => {
    const colors = {
      pending: "bg-accent/10 text-accent",
      in_progress: "bg-primary/10 text-primary",
      confirmed: "bg-primary/10 text-primary",
      rejected: "bg-destructive/10 text-destructive",
      issue: "bg-accent/10 text-accent",
    };
    return (
      colors[status as keyof typeof colors] || "bg-muted text-muted-foreground"
    );
  };

  const getStatusText = (status: string) => {
    const texts = {
      pending: "대기중",
      in_progress: "진행중",
      confirmed: "확정",
      rejected: "거절",
      issue: "이슈",
    };
    return texts[status as keyof typeof texts] || status;
  };

  // 상태별 통계
  const statusCounts = candidates.reduce(
    (acc, candidate) => {
      acc[candidate.status] = (acc[candidate.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  // 프로세스 단계 설정 저장
  const handleSaveStageSettings = async () => {
    if (customStages.length === 0) {
      toast.error("최소 1개 이상의 프로세스 단계를 선택해야 합니다.");
      return;
    }

    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append("title", job.title);
      formData.append("description", job.description || "");
      formData.append("custom_stages", JSON.stringify(customStages));

      const result = await updateJob(job.id, formData);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("프로세스 단계 설정이 저장되었습니다.");
        setIsStageSettingsOpen(false);
        router.refresh();
      }
    } catch (error) {
      toast.error("설정 저장에 실패했습니다.");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="h-full overflow-auto">
      <div className="px-8 py-6">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4"
          >
            <ChevronLeft size={18} className="flex-shrink-0" />
            뒤로가기
          </button>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">
                {job.title}
              </h1>
              {job.processes && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Briefcase size={16} />
                  {job.processes.name}
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">후보자</div>
              <div className="text-2xl font-bold text-foreground">
                {candidates.length}명
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Job Description */}
            {job.description && (
              <div className="card-modern p-6">
                <h2 className="text-lg font-bold text-foreground mb-4">
                  상세 설명
                </h2>
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {job.description}
                </p>
              </div>
            )}

            {/* Process Stages */}
            <div className="card-modern p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-foreground">
                  채용 프로세스
                </h2>
                <button
                  onClick={() => setIsStageSettingsOpen(true)}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-primary hover:bg-primary/10 rounded-lg transition-colors"
                >
                  <Settings size={16} />
                  설정
                </button>
              </div>
              {customStages.length > 0 ? (
                <div className="flex items-center gap-2 overflow-x-auto pb-2">
                  {customStages.map((stage, index) => (
                    <div
                      key={stage.id}
                      className="flex items-center flex-shrink-0"
                    >
                      <div className="text-center">
                        <div className="w-12 h-12 rounded-full bg-brand-main text-white flex items-center justify-center font-semibold mb-2">
                          {stage.order}
                        </div>
                        <div className="text-xs text-muted-foreground max-w-[80px]">
                          {stage.name}
                        </div>
                      </div>
                      {index < customStages.length - 1 && (
                        <div className="h-1 w-8 bg-border mx-2" />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  프로세스 단계가 설정되지 않았습니다. 설정 버튼을 클릭하여
                  단계를 추가하세요.
                </p>
              )}
            </div>

            {/* Stage Settings Modal */}
            {isStageSettingsOpen && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-background rounded-xl max-w-5xl w-full max-h-[90vh] overflow-auto">
                  <div className="p-6 border-b border-border">
                    <h3 className="text-xl font-bold text-foreground">
                      프로세스 단계 설정
                    </h3>
                    <p className="text-sm text-muted-foreground mt-2">
                      이 포지션에서 사용할 프로세스 단계를 선택하고 순서를
                      조정하세요. 드래그하여 순서를 변경할 수 있습니다.
                    </p>
                  </div>
                  <div className="p-6">
                    <ProcessStageBuilder
                      initialStages={customStages}
                      users={users}
                      onChange={setCustomStages}
                    />
                  </div>
                  <div className="p-6 border-t border-border flex justify-end gap-3">
                    <button
                      onClick={() => setIsStageSettingsOpen(false)}
                      className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
                      disabled={isSaving}
                    >
                      취소
                    </button>
                    <button
                      onClick={handleSaveStageSettings}
                      disabled={isSaving || customStages.length === 0}
                      className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      {isSaving ? "저장 중..." : "저장"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Candidates List */}
            <div className="card-modern p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-foreground">
                  후보자 목록
                </h2>
                <span className="text-sm text-muted-foreground">
                  {filteredCandidates.length}명
                </span>
              </div>

              {/* Search and Filter */}
              <div className="mb-4 flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                  <Search
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"
                    size={18}
                  />
                  <input
                    type="text"
                    placeholder="이름, 이메일로 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
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
                  <Users
                    className="mx-auto text-muted-foreground mb-2"
                    size={32}
                  />
                  <p className="text-muted-foreground text-sm">
                    {searchQuery || statusFilter !== "all"
                      ? "검색 결과가 없습니다."
                      : "등록된 후보자가 없습니다."}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted border-b border-border">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                          이름
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                          연락처
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                          매치
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                          상태
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                          등록일
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredCandidates.map((candidate) => (
                        <tr
                          key={candidate.id}
                          onClick={() =>
                            router.push(`/candidates/${candidate.id}`)
                          }
                          className="hover:bg-muted cursor-pointer transition-colors"
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium text-foreground">
                              {candidate.name}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-muted-foreground">
                              {candidate.email}
                            </div>
                            {candidate.phone && (
                              <div className="text-xs text-muted-foreground">
                                {candidate.phone}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {candidate.parsed_data?.match_score ? (
                              <div className="text-sm font-semibold text-brand-main">
                                {candidate.parsed_data.match_score}%
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(candidate.status)}`}
                            >
                              {getStatusText(candidate.status)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-muted-foreground">
                              {new Date(
                                candidate.created_at,
                              ).toLocaleDateString("ko-KR")}
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
            <div className="card-modern p-6">
              <h2 className="text-lg font-bold text-foreground mb-4">
                상태별 통계
              </h2>
              <div className="space-y-3">
                {Object.entries(statusCounts).map(([status, count]) => (
                  <div
                    key={status}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm text-muted-foreground">
                      {getStatusText(status)}
                    </span>
                    <div className="flex items-center gap-3">
                      <div className="w-24 bg-muted rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${getStatusColor(status).split(" ")[0]}`}
                          style={{
                            width: `${(count / candidates.length) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-foreground w-8 text-right">
                        {count}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Job Info */}
            <div className="card-modern p-6">
              <h2 className="text-lg font-bold text-foreground mb-4">정보</h2>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-muted-foreground">생성일</span>
                  <p className="text-foreground font-medium">
                    {new Date(job.created_at).toLocaleDateString("ko-KR")}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">수정일</span>
                  <p className="text-foreground font-medium">
                    {new Date(job.updated_at).toLocaleDateString("ko-KR")}
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
