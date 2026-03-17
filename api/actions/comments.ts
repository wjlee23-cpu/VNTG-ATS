'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { getCurrentUser, verifyCandidateAccess } from '@/api/utils/auth';
import { validateRequired, validateUUID } from '@/api/utils/validation';
import { withErrorHandling } from '@/api/utils/errors';

/**
 * 코멘트 생성
 * @param candidateId 후보자 ID
 * @param content 코멘트 내용
 * @param mentionedUserIds 멘션된 사용자 ID 목록 (선택)
 * @param parentCommentId 부모 코멘트 ID (대댓글인 경우)
 * @param skipRevalidate 캐시 무효화(revalidatePath)를 건너뛸지 여부 (기본값: false)
 * @returns 생성된 코멘트 데이터
 */
export async function createComment(
  candidateId: string,
  content: string,
  mentionedUserIds?: string[],
  parentCommentId?: string,
  skipRevalidate?: boolean
) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    await verifyCandidateAccess(candidateId);
    
    // RLS 무한 재귀 문제 해결: Service Role Client 사용
    // verifyCandidateAccess에서 이미 권한 확인을 완료했으므로 안전합니다.
    const supabase = createServiceClient();

    // 입력값 검증
    const validatedContent = validateRequired(content, '코멘트 내용');
    const validatedCandidateId = validateUUID(candidateId, '후보자 ID');

    // 부모 코멘트가 있는 경우 존재 여부 확인
    if (parentCommentId) {
      const validatedParentId = validateUUID(parentCommentId, '부모 코멘트 ID');
      const { data: parentComment, error: parentError } = await supabase
        .from('comments')
        .select('id, candidate_id')
        .eq('id', validatedParentId)
        .single();

      if (parentError || !parentComment) {
        throw new Error('부모 코멘트를 찾을 수 없습니다.');
      }

      if (parentComment.candidate_id !== validatedCandidateId) {
        throw new Error('부모 코멘트가 해당 후보자의 코멘트가 아닙니다.');
      }
    }

    // 코멘트 생성
    const { data, error } = await supabase
      .from('comments')
      .insert({
        candidate_id: validatedCandidateId,
        content: validatedContent,
        created_by: user.userId,
        mentioned_user_ids: mentionedUserIds || [],
        parent_comment_id: parentCommentId || null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`코멘트 생성 실패: ${error.message}`);
    }

    // 타임라인 이벤트 생성
    const { error: timelineError } = await supabase.from('timeline_events').insert({
      candidate_id: validatedCandidateId,
      type: parentCommentId ? 'comment_created' : 'comment_created', // 대댓글도 동일한 타입 사용
      content: {
        message: parentCommentId ? '대댓글이 작성되었습니다.' : '코멘트가 작성되었습니다.',
        comment_id: data.id,
        content: validatedContent,
        parent_comment_id: parentCommentId || null,
        mentioned_user_ids: mentionedUserIds || [],
      },
      created_by: user.userId,
    });

    if (timelineError) {
      console.error('[타임라인] 이벤트 생성 실패 (코멘트 작성):', timelineError);
      if (timelineError.code === '23514') {
        console.error('[타임라인] DB 스키마 제약 조건 위반 - comment_created 타입이 허용되지 않음.');
      }
    }

    // 캐시 무효화 (skipRevalidate가 true이면 건너뜀)
    // 클라이언트에서 타임라인을 직접 업데이트하는 경우 서버 캐시 무효화가 불필요합니다.
    if (!skipRevalidate) {
      revalidatePath(`/dashboard/candidates/${validatedCandidateId}`);
    }

    return data;
  });
}

/**
 * 코멘트 수정
 * @param commentId 코멘트 ID
 * @param content 수정할 코멘트 내용
 * @returns 수정된 코멘트 데이터
 */
export async function updateComment(commentId: string, content: string) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    
    // RLS 무한 재귀 문제 해결: Service Role Client 사용
    const supabase = createServiceClient();

    // 입력값 검증
    const validatedCommentId = validateUUID(commentId, '코멘트 ID');
    const validatedContent = validateRequired(content, '코멘트 내용');

    // 기존 코멘트 조회
    const { data: existingComment, error: fetchError } = await supabase
      .from('comments')
      .select('id, candidate_id, content, created_by')
      .eq('id', validatedCommentId)
      .single();

    if (fetchError || !existingComment) {
      throw new Error('코멘트를 찾을 수 없습니다.');
    }

    // 권한 확인 (작성자만 수정 가능)
    if (existingComment.created_by !== user.userId) {
      throw new Error('코멘트를 수정할 권한이 없습니다.');
    }

    // 후보자 접근 권한 확인
    await verifyCandidateAccess(existingComment.candidate_id);

    // 코멘트 수정
    const { data, error } = await supabase
      .from('comments')
      .update({
        content: validatedContent,
        updated_at: new Date().toISOString(),
      })
      .eq('id', validatedCommentId)
      .select()
      .single();

    if (error) {
      throw new Error(`코멘트 수정 실패: ${error.message}`);
    }

    // 타임라인 이벤트 생성
    const { error: timelineError } = await supabase.from('timeline_events').insert({
      candidate_id: existingComment.candidate_id,
      type: 'comment_updated',
      content: {
        message: '코멘트가 수정되었습니다.',
        comment_id: validatedCommentId,
        previous_content: existingComment.content,
        new_content: validatedContent,
      },
      created_by: user.userId,
    });

    if (timelineError) {
      console.error('[타임라인] 이벤트 생성 실패 (코멘트 수정):', timelineError);
      if (timelineError.code === '23514') {
        console.error('[타임라인] DB 스키마 제약 조건 위반 - comment_updated 타입이 허용되지 않음.');
      }
    }

    // 캐시 무효화
    revalidatePath(`/dashboard/candidates/${existingComment.candidate_id}`);

    return data;
  });
}

/**
 * 코멘트 삭제
 * @param commentId 코멘트 ID
 */
export async function deleteComment(commentId: string) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    
    // RLS 무한 재귀 문제 해결: Service Role Client 사용
    const supabase = createServiceClient();

    // 입력값 검증
    const validatedCommentId = validateUUID(commentId, '코멘트 ID');

    // 기존 코멘트 조회
    const { data: existingComment, error: fetchError } = await supabase
      .from('comments')
      .select('id, candidate_id, created_by')
      .eq('id', validatedCommentId)
      .single();

    if (fetchError || !existingComment) {
      throw new Error('코멘트를 찾을 수 없습니다.');
    }

    // 권한 확인 (작성자만 삭제 가능)
    if (existingComment.created_by !== user.userId) {
      throw new Error('코멘트를 삭제할 권한이 없습니다.');
    }

    // 후보자 접근 권한 확인
    await verifyCandidateAccess(existingComment.candidate_id);

    // 코멘트 삭제
    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', validatedCommentId);

    if (error) {
      throw new Error(`코멘트 삭제 실패: ${error.message}`);
    }

    // 타임라인 이벤트는 삭제하지 않음 (히스토리 보존)

    // 캐시 무효화
    revalidatePath(`/dashboard/candidates/${existingComment.candidate_id}`);

    return { success: true };
  });
}
