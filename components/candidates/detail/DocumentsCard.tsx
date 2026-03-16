'use client';

import { FileIcon, FileText, Folder, Download, Upload, Trash2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getFileName, formatFileSize } from '@/lib/candidate-detail-utils';
import type { ResumeFile } from '@/types/candidate-detail';

interface DocumentsCardProps {
  resumeFiles: ResumeFile[];
  selectedDocument: ResumeFile | null;
  onSelectDocument: (file: ResumeFile) => void;
  pdfLoadError: string | null;
  onPdfLoadErrorClear: () => void;
  onPdfLoadError?: (message: string) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFileDownload: (file: ResumeFile) => void;
  onFileDelete: (fileId: string) => void;
  isLoadingFiles: boolean;
  canManageCandidate: boolean;
  isUploadingFile: boolean;
}

/** Documents 카드: 파일 목록 + 인라인 미리보기 */
export function DocumentsCard({
  resumeFiles,
  selectedDocument,
  onSelectDocument,
  pdfLoadError,
  onPdfLoadErrorClear,
  onPdfLoadError,
  onFileUpload,
  onFileDownload,
  onFileDelete,
  isLoadingFiles,
  canManageCandidate,
  isUploadingFile,
}: DocumentsCardProps) {
  const renderInlinePreview = (file: ResumeFile | null) => {
    if (!file) {
      return (
        <div className="w-full h-[calc(100vh-400px)] min-h-[600px] flex flex-col items-center justify-center p-8 bg-muted/30 border border-border rounded-lg">
          <FileIcon className="w-16 h-16 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">파일을 선택하면 미리보기가 표시됩니다.</p>
        </div>
      );
    }

    if (file.file_type === 'pdf') {
      if (pdfLoadError) {
        return (
          <div className="w-full h-[calc(100vh-400px)] min-h-[600px] flex flex-col items-center justify-center p-8 bg-muted/30 border border-border rounded-lg">
            <FileIcon className="w-16 h-16 text-destructive mb-4" />
            <p className="text-sm font-medium text-foreground mb-2 text-center">
              PDF 미리보기를 로드할 수 없습니다
            </p>
            <p className="text-xs text-muted-foreground mb-4 text-center max-w-md">{pdfLoadError}</p>
            <Button variant="outline" size="sm" onClick={onPdfLoadErrorClear}>
              다시 시도
            </Button>
          </div>
        );
      }
      return (
        <div className="w-full h-[calc(100vh-400px)] min-h-[700px] border border-border rounded-lg overflow-hidden bg-muted/30 relative">
          <iframe
            src={`${file.file_url}#toolbar=0&navpanes=0&scrollbar=0`}
            className="w-full h-full min-h-[700px]"
            title="PDF Preview"
            onLoad={() => onPdfLoadErrorClear()}
            onError={() => onPdfLoadError?.('PDF 파일을 로드할 수 없습니다.')}
          />
        </div>
      );
    }

    const fileName = getFileName(file);
    return (
      <div className="w-full h-[calc(100vh-400px)] min-h-[600px] flex flex-col items-center justify-center p-8 bg-muted/30 border border-border rounded-lg">
        <FileIcon className="w-16 h-16 text-muted-foreground mb-4" />
        <p className="text-sm text-foreground mb-2 text-center font-medium">
          {file.file_type.toUpperCase()} 파일은 브라우저에서 미리보기를 지원하지 않습니다.
        </p>
        <p className="text-xs text-muted-foreground mb-6 text-center">파일을 다운로드하여 확인해주세요.</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const link = document.createElement('a');
            link.href = file.file_url;
            link.download = fileName;
            link.click();
          }}
        >
          <Download className="w-4 h-4 mr-2" />
          다운로드
        </Button>
      </div>
    );
  };

  return (
    <Card
      id="documents-section"
      className="mb-6 shadow-md hover:shadow-lg transition-shadow duration-200 card-modern scroll-mt-6"
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Documents</CardTitle>
          <div className="flex items-center gap-2">
            {resumeFiles.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {resumeFiles.length} files
              </Badge>
            )}
            {canManageCandidate && (
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={onFileUpload}
                  disabled={isUploadingFile}
                  className="hidden"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isUploadingFile}
                  className="cursor-pointer hover:bg-blue-50 hover:text-blue-700 transition-colors"
                  asChild
                >
                  <span>
                    <Upload className="w-4 h-4 mr-2" />
                    {isUploadingFile ? '업로드 중...' : '파일 추가'}
                  </span>
                </Button>
              </label>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoadingFiles ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-sm text-muted-foreground">파일을 불러오는 중...</p>
          </div>
        ) : resumeFiles.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <FileIcon className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">첨부 파일이 없습니다.</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="overflow-x-auto pb-2">
              <div className="flex gap-3 min-w-max">
                {resumeFiles.map((file) => {
                  const fileName = getFileName(file);
                  const fileSize = file.parsed_data?.file_size;
                  const isSelected = selectedDocument?.id === file.id;
                  return (
                    <div
                      key={file.id}
                      onClick={() => onSelectDocument(file)}
                      className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-all duration-200 group whitespace-nowrap ${
                        isSelected
                          ? 'border-primary bg-primary/5 shadow-md'
                          : 'border-border hover:bg-blue-50 hover:shadow-md'
                      }`}
                    >
                      {file.file_type === 'pdf' ? (
                        <FileText className="w-4 h-4 flex-shrink-0 text-primary" />
                      ) : (
                        <Folder className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                      )}
                      <div className="flex flex-col min-w-0">
                        <p
                          className={`text-xs font-medium truncate max-w-[200px] ${
                            isSelected ? 'text-primary font-semibold' : 'text-foreground group-hover:text-primary'
                          }`}
                        >
                          {fileName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {fileSize ? formatFileSize(fileSize) : 'Unknown size'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onFileDownload(file);
                          }}
                          className="flex-shrink-0 p-1 hover:bg-blue-50 rounded transition-colors"
                          title="다운로드"
                        >
                          <Download className="w-4 h-4 text-muted-foreground" />
                        </button>
                        {canManageCandidate && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onFileDelete(file.id);
                            }}
                            className="flex-shrink-0 p-1 hover:bg-destructive/10 rounded"
                            title="파일 삭제"
                          >
                            <Trash2 className="w-4 h-4 text-muted-foreground group-hover:text-destructive" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="w-full">{renderInlinePreview(selectedDocument)}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
