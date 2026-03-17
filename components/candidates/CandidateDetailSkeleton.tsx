'use client';

import { Skeleton } from '@/components/ui/skeleton';

/**
 * Candidate Detail 화면과 동일한 레이아웃의 스켈레톤 UI 컴포넌트
 * 로딩 중 부드러운 화면 전환을 위해 사용
 * VNTG Design System 2.0 디자인에 맞춘 스켈레톤
 */
export function CandidateDetailSkeleton() {
  return (
    <div className="flex h-[820px] w-full max-w-[1080px] bg-white rounded-2xl shadow-[0_24px_60px_-15px_rgba(0,0,0,0.05)] border border-neutral-200 overflow-hidden font-sans">
      {/* 좌측 사이드바 스켈레톤 */}
      <div className="w-[280px] bg-[#FCFCFC] border-r border-neutral-200 p-7 flex flex-col justify-between shrink-0">
        <div>
          {/* 프로필 영역 */}
          <div className="flex items-center gap-4 mb-8">
            <Skeleton className="w-12 h-12 rounded-full bg-neutral-200" />
            <div>
              <Skeleton className="h-5 w-24 mb-2 bg-neutral-200" />
              <Skeleton className="h-4 w-32 bg-neutral-200" />
            </div>
          </div>

          {/* 일정 등록 버튼 */}
          <Skeleton className="w-full h-10 rounded-lg mb-3 bg-neutral-200" />

          {/* 액션 메뉴 */}
          <div className="mt-8 flex flex-col gap-0.5">
            <Skeleton className="w-full h-9 rounded-md bg-neutral-200" />
            <Skeleton className="w-full h-9 rounded-md bg-neutral-200" />
            <Skeleton className="w-full h-9 rounded-md bg-neutral-200" />
          </div>
        </div>

        {/* 현재 상태 표시 */}
        <div className="px-3 py-3 rounded-md bg-neutral-100/50 border border-neutral-200/50">
          <Skeleton className="h-4 w-20 mb-1 bg-neutral-200" />
          <Skeleton className="h-3 w-16 bg-neutral-200" />
        </div>
      </div>

      {/* 우측 메인 콘텐츠 영역 스켈레톤 */}
      <div className="flex-1 flex flex-col bg-white relative min-h-0">
        {/* 탭 헤더 */}
        <header className="h-16 border-b border-neutral-100 px-8 flex items-center justify-between shrink-0">
          <div className="flex gap-6 h-full">
            <Skeleton className="h-6 w-20 bg-neutral-200" />
            <Skeleton className="h-6 w-28 bg-neutral-200" />
          </div>
        </header>

        {/* AI Match Score 카드 스켈레톤 */}
        <div className="flex-1 overflow-y-auto p-8 min-h-0">
          <div className="rounded-xl border border-neutral-200 bg-gradient-to-br from-[#FCFCFC] to-white p-6 mb-8 flex gap-8 items-center shadow-[0_2px_10px_-4px_rgba(0,0,0,0.02)]">
            {/* 점수 영역 */}
            <div className="flex flex-col items-center justify-center min-w-[140px] pr-8 border-r border-neutral-200">
              <Skeleton className="h-16 w-24 mb-2 bg-neutral-200" />
              <Skeleton className="h-6 w-20 rounded-full bg-neutral-200" />
            </div>

            {/* 요약 텍스트 */}
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-full bg-neutral-200" />
              <Skeleton className="h-4 w-3/4 bg-neutral-200" />
              <Skeleton className="h-4 w-5/6 bg-neutral-200" />
            </div>
          </div>

          {/* Strengths & Gaps 섹션 스켈레톤 */}
          <div className="space-y-6">
            {/* Strengths */}
            <div className="rounded-xl border border-neutral-200 bg-white p-6">
              <div className="flex items-center gap-2 mb-4">
                <Skeleton className="w-5 h-5 rounded bg-neutral-200" />
                <Skeleton className="h-5 w-24 bg-neutral-200" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-full bg-neutral-200" />
                <Skeleton className="h-4 w-5/6 bg-neutral-200" />
              </div>
            </div>

            {/* Gaps */}
            <div className="rounded-xl border border-neutral-200 bg-white p-6">
              <div className="flex items-center gap-2 mb-4">
                <Skeleton className="w-5 h-5 rounded bg-neutral-200" />
                <Skeleton className="h-5 w-24 bg-neutral-200" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-full bg-neutral-200" />
                <Skeleton className="h-4 w-5/6 bg-neutral-200" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
