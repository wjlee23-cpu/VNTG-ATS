'use client';

import { useParams } from 'next/navigation';

export default function CandidateDetailPage() {
  const params = useParams();
  const candidateId = params.id as string;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Candidate Detail</h1>
      <p className="text-gray-600">후보자 ID: {candidateId}</p>
    </div>
  );
}
