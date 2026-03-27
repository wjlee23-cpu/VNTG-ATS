'use client';

import { useEffect, useState } from 'react';
import { FileText, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getEmailTemplates, type EmailTemplateItem } from '@/api/queries/email-templates';
import { createEmailTemplate } from '@/api/actions/email-templates';
import { toast } from 'sonner';

export function TemplatesClient() {
  const [isLoading, setIsLoading] = useState(true);
  const [templates, setTemplates] = useState<EmailTemplateItem[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    subject: '',
    body: '',
  });

  // 템플릿 목록을 서버에서 가져옵니다.
  const loadTemplates = async () => {
    setIsLoading(true);
    try {
      const result = await getEmailTemplates();
      if (result.error) {
        toast.error(result.error);
        setTemplates([]);
      } else {
        setTemplates(result.data || []);
      }
    } catch {
      toast.error('템플릿 목록을 불러오는 중 오류가 발생했습니다.');
      setTemplates([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates().catch(() => {});
  }, []);

  // 새 템플릿 생성 후 목록을 즉시 갱신합니다.
  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const result = await createEmailTemplate({
        name: form.name,
        subject: form.subject,
        body: form.body,
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('이메일 템플릿이 생성되었습니다.');
        setForm({ name: '', subject: '', body: '' });
        setIsCreateOpen(false);
        await loadTemplates();
      }
    } catch {
      toast.error('템플릿 생성 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-full overflow-auto">
      <div className="px-4 py-5 md:px-8 md:py-6">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-neutral-900 mb-2">
              Templates
            </h1>
            <p className="text-sm md:text-base text-neutral-600">이메일 템플릿을 생성하고 재사용하세요.</p>
          </div>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="px-5 py-2.5 bg-neutral-900 text-white rounded-lg text-sm font-medium hover:bg-neutral-800 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2"
          >
            <Plus size={18} />
            새 템플릿
          </button>
        </div>

        {isLoading ? (
          <div className="bg-white rounded-2xl border border-neutral-200 p-10 text-center text-neutral-500">
            템플릿을 불러오는 중입니다...
          </div>
        ) : templates.length === 0 ? (
          <div className="bg-white rounded-2xl border border-neutral-200 p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-4">
              <FileText className="text-neutral-400" size={32} />
            </div>
            <h2 className="text-xl font-semibold text-neutral-900 mb-2">템플릿이 없습니다</h2>
            <p className="text-neutral-600 mb-6">첫 이메일 템플릿을 생성해 빠르게 메일을 보내보세요.</p>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="px-5 py-2.5 bg-neutral-900 text-white rounded-lg text-sm font-medium hover:bg-neutral-800 active:scale-[0.98] transition-all duration-200"
            >
              첫 템플릿 만들기
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-neutral-100">
              <p className="text-sm text-neutral-600">총 {templates.length}개의 템플릿</p>
            </div>
            <div className="divide-y divide-neutral-100">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="px-5 py-4 transition-colors duration-200 hover:bg-blue-50/50"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center">
                      <FileText className="w-4 h-4 text-neutral-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-neutral-900 break-words">{template.name}</p>
                      <p className="mt-1 text-sm text-neutral-600 break-words">제목: {template.subject}</p>
                      <p className="mt-2 text-xs text-neutral-400">
                        수정일: {new Date(template.updated_at).toLocaleString('ko-KR')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[640px] rounded-2xl border-neutral-200 shadow-2xl backdrop-blur-sm">
          <DialogHeader>
            <DialogTitle className="text-neutral-900">새 이메일 템플릿 만들기</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateTemplate} className="space-y-4">
            <div>
              <label htmlFor="template_name" className="block text-sm font-medium text-neutral-700 mb-1.5">
                템플릿 이름
              </label>
              <input
                id="template_name"
                type="text"
                required
                maxLength={100}
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full bg-[#FCFCFC] border border-neutral-200 rounded-lg px-3 py-2.5 text-sm text-neutral-900 focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition-all"
                placeholder="예: 1차 면접 안내"
              />
            </div>
            <div>
              <label htmlFor="template_subject" className="block text-sm font-medium text-neutral-700 mb-1.5">
                이메일 제목
              </label>
              <input
                id="template_subject"
                type="text"
                required
                value={form.subject}
                onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
                className="w-full bg-[#FCFCFC] border border-neutral-200 rounded-lg px-3 py-2.5 text-sm text-neutral-900 focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition-all"
                placeholder="예: [VNTG] 1차 면접 일정 안내"
              />
            </div>
            <div>
              <label htmlFor="template_body" className="block text-sm font-medium text-neutral-700 mb-1.5">
                이메일 본문
              </label>
              <textarea
                id="template_body"
                required
                rows={10}
                value={form.body}
                onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
                className="w-full bg-[#FCFCFC] border border-neutral-200 rounded-lg px-3 py-2.5 text-sm text-neutral-900 focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition-all resize-y"
                placeholder="안녕하세요, {{candidate_name}}님."
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)} disabled={isSubmitting}>
                취소
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? '생성 중...' : '템플릿 생성'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
