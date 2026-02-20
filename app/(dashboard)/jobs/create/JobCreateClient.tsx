'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Briefcase, ArrowLeft, Save, User } from 'lucide-react';
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

interface JDRequest {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
}

interface User {
  id: string;
  email: string;
  role: string;
}

interface JobCreateClientProps {
  processes: Process[];
  jdRequests: JDRequest[];
  users: User[];
  error?: string;
}

export function JobCreateClient({ processes, jdRequests, users, error }: JobCreateClientProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    jd_request_id: '',
    title: '',
    description: '',
    process_id: '',
  });
  const [stageAssignees, setStageAssignees] = useState<Record<string, string[]>>({});

  // 프로세스 선택 시 전형별 담당자 설정 초기화
  useEffect(() => {
    if (formData.process_id) {
      const selectedProcess = processes.find(p => p.id === formData.process_id);
      if (selectedProcess && selectedProcess.stages) {
        const initialAssignees: Record<string, string[]> = {};
        (selectedProcess.stages as Array<{ id: string; name: string }>).forEach(stage => {
          initialAssignees[stage.id] = [];
        });
        setStageAssignees(initialAssignees);
      }
    }
  }, [formData.process_id, processes]);

  // JD 선택 시 제목과 설명 자동 입력
  const handleJDRequestChange = (jdRequestId: string) => {
    const selectedJD = jdRequests.find(jd => jd.id === jdRequestId);
    if (selectedJD) {
      setFormData({
        ...formData,
        jd_request_id: jdRequestId,
        title: selectedJD.title,
        description: selectedJD.description || '',
      });
    } else {
      setFormData({
        ...formData,
        jd_request_id: '',
      });
    }
  };

  // 전형별 담당자 추가/제거
  const toggleStageAssignee = (stageId: string, userId: string) => {
    setStageAssignees(prev => {
      const current = prev[stageId] || [];
      const isSelected = current.includes(userId);
      return {
        ...prev,
        [stageId]: isSelected
          ? current.filter(id => id !== userId)
          : [...current, userId],
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('title', formData.title);
      formDataToSend.append('description', formData.description);
      formDataToSend.append('process_id', formData.process_id);
      if (formData.jd_request_id) {
        formDataToSend.append('jd_request_id', formData.jd_request_id);
      }
      formDataToSend.append('stage_assignees', JSON.stringify(stageAssignees));

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

  // 선택된 프로세스의 전형 목록 가져오기
  const selectedProcess = processes.find(p => p.id === formData.process_id);
  const stages = selectedProcess?.stages as Array<{ id: string; name: string; order: number }> || [];

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
            {/* JD Request Selection */}
            {jdRequests.length > 0 && (
              <div>
                <label htmlFor="jd_request_id" className="block text-sm font-medium text-gray-700 mb-2">
                  승인된 JD 선택 (선택사항)
                </label>
                <select
                  id="jd_request_id"
                  value={formData.jd_request_id}
                  onChange={(e) => handleJDRequestChange(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">JD를 선택하세요 (선택사항)</option>
                  {jdRequests.map((jd) => (
                    <option key={jd.id} value={jd.id}>
                      {jd.title} {jd.category ? `(${jd.category})` : ''}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  승인된 JD를 선택하면 제목과 설명이 자동으로 입력됩니다.
                </p>
              </div>
            )}

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

            {/* Stage Assignees (각 전형별 담당자 설정) */}
            {formData.process_id && stages.length > 0 && (
              <div className="pt-4 border-t border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-4">
                  전형별 담당자 설정 <span className="text-red-500">*</span>
                </label>
                <div className="space-y-4">
                  {stages
                    .sort((a, b) => a.order - b.order)
                    .map((stage) => (
                      <div key={stage.id} className="p-4 bg-gray-50 rounded-lg">
                        <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                          <User className="w-4 h-4" />
                          {stage.name}
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {users.map((user) => {
                            const isSelected = (stageAssignees[stage.id] || []).includes(user.id);
                            return (
                              <button
                                key={user.id}
                                type="button"
                                onClick={() => toggleStageAssignee(stage.id, user.id)}
                                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                                  isSelected
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                }`}
                              >
                                {user.email.split('@')[0]}
                              </button>
                            );
                          })}
                        </div>
                        {users.length === 0 && (
                          <p className="text-xs text-gray-500 mt-2">
                            사용 가능한 담당자가 없습니다.
                          </p>
                        )}
                      </div>
                    ))}
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  각 전형별로 담당자를 선택하세요. 후보자가 해당 전형에 도달하면 자동으로 담당자가 지정됩니다.
                </p>
              </div>
            )}

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
                disabled={
                  isLoading || 
                  processes.length === 0 || 
                  !formData.process_id ||
                  (stages.length > 0 && Object.keys(stageAssignees).length === 0)
                }
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
