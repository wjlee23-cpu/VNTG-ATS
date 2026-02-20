import { getJobById } from '@/api/queries/jobs';
import { getCandidatesByJobPost } from '@/api/queries/candidates';
import { getJobStats } from '@/api/queries/jobs';
import { JobDetailClient } from './JobDetailClient';
import { validateUUID } from '@/api/utils/validation';
import { ValidationError } from '@/api/utils/errors';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  // Next.js 15+ 호환: params가 Promise일 수 있음
  const resolvedParams = await (params instanceof Promise ? params : Promise.resolve(params));
  const jobId = resolvedParams?.id;

  // ID가 없는 경우 먼저 체크
  if (!jobId || jobId.trim().length === 0) {
    return (
      <div className="h-full overflow-auto">
        <div className="px-8 py-6">
          <div className="mb-6">
            <Link
              href="/jobs"
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
            >
              <ArrowLeft size={18} />
              채용 공고 목록으로 돌아가기
            </Link>
          </div>
          <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Job Detail</h1>
            <p className="text-red-600 text-lg mb-6">
              잘못된 채용 공고 링크입니다. 올바른 링크를 사용해주세요.
            </p>
            <div className="flex gap-4">
              <Link
                href="/jobs"
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                채용 공고 목록
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
    validateUUID(jobId.trim(), '채용 공고 ID');
  } catch (error) {
    // UUID 형식이 아니어도 일단 데이터 조회를 시도
    // 실제 데이터가 없으면 그때 에러 표시
  }

  const [jobResult, candidatesResult, statsResult] = await Promise.all([
    getJobById(jobId.trim()),
    getCandidatesByJobPost(jobId.trim()),
    getJobStats(),
  ]);

  const job = jobResult.data;
  const candidates = candidatesResult.data || [];
  const stats = statsResult.data;

  if (jobResult.error || !job) {
    return (
      <div className="h-full overflow-auto">
        <div className="px-8 py-6">
          <div className="mb-6">
            <Link
              href="/jobs"
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
            >
              <ArrowLeft size={18} />
              채용 공고 목록으로 돌아가기
            </Link>
          </div>
          <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Job Detail</h1>
            <p className="text-red-600 text-lg mb-6">
              {jobResult.error || '채용 공고를 찾을 수 없습니다.'}
            </p>
            {process.env.NODE_ENV === 'development' && jobResult.error && (
              <p className="text-xs text-gray-500 mt-2">ID: {jobId}</p>
            )}
            <div className="flex gap-4">
              <Link
                href="/jobs"
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                채용 공고 목록
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <JobDetailClient
      job={job}
      candidates={candidates}
      stats={stats}
    />
  );
}
