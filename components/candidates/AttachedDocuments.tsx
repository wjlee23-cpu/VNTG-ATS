import { Button } from '@/components/ui/button'
import { Eye, Download, FileText } from 'lucide-react'

interface AttachedDocumentsProps {
  documents?: Array<{
    id: string
    name: string
    size?: number
    uploadedAt?: string
    url?: string
  }>
}

export function AttachedDocuments({ documents = [] }: AttachedDocumentsProps) {
  // Mock data if no documents provided
  const displayDocuments = documents.length > 0
    ? documents
    : [
        {
          id: '1',
          name: 'Sarah_Kim_Portfolio.pdf',
          size: 2.4 * 1024 * 1024, // 2.4 MB
          uploadedAt: '2026-02-03',
          url: '#',
        },
      ]

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
        첨부 문서
      </h2>
      {displayDocuments.map((doc) => (
        <div
          key={doc.id}
          className="flex items-center gap-4 rounded-lg border border-gray-300 bg-white p-4"
        >
          {/* Left: Thumbnail (A4 Paper Preview) */}
          <div className="flex h-32 w-24 flex-shrink-0 items-center justify-center rounded bg-gradient-to-br from-gray-100 to-gray-200">
            <FileText className="h-8 w-8 text-gray-400" />
          </div>

          {/* Right: File Info + Actions */}
          <div className="flex flex-1 items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900" style={{ fontFamily: 'Roboto, sans-serif' }}>
                {doc.name}
              </h4>
              <span className="text-sm text-gray-500" style={{ fontFamily: 'Roboto, sans-serif' }}>
                {formatFileSize(doc.size)} • 업로드: {doc.uploadedAt || 'N/A'}
              </span>
            </div>
            <div className="flex gap-3">
              <Button variant="primary" size="sm">
                <Eye className="mr-2 h-4 w-4" />
                전체 화면 보기
              </Button>
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                다운로드
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
