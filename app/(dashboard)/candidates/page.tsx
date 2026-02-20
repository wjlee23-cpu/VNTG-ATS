import { getCandidates, getCandidatesByStage } from '@/api/queries/candidates';
import { CandidatesClient } from './CandidatesClient';

export default async function CandidatesPage() {
  const candidatesResult = await getCandidates();
  const candidates = candidatesResult.data || [];
  const error = candidatesResult.error;

  // 단계별 후보자 수 조회
  const stageCountsResult = await getCandidatesByStage();
  const stageCounts = stageCountsResult.data || {};

  return (
    <CandidatesClient 
      initialCandidates={candidates}
      stageCounts={stageCounts}
      error={error}
    />
  );
}
