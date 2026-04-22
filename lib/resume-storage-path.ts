/**
 * Supabase Storage `resumes` 버킷 기준 객체 경로 추출 (버킷 이름 제외)
 * 예: candidate-id/timestamp-file.pdf
 */
export function extractFilePathFromUrl(fileUrl: string): string | null {
  try {
    const url = new URL(fileUrl);
    const pathParts = url.pathname.split('/');
    const resumesIndex = pathParts.indexOf('resumes');

    if (resumesIndex !== -1 && resumesIndex < pathParts.length - 1) {
      return pathParts.slice(resumesIndex + 1).join('/');
    }

    return null;
  } catch {
    return null;
  }
}
