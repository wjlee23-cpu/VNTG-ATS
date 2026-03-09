'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { getCurrentUser, verifyCandidateAccess, requireRecruiterOrAdmin } from '@/api/utils/auth';
import { validateUUID } from '@/api/utils/validation';
import { withErrorHandling } from '@/api/utils/errors';

/**
 * 첨부파일 업로드
 * @param candidateId 후보자 ID
 * @param formData 파일 데이터 (file: File)
 * @returns 업로드된 파일 정보
 */
export async function uploadResumeFile(candidateId: string, formData: FormData) {
  return withErrorHandling(async () => {
    // 리크루터 이상 권한 확인
    await requireRecruiterOrAdmin();
    // 후보자 접근 권한 확인
    await verifyCandidateAccess(candidateId);
    
    const user = await getCurrentUser();
    const isAdmin = user.role === 'admin';
    const supabase = isAdmin ? createServiceClient() : await createClient();

    const file = formData.get('file') as File;
    if (!file) {
      throw new Error('파일이 제공되지 않았습니다.');
    }

    // 파일 타입 검증
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const fileType = file.type;
    if (!allowedTypes.includes(fileType)) {
      throw new Error('지원하지 않는 파일 형식입니다. PDF, DOC, DOCX만 업로드 가능합니다.');
    }

    // 파일 확장자 추출
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    if (!fileExtension || !['pdf', 'doc', 'docx'].includes(fileExtension)) {
      throw new Error('지원하지 않는 파일 확장자입니다.');
    }

    // 파일명 생성 (중복 방지)
    const fileName = `${candidateId}/${Date.now()}-${file.name}`;
    const filePath = `resumes/${fileName}`;

    // Supabase Storage에 파일 업로드
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('resumes')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`파일 업로드 실패: ${uploadError.message}`);
    }

    // Public URL 생성
    const { data: urlData } = supabase.storage
      .from('resumes')
      .getPublicUrl(filePath);

    const fileUrl = urlData.publicUrl;

    // resume_files 테이블에 메타데이터 저장
    const { data: resumeFile, error: insertError } = await supabase
      .from('resume_files')
      .insert({
        candidate_id: validateUUID(candidateId, '후보자 ID'),
        file_url: fileUrl,
        file_type: fileExtension,
        parsing_status: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      // 업로드된 파일 삭제 시도
      await supabase.storage.from('resumes').remove([filePath]);
      throw new Error(`파일 메타데이터 저장 실패: ${insertError.message}`);
    }

    // 캐시 무효화
    revalidatePath(`/candidates/${candidateId}`);

    return resumeFile;
  });
}

/**
 * 첨부파일 삭제
 * @param fileId 파일 ID
 */
export async function deleteResumeFile(fileId: string) {
  return withErrorHandling(async () => {
    // 리크루터 이상 권한 확인
    await requireRecruiterOrAdmin();
    
    const user = await getCurrentUser();
    const isAdmin = user.role === 'admin';
    const supabase = isAdmin ? createServiceClient() : await createClient();

    // 파일 정보 조회
    const { data: resumeFile, error: fileError } = await supabase
      .from('resume_files')
      .select('*, candidates!inner(id)')
      .eq('id', validateUUID(fileId, '파일 ID'))
      .single();

    if (fileError || !resumeFile) {
      throw new Error('파일을 찾을 수 없습니다.');
    }

    const candidate = resumeFile.candidates as { id: string } | null | undefined;
    if (!candidate) {
      throw new Error('후보자 정보를 찾을 수 없습니다.');
    }

    // 후보자 접근 권한 확인
    await verifyCandidateAccess(candidate.id);

    // Storage에서 파일 경로 추출 (file_url에서)
    const fileUrl = resumeFile.file_url;
    // URL에서 파일 경로 추출 (예: https://xxx.supabase.co/storage/v1/object/public/resumes/xxx/xxx.pdf)
    const urlParts = fileUrl.split('/resumes/');
    const storagePath = urlParts.length > 1 ? `resumes/${urlParts[1]}` : null;

    // Storage에서 파일 삭제
    if (storagePath) {
      const { error: storageError } = await supabase.storage
        .from('resumes')
        .remove([storagePath]);

      if (storageError) {
        console.error('Storage 파일 삭제 실패:', storageError);
        // Storage 삭제 실패해도 DB는 삭제 진행
      }
    }

    // DB에서 파일 메타데이터 삭제
    const { error: deleteError } = await supabase
      .from('resume_files')
      .delete()
      .eq('id', fileId);

    if (deleteError) {
      throw new Error(`파일 삭제 실패: ${deleteError.message}`);
    }

    // 캐시 무효화
    revalidatePath(`/candidates/${candidate.id}`);

    return { success: true };
  });
}
