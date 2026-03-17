'use client';

import { X, Download, FileText, FileIcon, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface DocumentPreviewModalProps {
  file: {
    id: string;
    file_url: string;
    file_type: string;
    original_name?: string | null; // 원본 파일명 (한글 포함 가능)
  } | null;
  isOpen: boolean;
  onClose: () => void;
}

export function DocumentPreviewModal({
  file,
  isOpen,
  onClose,
}: DocumentPreviewModalProps) {
  if (!file) return null;

  // 파일명 추출 (원본 파일명 우선 사용)
  const getFileName = () => {
    // original_name이 있으면 우선 사용
    if (file.original_name) {
      return file.original_name;
    }
    // 없으면 URL에서 추출
    const parts = file.file_url.split('/');
    return parts[parts.length - 1] || 'document';
  };

  // 파일 타입에 따른 미리보기 렌더링
  const renderPreview = () => {
    if (file.file_type === 'pdf') {
      return (
        <div className="w-full h-full min-h-[600px] border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
          <object
            data={`${file.file_url}#toolbar=0&navpanes=0&scrollbar=0`}
            type="application/pdf"
            className="w-full h-full"
            aria-label="PDF Preview"
          >
            {/* Fallback: PDF를 로드할 수 없을 때 표시 */}
            <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-gray-100 min-h-[600px]">
              <FileText className="w-12 h-12 text-gray-400 mb-3" />
              <p className="text-sm text-gray-600 mb-2 text-center">
                PDF 미리보기를 로드할 수 없습니다.
              </p>
              <p className="text-xs text-gray-500 mb-4 text-center">
                브라우저에서 직접 열어 확인하세요.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(file.file_url, '_blank')}
                className="hover:bg-blue-50 hover:text-blue-700 transition-colors"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                새 창에서 열기
              </Button>
            </div>
          </object>
        </div>
      );
    }

    // DOC, DOCX 파일은 다운로드만 제공
    return (
      <div className="w-full h-full min-h-[400px] flex flex-col items-center justify-center p-8 bg-gray-50 border border-gray-200 rounded-lg">
        <FileIcon className="w-16 h-16 text-gray-400 mb-4" />
        <p className="text-sm text-gray-600 mb-2 text-center">
          {file.file_type.toUpperCase()} 파일은 브라우저에서 미리보기를 지원하지 않습니다.
        </p>
        <p className="text-xs text-gray-500 mb-6 text-center">
          파일을 다운로드하여 확인해주세요.
        </p>
        <Button
          onClick={() => {
            const link = document.createElement('a');
            link.href = file.file_url;
            link.download = getFileName();
            link.click();
          }}
          className="hover:bg-blue-50 hover:text-blue-700 transition-colors"
        >
          <Download className="w-4 h-4 mr-2" />
          다운로드
        </Button>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-full h-[90vh] flex flex-col p-0">
        <DialogTitle className="sr-only">
          문서 미리보기: {getFileName()}
        </DialogTitle>
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <FileText className="w-5 h-5 text-gray-400 flex-shrink-0" />
            <h3 className="text-sm font-medium text-gray-900 truncate">
              {getFileName()}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const link = document.createElement('a');
                link.href = file.file_url;
                link.download = getFileName();
                link.click();
                onClose();
              }}
              className="hover:bg-blue-50 hover:text-blue-700 transition-colors"
            >
              <Download className="w-4 h-4 mr-2" />
              다운로드
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="p-2"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* 미리보기 영역 */}
        <div className="flex-1 overflow-auto p-4">
          {renderPreview()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
