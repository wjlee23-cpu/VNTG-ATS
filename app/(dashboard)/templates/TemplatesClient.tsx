'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bold,
  Briefcase,
  FileText,
  Italic,
  LayoutTemplate,
  Link2,
  List,
  Loader2,
  Plus,
  Underline,
  User,
  X,
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { getEmailTemplates, type EmailTemplateItem } from '@/api/queries/email-templates';
import { createEmailTemplate } from '@/api/actions/email-templates';
import { toast } from 'sonner';
import {
  EMAIL_TEMPLATE_VARIABLES,
  EMAIL_TEMPLATE_VARIABLE_GROUP_LABEL,
  type EmailTemplateVariableGroupId,
} from '@/constants/email-template-variables';

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
  const bodyTextareaRef = useRef<HTMLTextAreaElement | null>(null);

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

  const variablesByGroup = useMemo(() => {
    const map: Record<EmailTemplateVariableGroupId, typeof EMAIL_TEMPLATE_VARIABLES> = {
      candidate: [],
      job: [],
      stage: [],
      organization: [],
    } as any;
    for (const item of EMAIL_TEMPLATE_VARIABLES) {
      (map[item.groupId] as any).push(item);
    }
    return map;
  }, []);

  const insertTokenToBody = (token: string) => {
    // 사용자가 템플릿을 빠르게 작성할 수 있도록, 현재 커서 위치에 토큰을 삽입합니다.
    const el = bodyTextareaRef.current;
    const current = form.body || '';

    if (!el) {
      setForm((prev) => ({ ...prev, body: `${current}${token}` }));
      return;
    }

    const start = el.selectionStart ?? current.length;
    const end = el.selectionEnd ?? current.length;
    const next = current.slice(0, start) + token + current.slice(end);
    setForm((prev) => ({ ...prev, body: next }));

    // React state 업데이트 후 커서를 토큰 뒤로 이동
    requestAnimationFrame(() => {
      try {
        el.focus();
        const cursor = start + token.length;
        el.setSelectionRange(cursor, cursor);
      } catch {
        /* ignore */
      }
    });
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
        <DialogContent className="max-w-[640px] gap-0 overflow-hidden rounded-2xl border-neutral-200 p-0 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.2)] backdrop-blur-sm [&>button]:hidden">
          <div className="relative flex flex-col bg-white">
            <div className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-neutral-300 to-transparent opacity-50" />

            <div className="z-10 flex items-center justify-between bg-white px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200/50 bg-neutral-100/80 shadow-sm">
                  <LayoutTemplate className="h-4 w-4 text-neutral-700" />
                </div>
                <div>
                  <h2 className="text-sm font-bold tracking-tight text-neutral-900">새 템플릿 생성</h2>
                  <p className="text-[11px] font-medium text-neutral-400">자주 사용하는 이메일 형식을 저장하세요.</p>
                </div>
              </div>
              <button
                type="button"
                className="rounded-lg p-2 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
                onClick={() => setIsCreateOpen(false)}
                aria-label="모달 닫기"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTemplate}>
              <div className="max-h-[70vh] space-y-6 overflow-y-auto p-6 pt-2">
                <div className="space-y-4">
                  <div className="group">
                    <label
                      htmlFor="template_name"
                      className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-neutral-400 transition-colors group-focus-within:text-neutral-900"
                    >
                      템플릿 이름
                    </label>
                    <input
                      id="template_name"
                      type="text"
                      required
                      maxLength={100}
                      value={form.name}
                      onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                      className="pro-input w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-900 placeholder:text-neutral-400"
                      placeholder="예: 1차 면접 안내"
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="group">
                    <label
                      htmlFor="template_subject"
                      className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-neutral-400 transition-colors group-focus-within:text-neutral-900"
                    >
                      이메일 제목
                    </label>
                    <input
                      id="template_subject"
                      type="text"
                      required
                      value={form.subject}
                      onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
                      className="pro-input w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-900 placeholder:text-neutral-400"
                      placeholder="예: [VNTG] 1차 면접 안내"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div className="group">
                  <label
                    htmlFor="template_body"
                    className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-neutral-400 transition-colors group-focus-within:text-neutral-900"
                  >
                    이메일 본문
                  </label>

                  {/* Insert: 한 줄에 몰아 넣지 않고 그룹별 행으로 나눠 정렬합니다. */}
                  <div className="mb-3 rounded-xl border border-indigo-100/40 bg-indigo-50/30 px-3 py-2.5">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                      Insert
                    </p>
                    <div className="space-y-2.5">
                      {(Object.keys(variablesByGroup) as EmailTemplateVariableGroupId[]).map((groupId) => (
                        <div
                          key={groupId}
                          className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3"
                        >
                          <span className="shrink-0 pt-0.5 text-[10px] font-bold text-neutral-500 sm:w-[4.5rem]">
                            {EMAIL_TEMPLATE_VARIABLE_GROUP_LABEL[groupId]}
                          </span>
                          <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                            {variablesByGroup[groupId].map((v) => {
                              const icon =
                                v.groupId === 'candidate' ? (
                                  <User className="h-3 w-3 shrink-0" />
                                ) : v.groupId === 'job' ? (
                                  <Briefcase className="h-3 w-3 shrink-0" />
                                ) : (
                                  <FileText className="h-3 w-3 shrink-0" />
                                );
                              return (
                                <button
                                  key={v.key}
                                  type="button"
                                  onClick={() => insertTokenToBody(v.token)}
                                  className="flex items-center gap-1 rounded-md border border-indigo-100/50 bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-600 shadow-sm transition-colors hover:bg-indigo-100 active:scale-[0.98]"
                                  disabled={isSubmitting}
                                  title={v.token}
                                >
                                  {icon}
                                  {v.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="relative overflow-hidden rounded-xl border border-neutral-200 bg-[#FCFCFC] transition-all group-focus-within:border-neutral-900 group-focus-within:bg-white group-focus-within:ring-1 group-focus-within:ring-neutral-900 group-focus-within:shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
                    <textarea
                      id="template_body"
                      required
                      rows={11}
                      value={form.body}
                      onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
                      ref={bodyTextareaRef}
                      className="w-full resize-none bg-transparent border-0 p-5 text-sm leading-relaxed text-neutral-800 outline-none placeholder:text-neutral-400"
                      placeholder="여기에 이메일 내용을 작성하세요..."
                      disabled={isSubmitting}
                    />

                    <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-neutral-200/60 bg-white/80 p-1 shadow-[0_8px_16px_rgba(0,0,0,0.06)] backdrop-blur-xl">
                      <button
                        type="button"
                        className="rounded-md p-2 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
                        aria-label="굵게"
                      >
                        <Bold className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="rounded-md p-2 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
                        aria-label="기울임"
                      >
                        <Italic className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="rounded-md p-2 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
                        aria-label="밑줄"
                      >
                        <Underline className="h-4 w-4" />
                      </button>
                      <div className="mx-1 h-4 w-px bg-neutral-200" />
                      <button
                        type="button"
                        className="rounded-md p-2 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
                        aria-label="링크"
                      >
                        <Link2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="rounded-md p-2 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
                        aria-label="리스트"
                      >
                        <List className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="z-10 flex justify-end gap-3 border-t border-neutral-100 bg-white px-6 py-5">
                <button
                  type="button"
                  className="rounded-xl px-5 py-2.5 text-sm font-semibold text-neutral-500 transition-colors hover:bg-neutral-50 hover:text-neutral-900"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={isSubmitting}
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 rounded-xl bg-neutral-900 px-6 py-2.5 text-sm font-semibold text-white shadow-[0_4px_12px_rgba(0,0,0,0.1)] transition-all hover:bg-neutral-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      생성 중...
                    </>
                  ) : (
                    '템플릿 생성'
                  )}
                </button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
