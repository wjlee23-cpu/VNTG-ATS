import { Skeleton } from "@/components/ui/skeleton";

export function CandidatesPageSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50/50 p-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
        {/* 상단 헤더/검색/버튼 영역 */}
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3">
              <Skeleton className="h-7 w-48 bg-slate-200/70" />
              <Skeleton className="h-4 w-72 bg-slate-200/60" />
            </div>
            <Skeleton className="h-10 w-36 rounded-xl bg-slate-200/70" />
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Skeleton className="h-10 flex-1 rounded-xl bg-slate-200/60" />
            <Skeleton className="h-10 w-full sm:w-56 rounded-xl bg-slate-200/60" />
          </div>
        </div>

        {/* 스테이지 필터/칩 영역 */}
        <div className="mt-6 flex flex-wrap gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-9 w-28 rounded-full bg-slate-200/55"
            />
          ))}
        </div>

        {/* 테이블 영역 */}
        <div className="mt-6 border border-slate-100 rounded-2xl overflow-hidden">
          <div className="bg-slate-50/50 px-4 py-3 flex items-center gap-3">
            <Skeleton className="h-4 w-4 rounded bg-slate-200/70" />
            <Skeleton className="h-4 w-40 bg-slate-200/70" />
            <div className="ml-auto flex gap-3">
              <Skeleton className="h-4 w-24 bg-slate-200/70" />
              <Skeleton className="h-4 w-24 bg-slate-200/70" />
              <Skeleton className="h-4 w-24 bg-slate-200/70" />
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="px-4 py-4 flex items-center gap-3">
                <Skeleton className="h-4 w-4 rounded bg-slate-200/60" />
                <div className="flex-1 flex items-center gap-4">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-40 bg-slate-200/65" />
                    <Skeleton className="h-3 w-56 bg-slate-200/55" />
                  </div>
                  <div className="ml-auto hidden md:flex items-center gap-3">
                    <Skeleton className="h-7 w-28 rounded-full bg-slate-200/55" />
                    <Skeleton className="h-7 w-28 rounded-full bg-slate-200/55" />
                    <Skeleton className="h-7 w-28 rounded-full bg-slate-200/55" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <Skeleton className="h-4 w-40 bg-slate-200/60" />
        </div>
      </div>
    </div>
  );
}

