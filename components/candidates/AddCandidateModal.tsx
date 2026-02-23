'use client';

import { useState, useEffect } from 'react';
import { UserPlus, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { createCandidate } from '@/api/actions/candidates';
import { getJobs } from '@/api/queries/jobs';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface AddCandidateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface JobPost {
  id: string;
  title: string;
}

export function AddCandidateModal({
  isOpen,
  onClose,
}: AddCandidateModalProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [jobs, setJobs] = useState<JobPost[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    job_post_id: '',
  });

  // 채용 공고 목록 로드
  useEffect(() => {
    if (isOpen) {
      loadJobs();
    }
  }, [isOpen]);

  const loadJobs = async () => {
    setIsLoadingJobs(true);
    try {
      const result = await getJobs();
      if (result.error) {
        toast.error(result.error);
      } else {
        setJobs(result.data || []);
      }
    } catch (error) {
      toast.error('채용 공고 목록을 불러오는 중 오류가 발생했습니다.');
      console.error('Load jobs error:', error);
    } finally {
      setIsLoadingJobs(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('name', formData.name);
      formDataToSend.append('email', formData.email);
      formDataToSend.append('phone', formData.phone);
      formDataToSend.append('job_post_id', formData.job_post_id);

      const result = await createCandidate(formDataToSend);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('후보자가 추가되었습니다.');
        setFormData({
          name: '',
          email: '',
          phone: '',
          job_post_id: '',
        });
        onClose();
        router.refresh();
      }
    } catch (error) {
      toast.error('후보자 추가 중 오류가 발생했습니다.');
      console.error('Add candidate error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-blue-600" />
            후보자 추가
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="job_post_id" className="block text-sm font-medium text-gray-700 mb-2">
              채용 공고 <span className="text-red-500">*</span>
            </label>
            {isLoadingJobs ? (
              <div className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-500">
                로딩 중...
              </div>
            ) : (
              <select
                id="job_post_id"
                value={formData.job_post_id}
                onChange={(e) => setFormData({ ...formData, job_post_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">채용 공고를 선택하세요</option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              이름 <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="후보자 이름을 입력하세요"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              이메일 <span className="text-red-500">*</span>
            </label>
            <input
              id="email"
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="example@email.com"
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
              전화번호
            </label>
            <input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="010-1234-5678"
            />
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="w-full sm:w-auto"
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !formData.job_post_id || !formData.name || !formData.email}
              className="w-full sm:w-auto"
            >
              {isLoading ? '추가 중...' : '추가'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
