'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getCurrentUser, verifyCandidateAccess } from '@/api/utils/auth';
import { validateUUID } from '@/api/utils/validation';
import { withErrorHandling } from '@/api/utils/errors';

/**
 * file_url에서 Storage 경로 추출
 * @param fileUrl Supabase Storage URL
 * @returns Storage 경로 (예: "candidate-id/timestamp-filename.pdf")
 */
function extractFilePathFromUrl(fileUrl: string): string | null {
  try {
    // Supabase Storage URL 형식:
    // https://[project].supabase.co/storage/v1/object/public/resumes/[path]
    // 또는
    // https://[project].supabase.co/storage/v1/object/sign/resumes/[path]?token=...
    const url = new URL(fileUrl);
    const pathParts = url.pathname.split('/');
    const resumesIndex = pathParts.indexOf('resumes');
    
    if (resumesIndex !== -1 && resumesIndex < pathParts.length - 1) {
      // "resumes" 다음의 경로를 추출
      return pathParts.slice(resumesIndex + 1).join('/');
    }
    
    return null;
  } catch (error) {
    console.error('[extractFilePathFromUrl] URL 파싱 실패:', error);
    return null;
  }
}

/**
 * 파일 경로에 대한 Signed URL 생성
 * @param supabase Supabase 클라이언트
 * @param filePath Storage 경로
 * @param expiresIn 만료 시간 (초, 기본값: 3600 = 1시간)
 * @returns Signed URL 또는 null
 */
async function getSignedUrlForFile(
  // `createClient()`는 async이어서 ReturnType이 Promise까지 섞이며, 타입 추론상 storage가 누락될 수 있습니다.
  // 여기서는 Signed URL 생성 목적이므로 타입을 느슨하게 처리합니다.
  supabase: any,
  filePath: string,
  expiresIn: number = 3600
): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from('resumes')
      .createSignedUrl(filePath, expiresIn);

    if (error) {
      console.error('[getSignedUrlForFile] Signed URL 생성 실패:', error);
      return null;
    }

    return data?.signedUrl || null;
  } catch (error) {
    console.error('[getSignedUrlForFile] Signed URL 생성 중 오류:', error);
    return null;
  }
}

/**
 * 후보자의 모든 첨부 파일 조회
 * @param candidateId 후보자 ID
 * @returns 첨부 파일 목록
 */
export async function getResumeFilesByCandidate(candidateId: string) {
  return withErrorHandling(async () => {
    // 접근 권한 확인
    await verifyCandidateAccess(candidateId);
    const user = await getCurrentUser();
    const isAdmin = user.role === 'admin';
    
    // 관리자일 경우 Service Role Client를 사용하여 RLS 정책 우회하여 모든 데이터 조회
    const supabase = isAdmin ? createServiceClient() : await createClient();

    const { data, error } = await supabase
      .from('resume_files')
      .select('*')
      .eq('candidate_id', candidateId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`첨부 파일 조회 실패: ${error.message}`);
    }

    // 각 파일에 대해 Signed URL 생성 (Private bucket이므로)
    if (data && data.length > 0) {
      const filesWithSignedUrls = await Promise.all(
        data.map(async (file) => {
          // file_url에서 경로 추출
          const filePath = extractFilePathFromUrl(file.file_url);
          
          if (filePath) {
            // Signed URL 생성
            const signedUrl = await getSignedUrlForFile(supabase, filePath);
            if (signedUrl) {
              return {
                ...file,
                file_url: signedUrl, // Signed URL로 교체
              };
            }
          }
          
          // Signed URL 생성 실패 시 원본 URL 반환 (fallback)
          return file;
        })
      );
      
      return filesWithSignedUrls;
    }

    return data || [];
  });
}

/**
 * 특정 첨부 파일 조회
 * @param fileId 파일 ID
 * @returns 첨부 파일 정보
 */
export async function getResumeFileById(fileId: string) {
  return withErrorHandling(async () => {
    validateUUID(fileId, '파일 ID');
    const user = await getCurrentUser();
    const isAdmin = user.role === 'admin';
    
    const supabase = isAdmin ? createServiceClient() : await createClient();

    const { data, error } = await supabase
      .from('resume_files')
      .select('*, candidates!inner(id)')
      .eq('id', fileId)
      .single();

    if (error) {
      throw new Error(`첨부 파일 조회 실패: ${error.message}`);
    }

    // 후보자 접근 권한 확인
    if (data?.candidates) {
      await verifyCandidateAccess(data.candidates.id);
    }

    // Signed URL 생성 (Private bucket이므로)
    if (data) {
      const filePath = extractFilePathFromUrl(data.file_url);
      if (filePath) {
        const signedUrl = await getSignedUrlForFile(supabase, filePath);
        if (signedUrl) {
          return {
            ...data,
            file_url: signedUrl, // Signed URL로 교체
          };
        }
      }
    }

    return data;
  });
}
