'use client';

import { useEffect, useState } from 'react';
import { ChevronsUpDown, Eye, Loader2, Send, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { sendEmailToCandidate } from '@/api/actions/emails';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { getEmailTemplates, type EmailTemplateItem } from '@/api/queries/email-templates';
import { getCandidateById } from '@/api/queries/candidates';
import { getMyOrganization } from '@/api/queries/organizations';
import { getStageNameByStageId } from '@/constants/stages';
import { applyEmailTemplate, type EmailTemplateContext } from '@/lib/email/template';
import { normalizeEmailBodyToHtml, renderThemedEmailHtmlFromHtml } from '@/lib/email/render-themed-email';
import { sanitizeEmailHtml } from '@/lib/email/sanitize';
import { EmailHtmlEditor } from '@/components/email/EmailHtmlEditor';

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
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [templateContext, setTemplateContext] = useState<EmailTemplateContext>({
    candidate: { name: candidateName, email: candidateEmail },
  });
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

    const loadContext = async () => {
      try {
        // 템플릿 치환에 필요한 후보자/포지션/전형 정보를 조회합니다.
        const candidateResult = await getCandidateById(candidateId);
        const candidateRow = candidateResult.data as any;
        const jobTitle = candidateRow?.job_posts?.title || '';
        const stageId = candidateRow?.current_stage_id || '';
        const stageName = stageId ? getStageNameByStageId(stageId) || stageId : '';

        // 조직명은 현재 사용자 기준으로 조회합니다.
        const orgResult = await getMyOrganization();
        const orgName = orgResult.data?.name || '';

        setTemplateContext({
          candidate: {
            name: candidateRow?.name ?? candidateName,
            email: candidateRow?.email ?? candidateEmail,
            phone: candidateRow?.phone ?? '',
            status: candidateRow?.status ?? '',
          },
          job: { title: jobTitle },
          stage: { id: stageId, name: stageName },
          organization: { name: orgName },
        });
      } catch {
        // 컨텍스트 조회에 실패해도 메일 발송은 가능해야 합니다.
        // - 대신 치환 토큰은 빈 문자열로 처리됩니다.
        setTemplateContext({
          candidate: { name: candidateName, email: candidateEmail },
        });
      }
    };

    if (isOpen) {
      loadTemplates().catch(() => {});
      loadContext().catch(() => {});
    } else {
      setSelectedTemplateId('');
    }
  }, [isOpen, candidateId, candidateEmail, candidateName]);

  // 선택한 템플릿의 제목/본문을 폼에 즉시 적용합니다.
  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (!templateId) return;

    const selectedTemplate = templates.find((template) => template.id === templateId);
    if (!selectedTemplate) return;

    setFormData({
      subject: applyEmailTemplate(selectedTemplate.subject, templateContext),
      body: applyEmailTemplate(selectedTemplate.body, templateContext),
    });
    toast.success(`"${selectedTemplate.name}" 템플릿이 적용되었습니다.`);
  };

  const finalSubject = applyEmailTemplate(formData.subject, templateContext);
  const finalBodyRaw = applyEmailTemplate(formData.body, templateContext);
  const orgNameForPreview = templateContext.organization?.name || 'VNTG ATS';
  const normalizedBodyHtmlForPreview = normalizeEmailBodyToHtml(finalBodyRaw);
  const sanitizedBodyHtmlForPreview = sanitizeEmailHtml(normalizedBodyHtmlForPreview);
  const finalBodyHtmlForPreview = sanitizeEmailHtml(
    renderThemedEmailHtmlFromHtml({
      subject: finalSubject,
      bodyHtml: sanitizedBodyHtmlForPreview,
      organizationName: orgNameForPreview,
    })
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // 사용자가 템플릿 적용 후 직접 토큰을 추가/수정했을 수 있으므로,
      // 발송 직전에 한 번 더 치환을 적용합니다.
      const finalBody = finalBodyRaw;

      const formDataToSend = new FormData();
      formDataToSend.append('candidate_id', candidateId);
      formDataToSend.append('to_email', candidateEmail);
      formDataToSend.append('subject', finalSubject);
      formDataToSend.append('body', finalBody);

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
      <DialogContent className="max-w-[800px] gap-0 overflow-hidden rounded-2xl border-neutral-200 p-0 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.2)] backdrop-blur-sm [&>button]:hidden">
        {/* 접근성: Radix DialogContent는 DialogTitle을 요구합니다. (화면에는 숨김) */}
        <DialogTitle className="sr-only">이메일 발송</DialogTitle>
        <div className="flex w-full flex-col overflow-hidden bg-white">
          <div className="flex items-center justify-between border-b border-neutral-100 px-8 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100">
                <Send className="h-4 w-4 text-neutral-700" />
              </div>
              <div>
                <h2 className="text-base font-bold text-neutral-900">이메일 발송</h2>
                <p className="text-[11px] font-medium text-neutral-400">후보자에게 직접 메시지를 보냅니다.</p>
              </div>
            </div>
            <button
              type="button"
              className="rounded-lg p-2 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
              onClick={onClose}
              aria-label="모달 닫기"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="max-h-[75vh] space-y-6 overflow-y-auto p-8">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                    To (수신자)
                  </label>
                  <div className="flex items-center justify-between rounded-xl border border-neutral-200 bg-[#FCFCFC] p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-900 text-xs font-bold text-white">
                        {candidateName.slice(0, 1)}
                      </div>
                      <div>
                        <p className="mb-1 text-sm font-bold leading-none text-neutral-900">{candidateName}</p>
                        <p className="text-xs font-medium leading-none text-neutral-500">{candidateEmail}</p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded border border-emerald-100 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      검증됨
                    </span>
                  </div>
                </div>

                <div className="group">
                  <label
                    htmlFor="template_select"
                    className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-neutral-400 transition-colors group-focus-within:text-neutral-900"
                  >
                    템플릿 적용
                  </label>
                  <div className="relative">
                    <select
                      id="template_select"
                      value={selectedTemplateId}
                      onChange={(e) => handleTemplateChange(e.target.value)}
                      className="pro-input w-full cursor-pointer appearance-none rounded-xl border border-neutral-200 bg-[#FCFCFC] px-4 py-3.5 text-sm font-semibold text-neutral-900 transition-all"
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
                      <span className="rounded border border-neutral-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-neutral-400">
                        ⌘K
                      </span>
                      <ChevronsUpDown className="h-4 w-4 text-neutral-400" />
                    </div>
                  </div>
                </div>
              </div>

              <hr className="border-neutral-100" />

              <div className="space-y-4">
                <div className="group">
                  <label
                    htmlFor="subject"
                    className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-neutral-400 transition-colors group-focus-within:text-neutral-900"
                  >
                    제목
                  </label>
                  <input
                    id="subject"
                    type="text"
                    required
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="pro-input w-full rounded-xl border border-neutral-200 bg-[#FCFCFC] px-4 py-3 text-sm font-medium text-neutral-900 transition-all placeholder:text-neutral-400"
                    placeholder="이메일 제목을 입력하세요"
                    disabled={isLoading}
                  />
                </div>

                <div className="group">
                  <div className="mb-2 flex items-center justify-between">
                    <label
                      htmlFor="body"
                      className="block text-[10px] font-bold uppercase tracking-widest text-neutral-400 transition-colors group-focus-within:text-neutral-900"
                    >
                      내용
                    </label>
                  </div>

                  <div className="flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-[#FCFCFC] transition-all focus-within:border-neutral-900 focus-within:ring-1 focus-within:ring-neutral-900">
                    <div className="p-5">
                      <EmailHtmlEditor
                        value={formData.body}
                        onChange={(next) => setFormData((prev) => ({ ...prev, body: next }))}
                        disabled={isLoading}
                        placeholder="이메일 내용을 입력하세요..."
                        minEditorHeightPx={260}
                        showModeTabs
                        showToolbar
                        showHelperText={false}
                      />
                    </div>

                    <div className="flex items-center justify-between border-t border-neutral-100 bg-white px-4 py-2.5">
                      <button
                        type="button"
                        className="flex items-center gap-2 text-sm font-semibold text-neutral-500 transition-colors hover:text-neutral-900 disabled:opacity-60"
                        onClick={() => setIsPreviewOpen(true)}
                        disabled={isLoading}
                      >
                        <Eye className="h-4 w-4" />
                        미리보기
                      </button>
                      <span className="text-[10px] font-medium text-neutral-400">하단 바 중심으로 정리된 작성 환경</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-neutral-100 bg-neutral-50/50 px-8 py-5">
              <button
                type="button"
                className="flex items-center gap-2 text-sm font-semibold text-neutral-500 transition-colors hover:text-neutral-900"
                onClick={() => setIsPreviewOpen(true)}
                disabled={isLoading}
              >
                <Eye className="h-4 w-4" />
                미리보기
              </button>
              <div className="flex gap-3">
                <button
                  type="button"
                  className="rounded-xl px-5 py-2.5 text-sm font-semibold text-neutral-600 transition-colors hover:bg-neutral-200"
                  onClick={onClose}
                  disabled={isLoading}
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex items-center gap-2 rounded-xl bg-neutral-900 px-6 py-2.5 text-sm font-semibold text-white shadow-[0_4px_12px_rgba(0,0,0,0.1)] transition-all hover:bg-neutral-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      발송 중...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      이메일 발송
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </DialogContent>

      <EmailPreviewDialog
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        subject={finalSubject}
        html={finalBodyHtmlForPreview}
      />
    </Dialog>
  );
}

export function EmailPreviewDialog({
  open,
  onOpenChange,
  subject,
  html,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subject: string;
  html: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[820px] gap-0 overflow-hidden rounded-2xl border-neutral-200 p-0 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.2)] [&>button]:hidden">
        {/* 접근성: Radix DialogContent는 DialogTitle을 요구합니다. (화면에는 숨김) */}
        <DialogTitle className="sr-only">이메일 미리보기</DialogTitle>
        <div className="relative flex flex-col bg-white">
          <div className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-neutral-300 to-transparent opacity-50" />

          <div className="z-10 flex items-center justify-between bg-white px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200/50 bg-neutral-100/80 shadow-sm">
                <Eye className="h-4 w-4 text-neutral-700" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold tracking-tight text-neutral-900">미리보기</h2>
                <p className="mt-0.5 truncate text-[11px] font-medium text-neutral-400">
                  제목: {subject || '(제목 없음)'}
                </p>
              </div>
            </div>
            <button
              type="button"
              className="rounded-lg p-2 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
              onClick={() => onOpenChange(false)}
              aria-label="모달 닫기"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[75vh] overflow-y-auto p-6 pt-2">
            <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
              <div className="border-b border-neutral-100 bg-neutral-50/50 px-5 py-3">
                <p className="text-xs font-bold uppercase tracking-widest text-neutral-400">Body</p>
              </div>
              <div
                className="prose prose-sm max-w-none p-5 text-neutral-800"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
