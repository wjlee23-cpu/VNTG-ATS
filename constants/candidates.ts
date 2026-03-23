/**
 * 후보자 목록 UI용 상태 설정 (실제 DB status와 연동)
 */
export const CANDIDATE_STATUS_CONFIG: Record<
  string,
  { label: string; dotColor: string; bgColor: string; textColor: string }
> = {
  pending: {
    label: "Pending",
    dotColor: "bg-amber-400",
    bgColor: "bg-amber-50 border-amber-200/60",
    textColor: "text-amber-700",
  },
  in_progress: {
    label: "In Progress",
    dotColor: "bg-blue-400",
    bgColor: "bg-blue-50 border-blue-200/60",
    textColor: "text-blue-700",
  },
  confirmed: {
    label: "Hired",
    dotColor: "bg-emerald-400",
    bgColor: "bg-emerald-50 border-emerald-200/60",
    textColor: "text-emerald-700",
  },
  rejected: {
    label: "Rejected",
    dotColor: "bg-rose-400",
    bgColor: "bg-rose-50 border-rose-200/60",
    textColor: "text-rose-700",
  },
  issue: {
    label: "Issue",
    dotColor: "bg-orange-400",
    bgColor: "bg-orange-50 border-orange-200/60",
    textColor: "text-orange-700",
  },
};
