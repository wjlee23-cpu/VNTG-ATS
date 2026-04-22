/**
 * 후보자 상세 페이지용 포맷/유틸 함수
 */

import type { ResumeFile } from '@/types/candidate-detail';

/** 파일 표시명 (original_name 우선, 없으면 URL에서 추출) */
export function getFileName(file: ResumeFile | string): string {
  if (typeof file === 'object' && file.original_name) {
    return file.original_name;
  }
  const fileUrl = typeof file === 'string' ? file : file.file_url;
  const parts = fileUrl.split('/');
  let last = parts[parts.length - 1] || 'document';
  const q = last.indexOf('?');
  if (q !== -1) last = last.slice(0, q);
  try {
    return decodeURIComponent(last) || 'document';
  } catch {
    return last || 'document';
  }
}

/** 날짜 포맷 (예: 2024년 3월 16일) */
export function formatDate(dateString?: string): string {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
}

/** 상대 시간 (방금 전, 5분 전, 2시간 전 등) */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return '방금 전';
  if (diffMins < 60) return `${diffMins}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  if (diffDays < 7) return `${diffDays}일 전`;
  return formatDate(dateString);
}

/** 파일 크기 포맷 (B, KB, MB) */
export function formatFileSize(bytes?: number): string {
  if (!bytes) return 'Unknown';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** HTML 태그 제거 및 엔티티 디코딩 */
export function stripHtml(html: string | undefined | null): string {
  if (!html) return '';
  const text = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, '');
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** 이메일 본문 표시용 포맷 (HTML 제거, 줄바꿈 유지) */
export function formatEmailBodyForDisplay(body: string | undefined | null): string {
  if (!body) return '';
  let text = body
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, '');
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<p[^>]*>/gi, '');
  return text
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();
}

/** 본문이 긴 이메일인지 (200자 초과) */
export function isLongEmail(body: string | undefined | null): boolean {
  if (!body) return false;
  return stripHtml(body).length > 200;
}
