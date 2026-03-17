'use client';

// VNTG Design System 2.0 - 후보자 AI 인사이트 뷰
// 샘플화면4.html 기반의 초미니멀리즘 디자인 적용
import { useState, useEffect } from 'react';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Mail,
  Lock,
  FileText,
  Upload,
  Pencil,
  Download,
  FileIcon,
} from 'lucide-react';
import type { Candidate } from '@/types/candidates';
import type { ResumeFile } from '@/types/candidate-detail';

interface CandidateAIInsightViewProps {
  candidate: Candidate;
  resumeFiles: ResumeFile[];
  canManageCandidate: boolean;
  canViewCompensation: boolean;
  onEditContact?: () => void;
  onViewCompensation?: () => void;
  onFileUpload?: () => void;
  onFileSelect?: (file: ResumeFile) => void;
}

/** 점수에 따른 평가 배지 텍스트 및 스타일 */
function getScoreBadge(score: number | null) {
  if (score === null) return null;
  
  if (score >= 80) {
    return {
      text: 'STRONG HIRE',
      className: 'px-3 py-1 rounded bg-emerald-50 border border-emerald-100 text-emerald-700 text-[11px] font-bold tracking-wider uppercase flex items-center gap-1.5',
      dotColor: 'bg-emerald-500',
    };
  } else if (score >= 60) {
    return {
      text: 'CONSIDER',
      className: 'px-3 py-1 rounded bg-amber-50 border border-amber-100 text-amber-600 text-[11px] font-bold tracking-wider uppercase flex items-center gap-1.5',
      dotColor: 'bg-amber-500',
    };
  } else {
    return {
      text: 'NOT RECOMMENDED',
      className: 'px-3 py-1 rounded bg-red-50 border border-red-100 text-red-600 text-[11px] font-bold tracking-wider uppercase flex items-center gap-1.5',
      dotColor: 'bg-red-500',
    };
  }
}

/** 후보자 AI 인사이트 뷰 - VNTG Design System 2.0 */
export function CandidateAIInsightView({
  candidate,
  resumeFiles,
  canManageCandidate,
  canViewCompensation,
  onEditContact,
  onViewCompensation,
  onFileUpload,
  onFileSelect,
}: CandidateAIInsightViewProps) {
  const score = candidate.ai_score ?? null;
  const summary = candidate.ai_summary || '';
  const strengths = candidate.ai_strengths || [];
  const weaknesses = candidate.ai_weaknesses || [];
  const badge = getScoreBadge(score);
  
  // 첫 번째 파일을 자동으로 선택
  const [selectedFile, setSelectedFile] = useState<ResumeFile | null>(null);
  const [pdfLoadError, setPdfLoadError] = useState<string | null>(null);

  useEffect(() => {
    // 첫 번째 파일이 있으면 자동으로 선택
    if (resumeFiles.length > 0 && !selectedFile) {
      setSelectedFile(resumeFiles[0]);
    } else if (resumeFiles.length === 0) {
      setSelectedFile(null);
    }
  }, [resumeFiles, selectedFile]);

  // 파일 다운로드 함수
  const handleFileDownload = (file: ResumeFile) => {
    const fileName = file.original_name || file.file_url.split('/').pop() || 'document';
    const link = document.createElement('a');
    link.href = file.file_url;
    link.download = fileName;
    link.click();
  };

  // 인라인 미리보기 렌더링
  const renderInlinePreview = (file: ResumeFile | null) => {
    if (!file) {
      return (
        <div className="w-full h-[600px] flex flex-col items-center justify-center p-8 bg-neutral-50 border border-neutral-200 rounded-lg">
          <FileIcon className="w-16 h-16 text-neutral-300 mb-4" />
          <p className="text-sm text-neutral-400">파일을 선택하면 미리보기가 표시됩니다.</p>
        </div>
      );
    }

    if (file.file_type === 'pdf') {
      if (pdfLoadError) {
        return (
          <div className="w-full h-[600px] flex flex-col items-center justify-center p-8 bg-neutral-50 border border-neutral-200 rounded-lg">
            <FileIcon className="w-16 h-16 text-red-400 mb-4" />
            <p className="text-sm font-medium text-neutral-900 mb-2 text-center">
              PDF 미리보기를 로드할 수 없습니다
            </p>
            <p className="text-xs text-neutral-500 mb-4 text-center max-w-md">{pdfLoadError}</p>
            <button
              onClick={() => {
                setPdfLoadError(null);
                setSelectedFile(file);
              }}
              className="px-3 py-1.5 bg-white border border-neutral-200 rounded text-xs font-medium text-neutral-600 hover:bg-neutral-50 transition-colors"
            >
              다시 시도
            </button>
          </div>
        );
      }
      return (
        <div className="w-full h-[600px] border border-neutral-200 rounded-lg overflow-hidden bg-neutral-50 relative">
          <iframe
            src={`${file.file_url}#toolbar=0&navpanes=0&scrollbar=0`}
            className="w-full h-full"
            title="PDF Preview"
            onLoad={() => setPdfLoadError(null)}
            onError={() => setPdfLoadError('PDF 파일을 로드할 수 없습니다.')}
          />
        </div>
      );
    }

    const fileName = file.original_name || file.file_url.split('/').pop() || 'document';
    return (
      <div className="w-full h-[600px] flex flex-col items-center justify-center p-8 bg-neutral-50 border border-neutral-200 rounded-lg">
        <FileIcon className="w-16 h-16 text-neutral-400 mb-4" />
        <p className="text-sm text-neutral-600 mb-2 text-center font-medium">
          {file.file_type.toUpperCase()} 파일은 브라우저에서 미리보기를 지원하지 않습니다.
        </p>
        <p className="text-xs text-neutral-500 mb-6 text-center">파일을 다운로드하여 확인해주세요.</p>
        <button
          onClick={() => handleFileDownload(file)}
          className="px-4 py-2 bg-white border border-neutral-200 rounded text-sm font-medium text-neutral-600 hover:bg-neutral-50 transition-colors flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          다운로드
        </button>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col bg-white relative min-h-0">
      <div className="flex-1 overflow-y-auto p-8 min-h-0">
        {/* AI Match Score 카드 */}
        <div className="rounded-xl border border-neutral-200 bg-gradient-to-br from-[#FCFCFC] to-white p-6 mb-8 flex gap-8 items-center shadow-[0_2px_10px_-4px_rgba(0,0,0,0.02)]">
          {/* 점수 영역 */}
          <div className="flex flex-col items-center justify-center min-w-[140px] pr-8 border-r border-neutral-200">
            <div className="flex items-baseline gap-1">
              <span className="text-5xl font-bold tracking-tighter text-neutral-900">
                {score ?? '—'}
              </span>
              {score !== null && (
                <span className="text-lg font-medium text-neutral-400">/100</span>
              )}
            </div>
            {badge && (
              <div className={badge.className}>
                <div className={`w-1.5 h-1.5 rounded-full ${badge.dotColor}`}></div>
                {badge.text}
              </div>
            )}
          </div>

          {/* 요약 텍스트 */}
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-neutral-500" />
              AI Match Insight
            </h3>
            <p className="text-sm text-neutral-600 leading-relaxed">
              {summary || 'AI 분석 결과가 아직 없습니다. 이력서를 업로드하면 분석이 시작됩니다.'}
            </p>
          </div>
        </div>

        {/* 강점/보완점 그리드 */}
        <div className="grid grid-cols-2 gap-8 mb-10">
          {/* 강점 */}
          <div>
            <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              강점 (Strengths)
            </h4>
            {strengths.length > 0 ? (
              <ul className="space-y-4">
                {strengths.map((strength, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-neutral-300 mt-1.5 shrink-0"></div>
                    <p className="text-sm text-neutral-600 leading-relaxed">{strength}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-neutral-400">강점 정보가 없습니다.</p>
            )}
          </div>

          {/* 보완점 */}
          <div>
            <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              보완점 (Gaps)
            </h4>
            {weaknesses.length > 0 ? (
              <ul className="space-y-4">
                {weaknesses.map((weakness, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-neutral-300 mt-1.5 shrink-0"></div>
                    <p className="text-sm text-neutral-600 leading-relaxed">{weakness}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-neutral-400">보완점 정보가 없습니다.</p>
            )}
          </div>
        </div>

        <hr className="border-neutral-100 mb-8" />

        {/* 하단 정보 리스트 */}
        <div className="space-y-4">
          {/* Contact */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-neutral-200 bg-[#FCFCFC]">
            <div className="flex items-center gap-6">
              <div className="text-sm font-medium text-neutral-900 w-24">Contact</div>
              <div className="flex items-center gap-2 text-sm text-neutral-600">
                <Mail className="w-4 h-4 text-neutral-400" />
                {candidate.email || '이메일 없음'}
              </div>
            </div>
            {canManageCandidate && onEditContact && (
              <button
                onClick={onEditContact}
                className="text-xs font-medium text-neutral-500 hover:text-neutral-900 transition-colors flex items-center gap-1"
              >
                <Pencil className="w-3 h-3" />
                수정
              </button>
            )}
          </div>

          {/* Compensation */}
          {canViewCompensation && (
            <div className="flex items-center justify-between p-4 rounded-lg border border-neutral-200 bg-[#FCFCFC]">
              <div className="flex items-center gap-6">
                <div className="text-sm font-medium text-neutral-900 w-24">Compensation</div>
                <div className="flex items-center gap-2 text-sm text-neutral-400 italic">
                  <Lock className="w-4 h-4" />
                  Click to view sensitive data
                </div>
              </div>
              {onViewCompensation && (
                <button
                  onClick={onViewCompensation}
                  className="px-3 py-1.5 bg-white border border-neutral-200 rounded text-xs font-medium text-neutral-600 hover:bg-neutral-50 transition-colors shadow-sm"
                >
                  View
                </button>
              )}
            </div>
          )}

          {/* Documents */}
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg border border-neutral-200 bg-[#FCFCFC]">
              <div className="flex items-center gap-6">
                <div className="text-sm font-medium text-neutral-900 w-24">Documents</div>
                <div className="flex items-center gap-2 flex-wrap">
                  {resumeFiles.length > 0 ? (
                    resumeFiles.map((file) => {
                      const fileName = file.original_name || file.file_url.split('/').pop() || 'document';
                      return (
                        <button
                          key={file.id}
                          onClick={() => handleFileDownload(file)}
                          className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-neutral-200 rounded-md text-xs font-medium text-neutral-600 shadow-sm cursor-pointer hover:border-neutral-300 hover:bg-neutral-50 transition-colors"
                        >
                          <FileText className="w-3 h-3 text-neutral-400" />
                          {fileName}
                        </button>
                      );
                    })
                  ) : (
                    <span className="text-sm text-neutral-400">파일 없음</span>
                  )}
                </div>
              </div>
              {canManageCandidate && onFileUpload && (
                <button
                  onClick={onFileUpload}
                  className="text-xs font-medium text-neutral-500 hover:text-neutral-900 transition-colors flex items-center gap-1"
                >
                  <Upload className="w-3 h-3" />
                  파일 추가
                </button>
              )}
            </div>

            {/* 인라인 미리보기 영역 */}
            {resumeFiles.length > 0 && selectedFile && (
              <div className="mt-4">
                {renderInlinePreview(selectedFile)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
