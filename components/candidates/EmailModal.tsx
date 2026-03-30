'use client';

import { useEffect, useState } from 'react';
import { ChevronsUpDown, Eye, Image, Loader2, Paperclip, Send, X } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
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
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-[640px] gap-0 overflow-hidden rounded-2xl border-neutral-200 p-0 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.2)] [&>button]:hidden">
        <div className="relative flex flex-col bg-white">
          <div className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-neutral-300 to-transparent opacity-50" />

          <div className="z-10 flex items-center justify-between bg-white px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200/50 bg-neutral-100/80 shadow-sm">
                <Send className="h-4 w-4 text-neutral-700" />
              </div>
              <div>
                <h2 className="text-sm font-bold tracking-tight text-neutral-900">이메일 발송</h2>
                <p className="text-[11px] font-medium text-neutral-400">후보자에게 직접 메시지를 보냅니다.</p>
              </div>
            </div>
            <button
              type="button"
              className="rounded-lg p-2 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
              onClick={onClose}
              aria-label="모달 닫기"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="max-h-[70vh] space-y-6 overflow-y-auto p-6 pt-2">
              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                  To (수신자)
                </label>
                <div className="flex items-center justify-between rounded-xl border border-neutral-200/80 bg-neutral-50/50 p-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-900 text-xs font-bold text-white shadow-inner">
                      {candidateName.slice(0, 1)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-neutral-900">{candidateName}</p>
                      <p className="text-xs font-medium text-neutral-500">{candidateEmail}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-[10px] font-bold text-neutral-500 shadow-sm">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    검증됨
                  </div>
                </div>
              </div>

              <div className="group">
                <label
                  htmlFor="template_select"
                  className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-neutral-400 transition-colors group-focus-within:text-neutral-900"
                >
                  템플릿 적용
                </label>
                <div className="relative">
                  <select
                    id="template_select"
                    value={selectedTemplateId}
                    onChange={(e) => handleTemplateChange(e.target.value)}
                    className="pro-input w-full cursor-pointer appearance-none rounded-xl border border-neutral-200 px-4 py-3 text-sm font-semibold text-neutral-900 shadow-sm"
                    disabled={isLoadingTemplates || isLoading}
                  >
                    <option value="">
                      {isLoadingTemplates ? '템플릿 불러오는 중...' : '직접 작성 (템플릿 미적용)'}
                    </option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id} className="font-medium">
                        {template.name}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
                    <span className="rounded border border-neutral-200 bg-neutral-100 px-1.5 py-0.5 text-[10px] font-bold text-neutral-400">
                      ⌘K
                    </span>
                    <ChevronsUpDown className="h-4 w-4 text-neutral-400" />
                  </div>
                </div>
              </div>

              <hr className="border-neutral-100" />

              <div className="space-y-4">
                <div className="group">
                  <label
                    htmlFor="subject"
                    className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-neutral-400 transition-colors group-focus-within:text-neutral-900"
                  >
                    제목
                  </label>
                  <input
                    id="subject"
                    type="text"
                    required
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="pro-input w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-900 placeholder:text-neutral-400"
                    placeholder="이메일 제목을 입력하세요"
                    disabled={isLoading}
                  />
                </div>

                <div className="group">
                  <label
                    htmlFor="body"
                    className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-neutral-400 transition-colors group-focus-within:text-neutral-900"
                  >
                    내용
                  </label>
                  <div className="relative overflow-hidden rounded-xl border border-neutral-200 bg-[#FCFCFC] transition-all group-focus-within:border-neutral-900 group-focus-within:bg-white group-focus-within:ring-1 group-focus-within:ring-neutral-900 group-focus-within:shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
                    <textarea
                      id="body"
                      required
                      value={formData.body}
                      onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                      rows={8}
                      className="w-full resize-none bg-transparent border-0 p-4 text-sm leading-relaxed text-neutral-800 outline-none placeholder:text-neutral-400"
                      placeholder="이메일 내용을 입력하세요"
                      disabled={isLoading}
                    />

                    <div className="flex items-center justify-between border-t border-neutral-100 bg-neutral-50/50 px-3 py-2">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-neutral-200/60 hover:text-neutral-900"
                          aria-label="첨부파일"
                        >
                          <Paperclip className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-neutral-200/60 hover:text-neutral-900"
                          aria-label="이미지 첨부"
                        >
                          <Image className="h-4 w-4" />
                        </button>
                      </div>
                      <span className="text-[10px] font-medium text-neutral-400">마크다운 지원됨</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="z-10 flex items-center justify-between border-t border-neutral-100 bg-white px-6 py-5">
              <button
                type="button"
                className="group flex items-center gap-2 rounded-xl p-2.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
                title="미리보기"
              >
                <Eye className="h-4 w-4 transition-transform group-hover:scale-110" />
                <span className="text-xs font-semibold">미리보기</span>
              </button>

              <div className="flex gap-3">
                <button
                  type="button"
                  className="rounded-xl px-5 py-2.5 text-sm font-semibold text-neutral-500 transition-colors hover:bg-neutral-50 hover:text-neutral-900"
                  onClick={onClose}
                  disabled={isLoading}
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex items-center gap-2 rounded-xl bg-neutral-900 px-6 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(0,0,0,0.15)] transition-all hover:bg-neutral-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      발송 중...
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      이메일 발송
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
