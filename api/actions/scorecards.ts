'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { getCurrentUser, verifyCandidateAccess } from '@/api/utils/auth';
import { validateRequired, validateUUID, validateNumberRange } from '@/api/utils/validation';
import { withErrorHandling } from '@/api/utils/errors';
import { Database } from '@/lib/supabase/types';

type ScorecardInsert = Database['public']['Tables']['scorecards']['Insert'];
type ScorecardUpdate = Database['public']['Tables']['scorecards']['Update'];

/**
 * 평가표 생성
 * @param scheduleId 면접 일정 ID
 * @param formData 평가표 정보 (overall_rating, criteria_scores, strengths, weaknesses, notes)
 * @returns 생성된 평가표 데이터
 */
export async function createScorecard(scheduleId: string, formData: FormData) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const supabase = await createClient();

    // 입력값 검증
    const validatedScheduleId = validateUUID(scheduleId, '면접 일정 ID');
    const overallRating = validateNumberRange(
      parseInt(validateRequired(formData.get('overall_rating'), '종합 평가')),
      1,
      5,
      '종합 평가'
    );
    const criteriaScores = formData.get('criteria_scores') 
      ? JSON.parse(formData.get('criteria_scores') as string)
      : {};
    const strengths = formData.get('strengths') as string | null;
    const weaknesses = formData.get('weaknesses') as string | null;
    const notes = formData.get('notes') as string | null;

    // 면접 일정 조회 (후보자 정보 포함)
    const { data: schedule, error: scheduleError } = await supabase
      .from('schedules')
      .select(`
        *,
        candidates!inner (
          id
        )
      `)
      .eq('id', validatedScheduleId)
      .single();

    if (scheduleError || !schedule) {
      throw new Error('면접 일정을 찾을 수 없습니다.');
    }

    const candidateId = (schedule.candidates as any).id;

    // 후보자 접근 권한 확인
    await verifyCandidateAccess(candidateId);

    // 면접관이 해당 일정의 면접관인지 확인
    if (!schedule.interviewer_ids.includes(user.userId)) {
      throw new Error('해당 면접 일정의 면접관만 평가표를 작성할 수 있습니다.');
    }

    // 기존 평가표가 있는지 확인
    const { data: existingScorecard } = await supabase
      .from('scorecards')
      .select('id')
      .eq('schedule_id', validatedScheduleId)
      .eq('interviewer_id', user.userId)
      .maybeSingle();

    if (existingScorecard) {
      throw new Error('이미 평가표가 존재합니다. 수정 기능을 사용해주세요.');
    }

    // 평가표 생성
    const scorecardData: ScorecardInsert = {
      schedule_id: validatedScheduleId,
      candidate_id: candidateId,
      interviewer_id: user.userId,
      overall_rating: overallRating,
      criteria_scores: criteriaScores,
      strengths: strengths || null,
      weaknesses: weaknesses || null,
      notes: notes || null,
    };

    const { data, error } = await supabase
      .from('scorecards')
      .insert(scorecardData)
      .select()
      .single();

    if (error) {
      throw new Error(`평가표 생성 실패: ${error.message}`);
    }

    // 타임라인 이벤트 생성
    const { error: timelineError } = await supabase.from('timeline_events').insert({
      candidate_id: candidateId,
      type: 'scorecard_created',
      content: {
        message: `면접 평가표가 작성되었습니다. (종합 평가: ${overallRating}/5)`,
        scorecard_id: data.id,
        schedule_id: validatedScheduleId,
        overall_rating: overallRating,
        interviewer_id: user.userId,
      },
      created_by: user.userId,
    });

    if (timelineError) {
      console.error('[타임라인] 이벤트 생성 실패 (평가표 작성):', timelineError);
      if (timelineError.code === '23514') {
        console.error('[타임라인] DB 스키마 제약 조건 위반 - scorecard_created 타입이 허용되지 않음.');
      }
    }

    // 캐시 무효화
    revalidatePath(`/dashboard/candidates/${candidateId}`);
    revalidatePath('/dashboard/schedules');

    return data;
  });
}

/**
 * 평가표 수정
 * @param scorecardId 평가표 ID
 * @param formData 수정할 평가표 정보
 * @returns 수정된 평가표 데이터
 */
export async function updateScorecard(scorecardId: string, formData: FormData) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const supabase = await createClient();

    // 입력값 검증
    const validatedScorecardId = validateUUID(scorecardId, '평가표 ID');
    const overallRating = formData.get('overall_rating')
      ? validateNumberRange(
          parseInt(formData.get('overall_rating') as string),
          1,
          5,
          '종합 평가'
        )
      : undefined;
    const criteriaScores = formData.get('criteria_scores')
      ? JSON.parse(formData.get('criteria_scores') as string)
      : undefined;
    const strengths = formData.get('strengths') as string | null;
    const weaknesses = formData.get('weaknesses') as string | null;
    const notes = formData.get('notes') as string | null;

    // 기존 평가표 조회
    const { data: existingScorecard, error: fetchError } = await supabase
      .from('scorecards')
      .select('id, candidate_id, schedule_id, interviewer_id, overall_rating')
      .eq('id', validatedScorecardId)
      .single();

    if (fetchError || !existingScorecard) {
      throw new Error('평가표를 찾을 수 없습니다.');
    }

    // 권한 확인 (작성자만 수정 가능)
    if (existingScorecard.interviewer_id !== user.userId) {
      throw new Error('평가표를 수정할 권한이 없습니다.');
    }

    // 후보자 접근 권한 확인
    await verifyCandidateAccess(existingScorecard.candidate_id);

    // 평가표 수정
    const updateData: ScorecardUpdate = {};
    if (overallRating !== undefined) updateData.overall_rating = overallRating;
    if (criteriaScores !== undefined) updateData.criteria_scores = criteriaScores;
    if (strengths !== null) updateData.strengths = strengths;
    if (weaknesses !== null) updateData.weaknesses = weaknesses;
    if (notes !== null) updateData.notes = notes;

    const { data, error } = await supabase
      .from('scorecards')
      .update(updateData)
      .eq('id', validatedScorecardId)
      .select()
      .single();

    if (error) {
      throw new Error(`평가표 수정 실패: ${error.message}`);
    }

    // 타임라인 이벤트 생성
    const ratingChanged = overallRating !== undefined && overallRating !== existingScorecard.overall_rating;
    const { error: timelineError } = await supabase.from('timeline_events').insert({
      candidate_id: existingScorecard.candidate_id,
      type: 'scorecard_created',
      content: {
        message: ratingChanged
          ? `면접 평가표가 수정되었습니다. (종합 평가: ${existingScorecard.overall_rating}/5 → ${overallRating}/5)`
          : '면접 평가표가 수정되었습니다.',
        scorecard_id: validatedScorecardId,
        schedule_id: existingScorecard.schedule_id,
        overall_rating: overallRating || existingScorecard.overall_rating,
        previous_rating: ratingChanged ? existingScorecard.overall_rating : undefined,
        interviewer_id: user.userId,
      },
      created_by: user.userId,
    });

    if (timelineError) {
      console.error('[타임라인] 이벤트 생성 실패 (평가표 수정):', timelineError);
      if (timelineError.code === '23514') {
        console.error('[타임라인] DB 스키마 제약 조건 위반 - scorecard_created 타입이 허용되지 않음.');
      }
    }

    // 캐시 무효화
    revalidatePath(`/dashboard/candidates/${existingScorecard.candidate_id}`);
    revalidatePath('/dashboard/schedules');

    return data;
  });
}
