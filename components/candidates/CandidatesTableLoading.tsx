'use client';

/** Archived/Confirmed 로딩 중 스피너 */
export function CandidatesTableLoading() {
  return (
    <div className="p-12 text-center bg-slate-50 rounded-xl">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#5287FF] mx-auto mb-4" />
      <p className="text-muted-foreground">후보자를 불러오는 중...</p>
    </div>
  );
}
