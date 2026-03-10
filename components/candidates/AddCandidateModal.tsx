'use client';

import { useState, useEffect, useRef } from 'react';
import { UserPlus, UploadCloud, X, FileText, Github, Linkedin, Link as LinkIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createCandidate } from '@/api/actions/candidates';
import { uploadResumeFile } from '@/api/actions/resume-files';
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [jobs, setJobs] = useState<JobPost[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    job_post_id: '',
    github_url: '',
    linkedin_url: '',
    portfolio_url: '',
  });

  // 채용 공고 목록 로드
  useEffect(() => {
    if (isOpen) {
      loadJobs();
      // 모달이 열릴 때 폼 초기화
      setFormData({
        name: '',
        email: '',
        phone: '',
        job_post_id: '',
        github_url: '',
        linkedin_url: '',
        portfolio_url: '',
      });
      setSelectedFile(null);
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

  // 파일 선택 핸들러
  const handleFileSelect = (file: File) => {
    // 파일 타입 검증
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    
    if (!fileExtension || !['pdf', 'doc', 'docx'].includes(fileExtension)) {
      toast.error('지원하지 않는 파일 형식입니다. PDF, DOC, DOCX만 업로드 가능합니다.');
      return;
    }

    if (!allowedTypes.includes(file.type) && fileExtension !== 'pdf' && fileExtension !== 'doc' && fileExtension !== 'docx') {
      toast.error('지원하지 않는 파일 형식입니다.');
      return;
    }

    setSelectedFile(file);
  };

  // 드래그 앤 드롭 핸들러
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  // 파일 입력 변경 핸들러
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  // 파일 제거 핸들러
  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // 후보자 생성
      const formDataToSend = new FormData();
      formDataToSend.append('name', formData.name);
      formDataToSend.append('email', formData.email);
      formDataToSend.append('phone', formData.phone);
      formDataToSend.append('job_post_id', formData.job_post_id);

      const result = await createCandidate(formDataToSend);

      if (result.error) {
        toast.error(result.error);
        setIsLoading(false);
        return;
      }

      // 후보자 생성 성공 후 파일 업로드
      if (selectedFile && result.data?.id) {
        try {
          const fileFormData = new FormData();
          fileFormData.append('file', selectedFile);
          
          const uploadResult = await uploadResumeFile(result.data.id, fileFormData);
          
          if (uploadResult.error) {
            toast.warning('후보자는 추가되었지만 파일 업로드에 실패했습니다: ' + uploadResult.error);
          } else {
            toast.success('후보자와 파일이 성공적으로 추가되었습니다.');
          }
        } catch (uploadError) {
          console.error('File upload error:', uploadError);
          toast.warning('후보자는 추가되었지만 파일 업로드 중 오류가 발생했습니다.');
        }
      } else {
        toast.success('후보자가 추가되었습니다.');
      }

      // 폼 초기화
      setFormData({
        name: '',
        email: '',
        phone: '',
        job_post_id: '',
        github_url: '',
        linkedin_url: '',
        portfolio_url: '',
      });
      setSelectedFile(null);
      onClose();
      router.refresh();
    } catch (error) {
      toast.error('후보자 추가 중 오류가 발생했습니다.');
      console.error('Add candidate error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
            <UserPlus className="w-6 h-6 text-primary" />
            후보자 추가
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 채용 공고 선택 */}
          <div>
            <Label htmlFor="job_post_id" className="text-sm font-medium text-foreground mb-2 block">
              채용 공고 <span className="text-red-500">*</span>
            </Label>
            {isLoadingJobs ? (
              <div className="px-3 py-2.5 bg-slate-50 border-transparent rounded-lg text-sm text-muted-foreground">
                로딩 중...
              </div>
            ) : (
              <select
                id="job_post_id"
                value={formData.job_post_id}
                onChange={(e) => setFormData({ ...formData, job_post_id: e.target.value })}
                className="w-full px-3 py-2.5 bg-slate-50 border-transparent rounded-lg text-sm text-foreground focus:bg-white focus:ring-2 focus:ring-brand-main/20 focus:border-brand-main transition-colors duration-200"
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

          {/* 이름, 이메일, 전화번호 - 2단 그리드 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name" className="text-sm font-medium text-foreground mb-2 block">
                이름 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-brand-main/20 focus:border-brand-main transition-colors duration-200"
                placeholder="후보자 이름을 입력하세요"
              />
            </div>

            <div>
              <Label htmlFor="email" className="text-sm font-medium text-foreground mb-2 block">
                이메일 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-brand-main/20 focus:border-brand-main transition-colors duration-200"
                placeholder="example@email.com"
              />
            </div>

            <div>
              <Label htmlFor="phone" className="text-sm font-medium text-foreground mb-2 block">
                전화번호
              </Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-brand-main/20 focus:border-brand-main transition-colors duration-200"
                placeholder="010-1234-5678"
              />
            </div>
          </div>

          {/* 파일 업로드 영역 - Drag & Drop 스타일 */}
          <div>
            <Label className="text-sm font-medium text-foreground mb-2 block">
              이력서 및 포트폴리오
            </Label>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`w-full p-8 border-2 border-dashed rounded-lg cursor-pointer transition-all duration-200 ${
                isDragging
                  ? 'border-primary bg-primary/5'
                  : selectedFile
                  ? 'border-primary bg-primary/5'
                  : 'border-slate-200 bg-slate-50 hover:border-primary'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={handleFileInputChange}
                className="hidden"
              />
              {selectedFile ? (
                <div className="flex items-center gap-3">
                  <FileText className="w-8 h-8 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024).toFixed(0)} KB
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveFile();
                    }}
                    className="p-1 hover:bg-slate-200 rounded transition-colors"
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3">
                  <UploadCloud className="w-12 h-12 text-muted-foreground" />
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground mb-1">
                      파일을 드래그하거나 클릭하여 업로드
                    </p>
                    <p className="text-xs text-muted-foreground">
                      PDF, DOC, DOCX 파일만 지원됩니다
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 링크 필드 - GitHub, LinkedIn, Portfolio */}
          <div className="space-y-4">
            <Label className="text-sm font-medium text-foreground block">
              링크 (선택 사항)
            </Label>
            <div className="space-y-3">
              <div>
                <Label htmlFor="github_url" className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
                  <Github className="w-3.5 h-3.5" />
                  GitHub
                </Label>
                <Input
                  id="github_url"
                  type="url"
                  value={formData.github_url}
                  onChange={(e) => setFormData({ ...formData, github_url: e.target.value })}
                  className="bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-brand-main/20 focus:border-brand-main transition-colors duration-200"
                  placeholder="https://github.com/username"
                />
              </div>
              <div>
                <Label htmlFor="linkedin_url" className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
                  <Linkedin className="w-3.5 h-3.5" />
                  LinkedIn
                </Label>
                <Input
                  id="linkedin_url"
                  type="url"
                  value={formData.linkedin_url}
                  onChange={(e) => setFormData({ ...formData, linkedin_url: e.target.value })}
                  className="bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-brand-main/20 focus:border-brand-main transition-colors duration-200"
                  placeholder="https://linkedin.com/in/username"
                />
              </div>
              <div>
                <Label htmlFor="portfolio_url" className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
                  <LinkIcon className="w-3.5 h-3.5" />
                  포트폴리오
                </Label>
                <Input
                  id="portfolio_url"
                  type="url"
                  value={formData.portfolio_url}
                  onChange={(e) => setFormData({ ...formData, portfolio_url: e.target.value })}
                  className="bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-brand-main/20 focus:border-brand-main transition-colors duration-200"
                  placeholder="https://portfolio.example.com"
                />
              </div>
            </div>
          </div>

          {/* Footer - 액션 버튼 */}
          <DialogFooter className="border-t border-slate-100 bg-slate-50 -mx-6 -mb-6 px-6 py-4 mt-6">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-0 sm:justify-end w-full">
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
                className="w-full sm:w-auto bg-gradient-to-r from-[#0248FF] to-[#5287FF] hover:from-[#0248FF]/90 hover:to-[#5287FF]/90 text-white shadow-md hover:shadow-lg transition-all duration-200"
              >
                {isLoading ? '추가 중...' : '추가'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
