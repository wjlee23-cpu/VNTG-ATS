/**
 * 원격 URL을 Blob으로 받아 브라우저 저장(다운로드)을 유도합니다.
 * Signed URL 등 cross-origin에서 `<a download>`만으로는 탭 이동이 되는 경우를 막기 위함입니다.
 */
export async function downloadUrlAsFile(url: string, filename: string): Promise<void> {
  const safeName = filename.replace(/\?/g, '_').replace(/[/\\]/g, '_') || 'download';

  const res = await fetch(url, { method: 'GET', credentials: 'omit' });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);

  try {
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = safeName;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
