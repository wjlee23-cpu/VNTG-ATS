import { getCandidateById } from '@/api/queries/candidates';
import { getSchedulesByCandidate } from '@/api/queries/schedules';
import { getTimelineEvents } from '@/api/queries/timeline';
import { CandidateDetailClient } from './CandidateDetailClient';
import { validateUUID } from '@/api/utils/validation';
import { ValidationError } from '@/api/utils/errors';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default async function CandidateDetailPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  // Next.js 15+ 호환: params가 Promise일 수 있음
  const resolvedParams = await (params instanceof Promise ? params : Promise.resolve(params));
  const candidateId = resolvedParams?.id;

  // ID가 없는 경우 먼저 체크
  if (!candidateId || candidateId.trim().length === 0) {
    return (
      <div className="h-full overflow-auto">
        <div className="px-8 py-6">
          <div className="mb-6">
            <Link
              href="/candidates"
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
            >
              <ArrowLeft size={18} />
              후보자 목록으로 돌아가기
            </Link>
          </div>
          <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Candidate Detail</h1>
            <p className="text-red-600 text-lg mb-6">
              잘못된 후보자 링크입니다. 올바른 링크를 사용해주세요.
            </p>
            <div className="flex gap-4">
              <Link
                href="/candidates"
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                후보자 목록
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ID 유효성 검사 (UUID 형식이 아니어도 일단 데이터 조회 시도)
  let idValidationError: string | null = null;
  try {
    validateUUID(candidateId.trim(), '후보자 ID');
  } catch (error) {
    // UUID 형식이 아니어도 일단 데이터 조회를 시도
    // 실제 데이터가 없으면 그때 에러 표시
  }

  const [candidateResult, schedulesResult, timelineResult] = await Promise.all([
    getCandidateById(candidateId.trim()),
    getSchedulesByCandidate(candidateId.trim()),
    getTimelineEvents(candidateId.trim()),
  ]);

  const candidate = candidateResult.data;
  const schedules = schedulesResult.data || [];
  
  // 타임라인 이벤트 조회 결과 확인
  if (timelineResult.error) {
    console.error('타임라인 이벤트 조회 실패:', timelineResult.error);
  }
  const timelineEvents = timelineResult.data || [];
  
  // 디버깅: 타임라인 이벤트 개수 확인
  if (process.env.NODE_ENV === 'development') {
    console.log(`[타임라인 조회] 후보자 ID: ${candidateId}, 이벤트 개수: ${timelineEvents.length}`);
  }

  if (candidateResult.error || !candidate) {
    return (
      <div className="h-full overflow-auto">
        <div className="px-8 py-6">
          <div className="mb-6">
            <Link
              href="/candidates"
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
            >
              <ArrowLeft size={18} />
              후보자 목록으로 돌아가기
            </Link>
          </div>
          <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Candidate Detail</h1>
            <p className="text-red-600 text-lg mb-6">
              {candidateResult.error || '후보자를 찾을 수 없습니다.'}
            </p>
            {process.env.NODE_ENV === 'development' && candidateResult.error && (
              <p className="text-xs text-gray-500 mt-2">ID: {candidateId}</p>
            )}
            <div className="flex gap-4">
              <Link
                href="/candidates"
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                후보자 목록
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <CandidateDetailClient
      candidate={candidate}
      schedules={schedules}
      timelineEvents={timelineEvents}
    />
  );
}
