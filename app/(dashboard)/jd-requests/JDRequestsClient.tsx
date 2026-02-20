'use client';

import { FileText, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function JDRequestsClient() {
  const router = useRouter();

  const handleCreateRequest = () => {
    // TODO: JD 요청 생성 페이지가 구현되면 해당 경로로 이동
    // router.push('/jd-requests/create');
    alert('JD 요청 생성 기능은 곧 추가될 예정입니다.');
  };

  return (
    <div className="h-full overflow-auto">
      <div className="px-8 py-6">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">JD Requests</h1>
            <p className="text-gray-600">JD(Job Description) 요청을 관리하세요.</p>
          </div>
          <button
            onClick={handleCreateRequest}
            className="px-6 py-3 bg-brand-main text-white rounded-xl font-medium hover:bg-brand-dark transition-colors flex items-center gap-2"
          >
            <Plus size={18} />
            새 요청
          </button>
        </div>

        {/* Empty State */}
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <FileText className="text-gray-400" size={32} />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">JD 요청이 없습니다</h2>
          <p className="text-gray-600 mb-6">아직 등록된 JD 요청이 없습니다.</p>
          <button
            onClick={handleCreateRequest}
            className="px-6 py-3 bg-brand-main text-white rounded-xl font-medium hover:bg-brand-dark transition-colors"
          >
            첫 요청 만들기
          </button>
        </div>
      </div>
    </div>
  );
}
