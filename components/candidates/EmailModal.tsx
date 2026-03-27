'use client';

import { useEffect, useState } from 'react';
import { Mail, Send } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { sendEmailToCandidate } from '@/api/actions/emails';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { getEmailTemplates, type EmailTemplateItem } from '@/api/queries/email-templates';

interface EmailModalProps {
  candidateId: string;
  candidateEmail: string;
  candidateName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function EmailModal({
  candidateId,
  candidateEmail,
  candidateName,
  isOpen,
  onClose,
}: EmailModalProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [templates, setTemplates] = useState<EmailTemplateItem[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [formData, setFormData] = useState({
    subject: '',
    body: '',
  });

  // 모달이 열릴 때 템플릿 목록을 조회합니다.
  useEffect(() => {
    const loadTemplates = async () => {
      setIsLoadingTemplates(true);
      try {
        const result = await getEmailTemplates();
        if (result.error) {
          toast.error(result.error);
          setTemplates([]);
        } else {
          setTemplates(result.data || []);
        }
      } catch {
        toast.error('이메일 템플릿을 불러오지 못했습니다.');
        setTemplates([]);
      } finally {
        setIsLoadingTemplates(false);
      }
    };

    if (isOpen) {
      loadTemplates().catch(() => {});
    } else {
      setSelectedTemplateId('');
    }
  }, [isOpen]);

  // 선택한 템플릿의 제목/본문을 폼에 즉시 적용합니다.
  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (!templateId) return;

    const selectedTemplate = templates.find((template) => template.id === templateId);
    if (!selectedTemplate) return;

    setFormData({
      subject: selectedTemplate.subject,
      body: selectedTemplate.body,
    });
    toast.success(`"${selectedTemplate.name}" 템플릿이 적용되었습니다.`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('candidate_id', candidateId);
      formDataToSend.append('to_email', candidateEmail);
      formDataToSend.append('subject', formData.subject);
      formDataToSend.append('body', formData.body);

      const result = await sendEmailToCandidate(formDataToSend);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('이메일이 발송되었습니다.');
        setFormData({ subject: '', body: '' });
        setSelectedTemplateId('');
        onClose();
        router.refresh();
      }
    } catch (error) {
      toast.error('이메일 발송에 실패했습니다.');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Send Email</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="template_select" className="block text-sm font-medium text-gray-700 mb-1">
              이메일 템플릿
            </label>
            <select
              id="template_select"
              value={selectedTemplateId}
              onChange={(e) => handleTemplateChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoadingTemplates || isLoading}
            >
              <option value="">
                {isLoadingTemplates ? '템플릿 불러오는 중...' : '직접 작성 (템플릿 미적용)'}
              </option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Mail className="w-4 h-4 inline mr-1" />
              수신자
            </label>
            <p className="text-sm text-gray-900">{candidateName} ({candidateEmail})</p>
          </div>

          <div>
            <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">
              제목
            </label>
            <input
              id="subject"
              type="text"
              required
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="이메일 제목을 입력하세요"
            />
          </div>

          <div>
            <label htmlFor="body" className="block text-sm font-medium text-gray-700 mb-1">
              내용
            </label>
            <textarea
              id="body"
              required
              value={formData.body}
              onChange={(e) => setFormData({ ...formData, body: e.target.value })}
              rows={8}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="이메일 내용을 입력하세요"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              취소
            </Button>
            <Button type="submit" disabled={isLoading}>
              <Send className="w-4 h-4 mr-2" />
              {isLoading ? '발송 중...' : '발송'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
