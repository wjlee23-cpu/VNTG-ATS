'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, ArrowLeft, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createJDRequest } from '@/api/actions/jd-requests';
import { toast } from 'sonner';

export function JDRequestCreateClient() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('title', formData.title);
      formDataToSend.append('description', formData.description);
      formDataToSend.append('category', formData.category);
      formDataToSend.append('priority', formData.priority);

      const result = await createJDRequest(formDataToSend);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('JD 요청이 제출되었습니다. 관리자의 승인을 기다려주세요.');
        router.push('/jd-requests');
        router.refresh();
      }
    } catch (error) {
      toast.error('JD 요청 제출에 실패했습니다.');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full overflow-auto bg-[#FAFAFA]">
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
              <FileText className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">새 JD 요청</h1>
          </div>
          <p className="text-gray-600">채용 담당자에게 JD 작성 요청을 제출하세요</p>
        </div>

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

            {/* Category */}
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
                카테고리
              </label>
              <input
                id="category"
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="예: Engineering, Product, Design"
              />
            </div>

            {/* Priority */}
            <div>
              <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-2">
                우선순위 <span className="text-red-500">*</span>
              </label>
              <select
                id="priority"
                required
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as 'low' | 'medium' | 'high' })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="low">낮음</option>
                <option value="medium">보통</option>
                <option value="high">높음</option>
              </select>
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
                placeholder="JD 요청에 대한 상세 설명을 입력하세요..."
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
                disabled={isLoading}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
              >
                <Save className="w-4 h-4 mr-2" />
                {isLoading ? '제출 중...' : 'JD 요청 제출'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
