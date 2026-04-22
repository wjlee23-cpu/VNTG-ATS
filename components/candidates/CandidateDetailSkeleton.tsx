'use client';

import { Skeleton } from '@/components/ui/skeleton';

/**
 * Candidate Detail 화면과 동일한 레이아웃의 스켈레톤 UI 컴포넌트
 * CandidateDetailLayout + Profile 탭 구조에 맞춤 (3탭, Gemini 요약, 2열, Documents, 뷰어)
 */
export function CandidateDetailSkeleton() {
  return (
    <div className="flex h-full min-h-0 w-full min-w-0 max-w-[1280px] bg-white rounded-2xl shadow-[0_24px_60px_-15px_rgba(0,0,0,0.05)] border border-neutral-200 overflow-hidden font-sans">
      {/* 좌측 사이드바 — CandidateSidebar와 동일 폭 */}
      <div className="w-[280px] shrink-0 bg-[#FCFCFC] border-r border-neutral-200 p-7 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-4 mb-8">
            <Skeleton className="h-12 w-12 rounded-full bg-slate-200/70" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-5 w-28 bg-slate-200/70" />
              <Skeleton className="h-4 w-36 bg-slate-200/60" />
            </div>
          </div>
          <Skeleton className="h-10 w-full rounded-lg mb-3 bg-slate-200/70" />
          <div className="mt-8 flex flex-col gap-0.5">
            <Skeleton className="h-9 w-full rounded-md bg-slate-200/60" />
            <Skeleton className="h-9 w-full rounded-md bg-slate-200/60" />
            <Skeleton className="h-9 w-full rounded-md bg-slate-200/60" />
          </div>
        </div>
        <div className="rounded-md border border-neutral-200/50 bg-neutral-100/50 px-3 py-3">
          <Skeleton className="mb-1 h-4 w-24 bg-slate-200/65" />
          <Skeleton className="h-3 w-20 bg-slate-200/55" />
        </div>
      </div>

      {/* 우측: 탭 + Profile형 본문 */}
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-white">
        <header className="z-10 flex h-16 shrink-0 items-center border-b border-neutral-100 bg-white px-8">
          <div className="flex h-full gap-8">
            <Skeleton className="mt-auto mb-0 h-6 w-[72px] rounded-none border-b-2 border-transparent bg-slate-200/70 pb-3" />
            <Skeleton className="mt-auto mb-0 h-6 w-[88px] rounded-none border-b-2 border-transparent bg-slate-200/60 pb-3" />
            <Skeleton className="mt-auto mb-0 h-6 w-[140px] rounded-none border-b-2 border-transparent bg-slate-200/60 pb-3" />
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-8">
          {/* Gemini Quick Summary 띠 */}
          <div className="mb-8 flex gap-3 rounded-xl border border-indigo-100/50 bg-gradient-to-r from-indigo-50/50 to-blue-50/50 p-4">
            <Skeleton className="mt-0.5 h-4 w-4 shrink-0 rounded bg-slate-200/60" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3 w-40 bg-slate-200/55" />
              <Skeleton className="h-4 w-full bg-slate-200/60" />
              <Skeleton className="h-4 w-[92%] bg-slate-200/55" />
              <Skeleton className="h-4 w-[78%] bg-slate-200/50" />
            </div>
          </div>

          {/* 기본 정보 | 연봉 2열 */}
          <div className="mb-10 grid grid-cols-1 gap-8 md:grid-cols-2">
            <div className="space-y-4">
              <Skeleton className="h-4 w-32 bg-slate-200/65" />
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                  <Skeleton className="h-4 w-24 bg-slate-200/55" />
                  <Skeleton className="h-4 flex-1 max-w-[180px] bg-slate-200/60" />
                </div>
              ))}
            </div>
            <div className="space-y-4">
              <Skeleton className="h-4 w-28 bg-slate-200/65" />
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                  <Skeleton className="h-4 w-28 bg-slate-200/55" />
                  <Skeleton className="h-4 flex-1 max-w-[200px] bg-slate-200/60" />
                </div>
              ))}
            </div>
          </div>

          {/* Documents 행 */}
          <div className="mb-10">
            <div className="mb-4 flex items-center gap-2 border-b border-neutral-100 pb-2">
              <Skeleton className="h-3 w-24 bg-slate-200/65" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-8 w-[140px] rounded-lg bg-slate-200/65" />
              <Skeleton className="h-8 w-[160px] rounded-lg bg-slate-200/60" />
              <Skeleton className="h-8 w-[100px] rounded-lg border border-dashed border-slate-200/80 bg-slate-100/50" />
            </div>
          </div>

          {/* 이력서 뷰어 패널 (~600px) */}
          <div className="flex h-[600px] flex-col overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100/50">
            <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-neutral-200 bg-white px-4">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <Skeleton className="h-4 w-4 shrink-0 rounded bg-slate-200/60" />
                <Skeleton className="h-4 w-48 max-w-[60%] bg-slate-200/65" />
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Skeleton className="h-7 w-7 rounded-md bg-slate-200/50" />
                <Skeleton className="h-4 w-10 bg-slate-200/50" />
                <Skeleton className="h-7 w-7 rounded-md bg-slate-200/50" />
                <Skeleton className="mx-2 h-4 w-px bg-slate-200/60" />
                <Skeleton className="h-8 w-24 rounded-md bg-slate-200/70" />
              </div>
            </div>
            <div className="min-h-0 flex-1 bg-neutral-100/30 p-4">
              <div className="mx-auto h-full max-w-[900px] rounded-lg border border-neutral-200 bg-white shadow-sm">
                <Skeleton className="h-full min-h-[480px] w-full rounded-lg bg-slate-100/80" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
