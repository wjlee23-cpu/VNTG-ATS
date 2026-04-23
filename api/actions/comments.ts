'use server';

import { createServiceClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { getCurrentUser, verifyCandidateAccess } from '@/api/utils/auth';
import { validateRequired, validateUUID } from '@/api/utils/validation';
import { withErrorHandling } from '@/api/utils/errors';
import { parseMentionUserIdsFromText } from '@/lib/mention-tokens';

/** 액티비티 타임라인 행 또는 이메일에 매달리는 스레드의 루트 */
export type ActivityCommentThreadRoot =
  | { kind: 'timeline_event'; id: string }
  | { kind: 'email'; id: string };

/**
 * 코멘트 생성
 * @param threadRoot 스레드 답장인 경우: 메인 타임라인에 새 행을 만들지 않습니다.
 */
export async function createComment(
  candidateId: string,
  content: string,
  mentionedUserIds?: string[],
  parentCommentId?: string,
  skipRevalidate?: boolean,
  threadRoot?: ActivityCommentThreadRoot,
) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    await verifyCandidateAccess(candidateId);

    const supabase = createServiceClient();

    const validatedContent = validateRequired(content, '코멘트 내용');
    const validatedCandidateId = validateUUID(candidateId, '후보자 ID');

    const fromText = parseMentionUserIdsFromText(validatedContent);
    const mergedMentions = [...new Set([...(mentionedUserIds || []), ...fromText])];

    let activity_thread_root_timeline_event_id: string | null = null;
    let activity_thread_root_email_id: string | null = null;

    if (parentCommentId) {
      const validatedParentId = validateUUID(parentCommentId, '부모 코멘트 ID');
      const { data: parentComment, error: parentError } = await supabase
        .from('comments')
        .select(
          'id, candidate_id, activity_thread_root_timeline_event_id, activity_thread_root_email_id',
        )
        .eq('id', validatedParentId)
        .single();

      if (parentError || !parentComment) {
        throw new Error('부모 코멘트를 찾을 수 없습니다.');
      }

      if (parentComment.candidate_id !== validatedCandidateId) {
        throw new Error('부모 코멘트가 해당 후보자의 코멘트가 아닙니다.');
      }

      if (parentComment.activity_thread_root_timeline_event_id) {
        activity_thread_root_timeline_event_id = parentComment.activity_thread_root_timeline_event_id;
      } else if (parentComment.activity_thread_root_email_id) {
        activity_thread_root_email_id = parentComment.activity_thread_root_email_id;
      }
    }

    if (!activity_thread_root_timeline_event_id && !activity_thread_root_email_id && threadRoot) {
      if (threadRoot.kind === 'timeline_event') {
        const teId = validateUUID(threadRoot.id, '타임라인 이벤트 ID');
        const { data: te, error: teError } = await supabase
          .from('timeline_events')
          .select('id, candidate_id')
          .eq('id', teId)
          .single();
        if (teError || !te || te.candidate_id !== validatedCandidateId) {
          throw new Error('스레드를 달 타임라인 이벤트를 찾을 수 없습니다.');
        }
        activity_thread_root_timeline_event_id = teId;
      } else {
        const emId = validateUUID(threadRoot.id, '이메일 ID');
        const { data: em, error: emError } = await supabase
          .from('emails')
          .select('id, candidate_id')
          .eq('id', emId)
          .single();
        if (emError || !em || em.candidate_id !== validatedCandidateId) {
          throw new Error('스레드를 달 이메일을 찾을 수 없습니다.');
        }
        activity_thread_root_email_id = emId;
      }
    }

    const isActivityThreadReply = !!(
      activity_thread_root_timeline_event_id || activity_thread_root_email_id
    );

    const { data, error } = await supabase
      .from('comments')
      .insert({
        candidate_id: validatedCandidateId,
        content: validatedContent,
        created_by: user.userId,
        mentioned_user_ids: mergedMentions,
        parent_comment_id: parentCommentId || null,
        activity_thread_root_timeline_event_id,
        activity_thread_root_email_id,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`코멘트 생성 실패: ${error.message}`);
    }

    if (!isActivityThreadReply) {
      const { error: timelineError } = await supabase.from('timeline_events').insert({
        candidate_id: validatedCandidateId,
        type: 'comment_created',
        content: {
          message: parentCommentId ? '대댓글이 작성되었습니다.' : '코멘트가 작성되었습니다.',
          comment_id: data.id,
          content: validatedContent,
          parent_comment_id: parentCommentId || null,
          mentioned_user_ids: mergedMentions,
        },
        created_by: user.userId,
      });

      if (timelineError) {
        console.error('[타임라인] 이벤트 생성 실패 (코멘트 작성):', timelineError);
        if (timelineError.code === '23514') {
          console.error('[타임라인] DB 스키마 제약 조건 위반 - comment_created 타입이 허용되지 않음.');
        }
      }
    }

    if (!skipRevalidate) {
      revalidatePath(`/dashboard/candidates/${validatedCandidateId}`);
    }

    return data;
  });
}

/**
 * 코멘트 수정
 */
export async function updateComment(commentId: string, content: string) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();

    const supabase = createServiceClient();

    const validatedCommentId = validateUUID(commentId, '코멘트 ID');
    const validatedContent = validateRequired(content, '코멘트 내용');

    const { data: existingComment, error: fetchError } = await supabase
      .from('comments')
      .select(
        'id, candidate_id, content, created_by, activity_thread_root_timeline_event_id, activity_thread_root_email_id',
      )
      .eq('id', validatedCommentId)
      .single();

    if (fetchError || !existingComment) {
      throw new Error('코멘트를 찾을 수 없습니다.');
    }

    if (existingComment.created_by !== user.userId) {
      throw new Error('코멘트를 수정할 권한이 없습니다.');
    }

    await verifyCandidateAccess(existingComment.candidate_id);

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

    const isThreadOnly =
      !!existingComment.activity_thread_root_timeline_event_id ||
      !!existingComment.activity_thread_root_email_id;

    if (!isThreadOnly) {
      const editedAt = new Date().toISOString();

      const { data: existingTimeline, error: existingTimelineError } = await supabase
        .from('timeline_events')
        .select('id, content, created_at')
        .eq('candidate_id', existingComment.candidate_id)
        .eq('type', 'comment_created')
        .eq('content->>comment_id', validatedCommentId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (existingTimelineError) {
        throw new Error(`코멘트 타임라인 조회 실패: ${existingTimelineError.message}`);
      }

      if (existingTimeline?.id) {
        const mergedContent = {
          ...(typeof existingTimeline.content === 'object' && existingTimeline.content
            ? existingTimeline.content
            : {}),
          message: '코멘트가 작성되었습니다.',
          comment_id: validatedCommentId,
          content: validatedContent,
          edited: true,
          edited_at: editedAt,
        };

        const { error: timelineUpdateError } = await supabase
          .from('timeline_events')
          .update({
            content: mergedContent,
          })
          .eq('id', existingTimeline.id);

        if (timelineUpdateError) {
          throw new Error(`코멘트 타임라인 갱신 실패: ${timelineUpdateError.message}`);
        }
      } else {
        const { error: timelineInsertError } = await supabase.from('timeline_events').insert({
          candidate_id: existingComment.candidate_id,
          type: 'comment_created',
          content: {
            message: '코멘트가 작성되었습니다.',
            comment_id: validatedCommentId,
            content: validatedContent,
            edited: true,
            edited_at: editedAt,
          },
          created_by: user.userId,
        });

        if (timelineInsertError) {
          console.error('[타임라인] 이벤트 생성 실패 (코멘트 수정 fallback):', timelineInsertError);
        }
      }
    }

    revalidatePath(`/dashboard/candidates/${existingComment.candidate_id}`);

    return data;
  });
}

/**
 * 코멘트 삭제
 */
export async function deleteComment(commentId: string) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();

    const supabase = createServiceClient();

    const validatedCommentId = validateUUID(commentId, '코멘트 ID');

    const { data: existingComment, error: fetchError } = await supabase
      .from('comments')
      .select('id, candidate_id, created_by')
      .eq('id', validatedCommentId)
      .single();

    if (fetchError || !existingComment) {
      throw new Error('코멘트를 찾을 수 없습니다.');
    }

    if (existingComment.created_by !== user.userId) {
      throw new Error('코멘트를 삭제할 권한이 없습니다.');
    }

    await verifyCandidateAccess(existingComment.candidate_id);

    const { error } = await supabase.from('comments').delete().eq('id', validatedCommentId);

    if (error) {
      throw new Error(`코멘트 삭제 실패: ${error.message}`);
    }

    revalidatePath(`/dashboard/candidates/${existingComment.candidate_id}`);

    return { success: true };
  });
}
