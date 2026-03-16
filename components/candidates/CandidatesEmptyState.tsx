'use client';

import { Users } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface CandidatesEmptyStateProps {
  hasSearchQuery: boolean;
}

/** 후보자 목록이 비었을 때 또는 로딩 시 표시 */
export function CandidatesEmptyState({ hasSearchQuery }: CandidatesEmptyStateProps) {
  const router = useRouter();
  return (
    <div className="p-12 text-center bg-slate-50 rounded-xl">
      <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center mx-auto mb-4">
        <Users className="text-slate-400" size={32} />
      </div>
      <h2 className="text-xl font-semibold text-foreground mb-2">
        후보자가 없습니다
      </h2>
      <p className="text-muted-foreground mb-6">
        {hasSearchQuery ? '검색 결과가 없습니다.' : '아직 등록된 후보자가 없습니다.'}
      </p>
      {!hasSearchQuery && (
        <button
          onClick={() => router.push('/jobs')}
          className="px-6 py-3 bg-gradient-to-r from-[#0248FF] to-[#5287FF] text-white rounded-xl font-medium hover:from-[#0248FF]/90 hover:to-[#5287FF]/90 transition-colors"
        >
          채용 공고 보기
        </button>
      )}
    </div>
  );
}
