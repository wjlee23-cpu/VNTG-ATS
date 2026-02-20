'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Briefcase, ArrowLeft, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createJob } from '@/api/actions/jobs';
import { toast } from 'sonner';

interface Process {
  id: string;
  name: string;
  organization_id: string;
  stages: Array<{
    id: string;
    name: string;
    order: number;
  }>;
  created_at: string;
  updated_at: string;
}

interface JobCreateClientProps {
  processes: Process[];
  error?: string;
}

export function JobCreateClient({ processes, error }: JobCreateClientProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    process_id: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('title', formData.title);
      formDataToSend.append('description', formData.description);
      formDataToSend.append('process_id', formData.process_id);

      const result = await createJob(formDataToSend);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('채용 공고가 생성되었습니다.');
        router.push(`/jobs/${result.data?.id}`);
        router.refresh();
      }
    } catch (error) {
      toast.error('채용 공고 생성에 실패했습니다.');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full overflow-auto bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">뒤로 가기</span>
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">새 채용 공고 만들기</h1>
          </div>
          <p className="text-gray-600">채용 공고 정보를 입력하세요</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
            {error}
          </div>
        )}

        {/* Form */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                제목 <span className="text-red-500">*</span>
              </label>
              <input
                id="title"
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="예: 시니어 프론트엔드 개발자"
              />
            </div>

            {/* Process Selection */}
            <div>
              <label htmlFor="process_id" className="block text-sm font-medium text-gray-700 mb-2">
                채용 프로세스 <span className="text-red-500">*</span>
              </label>
              {processes.length === 0 ? (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    사용 가능한 채용 프로세스가 없습니다. 먼저{' '}
                    <button
                      type="button"
                      onClick={() => router.push('/templates')}
                      className="text-blue-600 hover:text-blue-700 underline font-medium"
                    >
                      프로세스 템플릿
                    </button>
                    을 생성해주세요.
                  </p>
                </div>
              ) : (
                <select
                  id="process_id"
                  required
                  value={formData.process_id}
                  onChange={(e) => setFormData({ ...formData, process_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">프로세스를 선택하세요</option>
                  {processes.map((process) => (
                    <option key={process.id} value={process.id}>
                      {process.name} ({process.stages?.length || 0}단계)
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                설명
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={8}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="채용 공고 상세 설명을 입력하세요..."
              />
            </div>

            {/* Form Actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-4 border-t border-gray-200">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={isLoading}
                className="w-full sm:w-auto"
              >
                취소
              </Button>
              <Button
                type="submit"
                disabled={isLoading || processes.length === 0}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
              >
                <Save className="w-4 h-4 mr-2" />
                {isLoading ? '생성 중...' : '채용 공고 생성'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
