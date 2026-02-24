'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Briefcase, ArrowLeft, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createJob } from '@/api/actions/jobs';
import { toast } from 'sonner';
import { ProcessStageBuilder } from '@/components/jobs/ProcessStageBuilder';
import { CustomStage } from '@/types/job';

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
  jdRequests: JDRequest[];
  users: User[];
  error?: string;
}

export function JobCreateClient({ jdRequests, users, error }: JobCreateClientProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    jd_request_id: '',
    title: '',
    description: '',
  });
  const [customStages, setCustomStages] = useState<CustomStage[]>([]);

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

  // 단계 활성화/비활성화 토글
  const toggleStageEnabled = (stageId: string) => {
    setEnabledStages(prev => {
      if (prev.includes(stageId)) {
        // 비활성화 (최소 1개는 활성화되어야 함)
        if (prev.length <= 1) {
          return prev; // 마지막 단계는 비활성화할 수 없음
        }
        return prev.filter(id => id !== stageId);
      } else {
        // 활성화
        return [...prev, stageId];
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // custom_stages 검증
    if (customStages.length === 0) {
      toast.error('최소 1개 이상의 프로세스 단계를 선택해야 합니다.');
      return;
    }

    setIsLoading(true);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('title', formData.title);
      formDataToSend.append('description', formData.description);
      if (formData.jd_request_id) {
        formDataToSend.append('jd_request_id', formData.jd_request_id);
      }
      formDataToSend.append('custom_stages', JSON.stringify(customStages));

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
    <div className="h-full overflow-auto bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">뒤로 가기</span>
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">새 채용 공고 만들기</h1>
          </div>
          <p className="text-muted-foreground">채용 공고 정보를 입력하세요</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive">
            {error}
          </div>
        )}

        {/* Form */}
        <div className="card-modern p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* JD Request Selection */}
            {jdRequests.length > 0 && (
              <div>
                <label htmlFor="jd_request_id" className="block text-sm font-medium text-foreground mb-2">
                  승인된 JD 선택 (선택사항)
                </label>
                <select
                  id="jd_request_id"
                  value={formData.jd_request_id}
                  onChange={(e) => handleJDRequestChange(e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="">JD를 선택하세요 (선택사항)</option>
                  {jdRequests.map((jd) => (
                    <option key={jd.id} value={jd.id}>
                      {jd.title} {jd.category ? `(${jd.category})` : ''}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  승인된 JD를 선택하면 제목과 설명이 자동으로 입력됩니다.
                </p>
              </div>
            )}

            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-foreground mb-2">
                제목 <span className="text-destructive">*</span>
              </label>
              <input
                id="title"
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="예: 시니어 프론트엔드 개발자"
              />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-foreground mb-2">
                설명
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={8}
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="채용 공고 상세 설명을 입력하세요..."
              />
            </div>

            {/* Process Stage Builder */}
            <div className="pt-4 border-t border-border">
              <ProcessStageBuilder
                initialStages={customStages}
                users={users}
                onChange={setCustomStages}
              />
            </div>

            {/* Form Actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-4 border-t border-border">
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
                disabled={isLoading || customStages.length === 0}
                className="w-full sm:w-auto bg-primary hover:bg-primary/90"
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
