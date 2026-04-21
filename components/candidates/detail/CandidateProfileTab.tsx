'use client';

import { useState, useEffect } from 'react';
import {
  Sparkles,
  Mail,
  Lock,
  FileText,
  Upload,
  Download,
  ZoomIn,
  ZoomOut,
  Link2,
  MoreHorizontal,
} from 'lucide-react';
import type { Candidate } from '@/types/candidates';
import type { ResumeFile } from '@/types/candidate-detail';
import { ResumeInlinePreview } from './ResumeInlinePreview';
import { formatExperienceFromCandidateLike } from '@/utils/experience-format';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface CandidateProfileTabProps {
  candidate: Candidate;
  resumeFiles: ResumeFile[];
  canManageCandidate: boolean;
  canViewCompensation: boolean;
  /** 기본 정보 / 연봉 정보 각각의 수정 모달 열기 */
  onOpenProfileSectionEdit?: (section: 'basic' | 'compensation') => void;
  onFileUpload?: () => void;
  onFileSelect?: (file: ResumeFile) => void;
}

function totalExperienceLabel(c: Candidate): string {
  return formatExperienceFromCandidateLike(c);
}

function birthLabel(c: Candidate): string {
  const bd = c.parsed_data?.birth_date;
  if (bd && String(bd).trim()) return String(bd).trim();
  return '—';
}

function portfolioLinks(c: Candidate): { label: string; url: string }[] {
  const out: { label: string; url: string }[] = [];
  const pd = c.parsed_data;
  if (!pd) return out;
  if (pd.portfolio_url && /^https?:\/\//i.test(pd.portfolio_url)) {
    out.push({ label: 'Portfolio', url: pd.portfolio_url });
  }
  if (pd.github_url && /^https?:\/\//i.test(pd.github_url)) {
    out.push({ label: 'GitHub', url: pd.github_url });
  }
  return out;
}

/** Profile 탭 — 기본 정보, 연봉(토글), 문서(하단 독립 섹션), 이력서 뷰어 */
export function CandidateProfileTab({
  candidate,
  resumeFiles,
  canManageCandidate,
  canViewCompensation,
  onOpenProfileSectionEdit,
  onFileUpload,
  onFileSelect,
}: CandidateProfileTabProps) {
  const [selectedFile, setSelectedFile] = useState<ResumeFile | null>(null);
  const [revealCurrentSalary, setRevealCurrentSalary] = useState(false);
  const [revealExpectedSalary, setRevealExpectedSalary] = useState(false);
  const [zoomPercent, setZoomPercent] = useState(100);

  useEffect(() => {
    if (resumeFiles.length > 0 && !selectedFile) {
      setSelectedFile(resumeFiles[0]);
    } else if (resumeFiles.length === 0) {
      setSelectedFile(null);
    }
  }, [resumeFiles, selectedFile]);

  const summaryText =
    candidate.ai_summary?.trim() ||
    'AI 요약이 아직 없습니다. 이력서를 업로드하고 분석을 실행하면 Gemini Quick Summary가 표시됩니다.';

  const handleDownload = (file: ResumeFile) => {
    const fileName = file.original_name || file.file_url.split('/').pop() || 'document';
    const link = document.createElement('a');
    link.href = file.file_url;
    link.download = fileName;
    link.click();
  };

  const adjustZoom = (delta: number) => {
    setZoomPercent((z) => Math.min(150, Math.max(50, z + delta)));
  };

  const links = portfolioLinks(candidate);
  const displayName =
    selectedFile?.original_name || selectedFile?.file_url.split('/').pop() || '문서';

  return (
    <div className="flex-1 flex flex-col bg-white relative min-h-0">
      <div className="flex-1 overflow-y-auto p-8 min-h-0">
        {/* Gemini Quick Summary */}
        <div className="mb-8 p-4 bg-gradient-to-r from-indigo-50/50 to-blue-50/50 border border-indigo-100/50 rounded-xl flex gap-3 items-start">
          <Sparkles className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-[11px] font-bold text-indigo-500 uppercase tracking-wider mb-1">
              Gemini Quick Summary
            </p>
            <p className="text-sm text-neutral-700 leading-relaxed">{summaryText}</p>
          </div>
        </div>

        {/* 기본 정보 | 연봉 정보 (2열) — Documents 제외 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
          <div>
            <div className="flex items-center justify-between gap-2 border-b border-neutral-100 pb-2 mb-4">
              <h3 className="text-xs font-semibold text-neutral-900 uppercase tracking-wider">
                기본 정보
              </h3>
              {canManageCandidate && onOpenProfileSectionEdit && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="p-1.5 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-colors shrink-0 -mr-1"
                      aria-label="기본 정보 메뉴"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="border-neutral-200 bg-white min-w-[8rem]">
                    <DropdownMenuItem
                      className="cursor-pointer focus:bg-neutral-100"
                      onSelect={() => onOpenProfileSectionEdit('basic')}
                    >
                      수정
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            <div className="space-y-4">
              <div className="flex items-center">
                <span className="w-24 shrink-0 text-sm text-neutral-500">이메일</span>
                <span className="text-sm font-medium text-neutral-900 flex items-center gap-2 min-w-0">
                  <Mail className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  <span className="truncate">{candidate.email || '—'}</span>
                </span>
              </div>
              <div className="flex items-center">
                <span className="w-24 shrink-0 text-sm text-neutral-500">연락처</span>
                <span className="text-sm font-medium text-neutral-900">{candidate.phone || '—'}</span>
              </div>
              <div className="flex items-center">
                <span className="w-24 shrink-0 text-sm text-neutral-500">생년월일</span>
                <span className="text-sm font-medium text-neutral-900">{birthLabel(candidate)}</span>
              </div>
              <div className="flex items-center">
                <span className="w-24 shrink-0 text-sm text-neutral-500">총 경력</span>
                <span className="text-sm font-medium text-neutral-900">{totalExperienceLabel(candidate)}</span>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 border-b border-neutral-100 pb-2 mb-4">
              <h3 className="text-xs font-semibold text-neutral-900 uppercase tracking-wider">
                연봉 정보
              </h3>
              {canManageCandidate && canViewCompensation && onOpenProfileSectionEdit && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="p-1.5 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-colors shrink-0 -mr-1"
                      aria-label="연봉 정보 메뉴"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="border-neutral-200 bg-white min-w-[8rem]">
                    <DropdownMenuItem
                      className="cursor-pointer focus:bg-neutral-100"
                      onSelect={() => onOpenProfileSectionEdit('compensation')}
                    >
                      수정
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center min-w-0 flex-1">
                  <span className="w-24 shrink-0 text-sm text-neutral-500">현재 연봉</span>
                  {canViewCompensation && revealCurrentSalary ? (
                    <span className="text-sm font-medium text-neutral-900 truncate">
                      {candidate.current_salary?.trim() || '등록된 정보 없음'}
                    </span>
                  ) : (
                    <span className="text-sm font-medium text-neutral-400 italic flex items-center gap-1.5">
                      <Lock className="w-3 h-3 shrink-0" />
                      {canViewCompensation ? '클릭하여 보기' : '열람 권한 없음'}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  disabled={!canViewCompensation}
                  onClick={() => canViewCompensation && setRevealCurrentSalary((v) => !v)}
                  className="px-2 py-1 text-[10px] font-medium bg-neutral-100 text-neutral-600 rounded hover:bg-neutral-200 transition-colors shrink-0 disabled:opacity-40 disabled:pointer-events-none"
                >
                  View
                </button>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center min-w-0 flex-1">
                  <span className="w-24 shrink-0 text-sm text-neutral-500">희망 연봉</span>
                  {canViewCompensation && revealExpectedSalary ? (
                    <span className="text-sm font-medium text-neutral-900 truncate">
                      {candidate.expected_salary?.trim() || '등록된 정보 없음'}
                    </span>
                  ) : (
                    <span className="text-sm font-medium text-neutral-400 italic flex items-center gap-1.5">
                      <Lock className="w-3 h-3 shrink-0" />
                      {canViewCompensation ? '클릭하여 보기' : '열람 권한 없음'}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  disabled={!canViewCompensation}
                  onClick={() => canViewCompensation && setRevealExpectedSalary((v) => !v)}
                  className="px-2 py-1 text-[10px] font-medium bg-neutral-100 text-neutral-600 rounded hover:bg-neutral-200 transition-colors shrink-0 disabled:opacity-40 disabled:pointer-events-none"
                >
                  View
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Documents — 그리드 아래 별도 섹션 */}
        <div className="mb-10">
          <h3 className="text-xs font-semibold text-neutral-900 uppercase tracking-wider mb-4 border-b border-neutral-100 pb-2">
            Documents
          </h3>
          <div className="flex flex-wrap gap-2">
            {resumeFiles.map((file) => {
              const fileName = file.original_name || file.file_url.split('/').pop() || 'document';
              const active = selectedFile?.id === file.id;
              return (
                <button
                  key={file.id}
                  type="button"
                  onClick={() => {
                    setSelectedFile(file);
                    setZoomPercent(100);
                    onFileSelect?.(file);
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 bg-[#FCFCFC] border rounded-lg text-xs font-medium transition-colors shadow-sm ${
                    active
                      ? 'border-neutral-900 text-neutral-900'
                      : 'border-neutral-200 text-neutral-700 hover:border-neutral-300'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span className="truncate max-w-[220px]">{fileName}</span>
                </button>
              );
            })}
            {links.map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#FCFCFC] border border-neutral-200 rounded-lg text-xs font-medium text-neutral-700 hover:border-neutral-300 shadow-sm"
              >
                <Link2 className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                {link.label}
              </a>
            ))}
            {resumeFiles.length === 0 && links.length === 0 && (
              <span className="text-sm text-neutral-400">첨부 파일 없음</span>
            )}
            {canManageCandidate && onFileUpload && (
              <button
                type="button"
                onClick={onFileUpload}
                className="flex items-center gap-1.5 px-2.5 py-1.5 border border-dashed border-neutral-300 rounded-lg text-xs font-medium text-neutral-500 hover:bg-neutral-50"
              >
                <Upload className="w-3.5 h-3.5" />
                파일 추가
              </button>
            )}
          </div>
        </div>

        {/* 이력서 뷰어 패널 */}
        <div className="flex flex-col h-[600px] rounded-xl border border-neutral-200 overflow-hidden bg-neutral-100/50">
          <div className="h-12 bg-white border-b border-neutral-200 flex items-center justify-between px-4 shrink-0 gap-2">
            <div className="text-xs font-medium text-neutral-600 flex items-center gap-2 min-w-0">
              <FileText className="w-4 h-4 text-neutral-400 shrink-0" />
              <span className="truncate">{displayName}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => adjustZoom(-10)}
                className="p-1.5 text-neutral-400 hover:text-neutral-900 rounded-md hover:bg-neutral-100 transition-colors"
                aria-label="축소"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs text-neutral-400 px-2 font-medium w-12 text-center">{zoomPercent}%</span>
              <button
                type="button"
                onClick={() => adjustZoom(10)}
                className="p-1.5 text-neutral-400 hover:text-neutral-900 rounded-md hover:bg-neutral-100 transition-colors"
                aria-label="확대"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <div className="w-px h-4 bg-neutral-200 mx-2" />
              {selectedFile && (
                <button
                  type="button"
                  onClick={() => handleDownload(selectedFile)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-neutral-900 text-white rounded-md text-xs font-medium hover:bg-neutral-800 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  다운로드
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 flex justify-center min-h-0 bg-neutral-100/30">
            <div
              className="w-full max-w-[900px] origin-top transition-transform duration-150"
              style={{ transform: `scale(${zoomPercent / 100})` }}
            >
              <div className="bg-white border border-neutral-200 shadow-sm rounded-lg overflow-hidden min-h-[480px]">
                <ResumeInlinePreview file={selectedFile} minHeightClass="min-h-[480px]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
