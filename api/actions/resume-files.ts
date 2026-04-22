'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { extractFilePathFromUrl } from '@/lib/resume-storage-path';
import { revalidatePath } from 'next/cache';
import { getCurrentUser, verifyCandidateAccess, requireRecruiterOrAdmin } from '@/api/utils/auth';
import { validateUUID } from '@/api/utils/validation';
import { withErrorHandling } from '@/api/utils/errors';
import { analyzeCandidateMatch } from '@/lib/ai/candidate-matching';

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
    
    // ✅ Storage 업로드/DB insert/AI 트리거까지 한 흐름으로 이어지도록 Service Role을 사용합니다.
    // - 권한은 requireRecruiterOrAdmin + verifyCandidateAccess로 보장합니다.
    // - 배포 환경 RLS/정책 차이로 인해 resume_files가 “보이는데도 안 보이는” 문제를 차단합니다.
    const supabase = createServiceClient();

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

    // 파일명 정규화 (Supabase Storage는 한글, 공백, 특수 문자를 허용하지 않음)
    // 원본 파일명에서 확장자 제거
    const originalNameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
    // 한글, 공백, 특수 문자를 제거하고 URL-safe한 이름으로 변환
    const sanitizedName = originalNameWithoutExt
      .replace(/[^\w\-]/g, '_') // 영문, 숫자, 하이픈, 언더스코어만 허용
      .replace(/_+/g, '_') // 연속된 언더스코어를 하나로
      .replace(/^_|_$/g, '') // 앞뒤 언더스코어 제거
      .substring(0, 50) || 'file'; // 최대 50자로 제한, 비어있으면 'file' 사용
    
    // 파일명 생성 (중복 방지)
    // 주의: filePath는 bucket 이름을 포함하지 않아야 함 (Supabase Storage API가 자동으로 추가)
    const fileName = `${candidateId}/${Date.now()}-${sanitizedName}.${fileExtension}`;
    const filePath = fileName; // bucket 이름 제거 (resumes/ 제거)

    // 참고: Service Role Client는 세션 기반 사용자 정보를 가지지 않습니다.

    // Supabase Storage에 파일 업로드
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('resumes')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      // 더 자세한 오류 정보 로깅
      if (process.env.NODE_ENV === 'development') {
        console.error('[uploadResumeFile] Upload error:', {
          message: uploadError.message,
          statusCode: uploadError.statusCode,
          error: uploadError,
        });
      }
      throw new Error(`파일 업로드 실패: ${uploadError.message}`);
    }

    // Public URL 생성
    const { data: urlData } = supabase.storage
      .from('resumes')
      .getPublicUrl(filePath);

    const fileUrl = urlData.publicUrl;

    // resume_files 테이블에 메타데이터 저장
    // 원본 파일명을 저장하여 UI에서 한글 파일명을 표시할 수 있도록 함
    // original_name 컬럼이 없을 수 있으므로, 먼저 시도하고 실패하면 없이 재시도
    let insertData: Record<string, unknown> = {
      candidate_id: validateUUID(candidateId, '후보자 ID'),
      file_url: fileUrl,
      file_type: fileExtension,
      original_name: file.name, // 원본 파일명 저장 (한글 포함 가능)
      parsing_status: 'pending',
    };
    
    let { data: resumeFile, error: insertError } = await supabase
      .from('resume_files')
      .insert(insertData)
      .select()
      .single();
    
    // original_name 컬럼이 없어서 에러가 발생한 경우, original_name 없이 재시도
    if (insertError && insertError.message?.includes('original_name')) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[uploadResumeFile] original_name 컬럼이 없습니다. original_name 없이 재시도합니다.');
        console.warn('[uploadResumeFile] 마이그레이션을 실행해주세요: supabase/migrations/20260306000001_add_original_name_to_resume_files.sql');
      }
      
      // original_name 없이 재시도
      insertData = {
        candidate_id: validateUUID(candidateId, '후보자 ID'),
        file_url: fileUrl,
        file_type: fileExtension,
        parsing_status: 'pending',
      };
      
      const retryResult = await supabase
        .from('resume_files')
        .insert(insertData)
        .select()
        .single();
      
      resumeFile = retryResult.data;
      insertError = retryResult.error;
    }

    if (insertError) {
      // 업로드된 파일 삭제 시도
      await supabase.storage.from('resumes').remove([filePath]);
      throw new Error(`파일 메타데이터 저장 실패: ${insertError.message}`);
    }

    // 파일 업로드 성공 후 AI 인사이트 초기화 및 상태를 pending으로 설정
    // 기존 AI 분석 결과를 초기화하여 새 파일에 맞는 새로운 분석이 시작되도록 함
    await supabase
      .from('candidates')
      .update({
        ai_score: null,
        ai_summary: null,
        ai_strengths: null,
        ai_weaknesses: null,
        ai_interview_questions: [],
        ai_analysis_status: 'pending',
      })
      .eq('id', candidateId);

    // 이력서 업로드 성공 후 AI 분석 시작 (비동기, 백그라운드 실행)
    // 후보자의 job_post_id 조회
    console.log('[uploadResumeFile] AI 분석을 위한 후보자 정보 조회 시작...');
    const { data: candidateData, error: candidateDataError } = await supabase
      .from('candidates')
      .select('job_post_id')
      .eq('id', candidateId)
      .single();

    if (candidateDataError) {
      console.error('[uploadResumeFile] 후보자 정보 조회 실패:', candidateDataError);
    }

    if (candidateData?.job_post_id) {
      console.log('[uploadResumeFile] AI 분석 시작 - 후보자 ID:', candidateId, '채용 공고 ID:', candidateData.job_post_id);
      // 서버 액션 반환 후 런타임이 정리되면 백그라운드 Promise가 끊길 수 있어 await로 완료를 보장합니다.
      try {
        await analyzeCandidateMatch(candidateId, candidateData.job_post_id);
        console.log('[uploadResumeFile] AI 분석 완료');
      } catch (err) {
        console.error('[uploadResumeFile] AI 분석 실패:', err);
        console.error('[uploadResumeFile] 에러 스택:', err instanceof Error ? err.stack : '스택 정보 없음');
        // analyzeCandidateMatch catch에서 ai_analysis_status·ai_summary 갱신됨
      }
    } else {
      console.warn('[uploadResumeFile] job_post_id가 없어 AI 분석을 건너뜁니다. 후보자 ID:', candidateId);
    }

    // 캐시 무효화
    revalidatePath(`/candidates/${candidateId}`);
    revalidatePath(`/dashboard/candidates/${candidateId}`);

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

    const fileUrl = resumeFile.file_url as string;
    const objectPath = extractFilePathFromUrl(fileUrl);

    if (objectPath) {
      const { error: storageError } = await supabase.storage.from('resumes').remove([objectPath]);

      if (storageError) {
        console.error('Storage 파일 삭제 실패:', storageError);
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

    // 파일 삭제 후 남은 파일 개수 확인
    const { data: remainingFiles, error: countError } = await supabase
      .from('resume_files')
      .select('id')
      .eq('candidate_id', candidate.id);

    // 모든 파일이 삭제된 경우 AI 인사이트 초기화
    if (!countError && (!remainingFiles || remainingFiles.length === 0)) {
      await supabase
        .from('candidates')
        .update({
          ai_score: null,
          ai_summary: null,
          ai_strengths: null,
          ai_weaknesses: null,
          ai_interview_questions: [],
          ai_analysis_status: null,
        })
        .eq('id', candidate.id);
      
      console.log('[deleteResumeFile] 모든 파일이 삭제되어 AI 인사이트를 초기화했습니다.');
    }

    // 캐시 무효화
    revalidatePath(`/candidates/${candidate.id}`);

    return { success: true };
  });
}
