'use client';

import { useEffect, useState } from 'react';
import { Download, FileIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { ResumeFile } from '@/types/candidate-detail';
import { getFileName } from '@/lib/candidate-detail-utils';
import { downloadUrlAsFile } from '@/lib/download-file';

interface ResumeInlinePreviewProps {
  file: ResumeFile | null;
  /** 스크롤 영역 최소 높이 (기본 520px) */
  minHeightClass?: string;
}

/** 이력서/PDF 인라인 미리보기 (Profile·기타 탭 공용) */
export function ResumeInlinePreview({
  file,
  minHeightClass = 'min-h-[520px]',
}: ResumeInlinePreviewProps) {
  const [pdfLoadError, setPdfLoadError] = useState<string | null>(null);

  useEffect(() => {
    setPdfLoadError(null);
  }, [file?.id]);

  const handleDownload = async (f: ResumeFile) => {
    try {
      await downloadUrlAsFile(f.file_url, getFileName(f));
    } catch {
      toast.error('파일을 다운로드할 수 없습니다.');
    }
  };

  if (!file) {
    return (
      <div
        className={`w-full ${minHeightClass} flex flex-col items-center justify-center p-8 bg-neutral-100/50 border border-neutral-200`}
      >
        <FileIcon className="w-16 h-16 text-neutral-300 mb-4" />
        <p className="text-sm text-neutral-400">파일을 선택하면 미리보기가 표시됩니다.</p>
      </div>
    );
  }

  if (file.file_type === 'pdf') {
    if (pdfLoadError) {
      return (
        <div
          className={`w-full ${minHeightClass} flex flex-col items-center justify-center p-8 bg-neutral-100/50 border border-neutral-200`}
        >
          <FileIcon className="w-16 h-16 text-red-400 mb-4" />
          <p className="text-sm font-medium text-neutral-900 mb-2 text-center">PDF 미리보기를 로드할 수 없습니다</p>
          <p className="text-xs text-neutral-500 mb-4 text-center max-w-md">{pdfLoadError}</p>
          <button
            type="button"
            onClick={() => {
              setPdfLoadError(null);
            }}
            className="px-3 py-1.5 bg-white border border-neutral-200 rounded text-xs font-medium text-neutral-600 hover:bg-neutral-50 transition-colors"
          >
            다시 시도
          </button>
        </div>
      );
    }
    return (
      <div className={`w-full ${minHeightClass} border border-neutral-200 overflow-hidden bg-neutral-50 relative`}>
        <iframe
          src={`${file.file_url}#toolbar=0&navpanes=0&scrollbar=0`}
          className="w-full h-full min-h-[480px]"
          title="PDF Preview"
          onLoad={() => setPdfLoadError(null)}
          onError={() => setPdfLoadError('PDF 파일을 로드할 수 없습니다.')}
        />
      </div>
    );
  }

  return (
    <div
      className={`w-full ${minHeightClass} flex flex-col items-center justify-center p-8 bg-neutral-100/50 border border-neutral-200`}
    >
      <FileIcon className="w-16 h-16 text-neutral-400 mb-4" />
      <p className="text-sm text-neutral-600 mb-2 text-center font-medium">
        {file.file_type.toUpperCase()} 파일은 브라우저에서 미리보기를 지원하지 않습니다.
      </p>
      <p className="text-xs text-neutral-500 mb-6 text-center">파일을 다운로드하여 확인해주세요.</p>
      <button
        type="button"
        onClick={() => void handleDownload(file)}
        className="px-4 py-2 bg-white border border-neutral-200 rounded text-sm font-medium text-neutral-600 hover:bg-neutral-50 transition-colors flex items-center gap-2"
      >
        <Download className="w-4 h-4" />
        다운로드
      </button>
    </div>
  );
}
