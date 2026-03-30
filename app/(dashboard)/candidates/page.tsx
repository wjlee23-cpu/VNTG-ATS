import { getCandidates, getCandidatesByStage } from '@/api/queries/candidates';
import { CandidatesClient } from './CandidatesClient';
import { Suspense } from 'react';

export default async function CandidatesPage() {
  const candidatesResult = await getCandidates();
  const candidates = candidatesResult.data || [];
  const error = candidatesResult.error;

  // 단계별 후보자 수 조회
  const stageCountsResult = await getCandidatesByStage();
  const stageCounts = stageCountsResult.data || {};

  return (
    // CandidatesClient 내부에서 useSearchParams()를 사용하므로, 빌드(프리렌더) 에러 방지를 위해 Suspense로 감쌉니다.
    <Suspense fallback={<div className="p-6" />}>
      <CandidatesClient 
        initialCandidates={candidates}
        stageCounts={stageCounts}
        error={error}
      />
    </Suspense>
  );
}
