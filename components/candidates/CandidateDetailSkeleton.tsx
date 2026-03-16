'use client';

import { Skeleton } from '@/components/ui/skeleton';

/**
 * Candidate Detail 화면과 동일한 레이아웃의 스켈레톤 UI 컴포넌트
 * 로딩 중 부드러운 화면 전환을 위해 사용
 */
export function CandidateDetailSkeleton() {
  return (
    <div className="flex flex-col md:grid md:grid-cols-12 h-full max-h-[90vh] overflow-hidden">
      {/* 좌측 프로필 영역 스켈레톤 - 모바일: 위쪽, PC: 왼쪽 */}
      <div className="md:col-span-4 lg:col-span-3 bg-white p-6 border-b md:border-b-0 md:border-r border-slate-100 flex flex-col">
        {/* Avatar 및 이름 영역 */}
        <div className="flex flex-col items-center md:items-start text-center md:text-left mb-6">
          <Skeleton className="w-20 h-20 md:w-24 md:h-24 rounded-full mb-4 bg-slate-100" />
          <Skeleton className="h-8 w-32 mb-2 bg-slate-100" />
          <Skeleton className="h-5 w-24 mb-3 bg-slate-100" />
          <Skeleton className="h-6 w-28 rounded-full bg-slate-100" />
        </div>

        {/* 버튼 영역 */}
        <Skeleton className="w-full h-12 rounded-lg mb-4 bg-slate-100" />
        <div className="mt-4 space-y-2">
          <Skeleton className="w-full h-10 rounded-lg bg-slate-100" />
          <Skeleton className="w-full h-10 rounded-lg bg-slate-100" />
        </div>
      </div>

      {/* 우측 콘텐츠 영역 스켈레톤 - 모바일: 아래쪽, PC: 오른쪽 */}
      <div className="md:col-span-8 lg:col-span-9 bg-slate-50 p-6 md:p-8 overflow-y-auto">
        {/* Match Score Section 스켈레톤 */}
        <div className="mb-6 bg-slate-50 border border-slate-100 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Skeleton className="w-5 h-5 rounded bg-slate-100" />
            <Skeleton className="h-6 w-32 rounded bg-slate-100" />
          </div>
          <div className="flex items-center justify-center gap-8">
            <Skeleton className="w-32 h-32 rounded-full bg-slate-100" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-4 w-3/4 rounded bg-slate-100" />
              <Skeleton className="h-4 w-1/2 rounded bg-slate-100" />
            </div>
          </div>
        </div>

        {/* Contact Section 스켈레톤 */}
        <div className="mb-6 bg-white border border-slate-100 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-6 w-20 rounded bg-slate-100" />
            <Skeleton className="h-8 w-16 rounded bg-slate-100" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-12 w-full rounded-lg bg-slate-100" />
            <Skeleton className="h-12 w-full rounded-lg bg-slate-100" />
            <Skeleton className="h-12 w-2/3 rounded-lg bg-slate-100" />
          </div>
        </div>

        {/* Compensation Section 스켈레톤 */}
        <div className="mb-6 bg-white border border-slate-100 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-6 w-28 rounded bg-slate-100" />
            <Skeleton className="h-8 w-16 rounded bg-slate-100" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-24 w-full rounded-lg bg-slate-100" />
            <Skeleton className="h-24 w-full rounded-lg bg-slate-100" />
          </div>
        </div>

        {/* Skills Section 스켈레톤 */}
        <div className="mb-6 bg-white border border-slate-100 rounded-xl p-6 shadow-sm">
          <Skeleton className="h-6 w-16 rounded mb-4 bg-slate-100" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-7 w-20 rounded-full bg-slate-100" />
            <Skeleton className="h-7 w-24 rounded-full bg-slate-100" />
            <Skeleton className="h-7 w-16 rounded-full bg-slate-100" />
            <Skeleton className="h-7 w-28 rounded-full bg-slate-100" />
            <Skeleton className="h-7 w-22 rounded-full bg-slate-100" />
          </div>
        </div>

        {/* Documents Section 스켈레톤 */}
        <div className="mb-6 bg-white border border-slate-100 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-6 w-24 rounded bg-slate-100" />
            <Skeleton className="h-8 w-20 rounded bg-slate-100" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-16 w-full rounded-lg bg-slate-100" />
            <Skeleton className="h-16 w-full rounded-lg bg-slate-100" />
          </div>
        </div>
      </div>
    </div>
  );
}
