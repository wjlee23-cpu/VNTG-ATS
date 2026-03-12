'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { getCurrentUser, verifyCandidateAccess } from '@/api/utils/auth';
import { validateUUID } from '@/api/utils/validation';
import { withErrorHandling } from '@/api/utils/errors';

/**
 * Offer 수락 처리
 * @param offerId Offer ID
 * @returns 업데이트된 Offer 데이터
 */
export async function acceptOffer(offerId: string) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const isAdmin = user.role === 'admin';
    const supabase = isAdmin ? createServiceClient() : await createClient();

    // Offer 조회 및 후보자 접근 권한 확인
    const { data: offer, error: offerError } = await supabase
      .from('offers')
      .select('*, candidates!inner(id)')
      .eq('id', validateUUID(offerId, 'Offer ID'))
      .single();

    if (offerError || !offer) {
      throw new Error('Offer를 찾을 수 없습니다.');
    }

    const candidate = offer.candidates as { id: string } | null | undefined;
    if (!candidate) {
      throw new Error('후보자 정보를 찾을 수 없습니다.');
    }

    // 후보자 접근 권한 확인
    await verifyCandidateAccess(candidate.id);

    // Offer 상태 업데이트
    const { data: updatedOffer, error: updateError } = await supabase
      .from('offers')
      .update({
        offer_status: 'accepted',
        offer_response_at: new Date().toISOString(),
      })
      .eq('id', offerId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Offer 수락 처리 실패: ${updateError.message}`);
    }

    // 타임라인 이벤트 생성
    const { error: timelineError } = await supabase.from('timeline_events').insert({
      candidate_id: candidate.id,
      type: 'system_log',
      content: {
        message: 'Offer가 수락되었습니다.',
        action: 'offer_accepted',
        offer_id: offerId,
      },
      created_by: user.userId,
    });

    if (timelineError) {
      console.error('[타임라인] 이벤트 생성 실패 (Offer 수락):', timelineError);
    }

    // 캐시 무효화
    revalidatePath('/candidates');
    revalidatePath(`/candidates/${candidate.id}`);
    revalidatePath('/offers');

    return updatedOffer;
  });
}

/**
 * Offer 거절 처리
 * @param offerId Offer ID
 * @returns 업데이트된 Offer 데이터
 */
export async function rejectOffer(offerId: string) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const isAdmin = user.role === 'admin';
    const supabase = isAdmin ? createServiceClient() : await createClient();

    // Offer 조회 및 후보자 접근 권한 확인
    const { data: offer, error: offerError } = await supabase
      .from('offers')
      .select('*, candidates!inner(id)')
      .eq('id', validateUUID(offerId, 'Offer ID'))
      .single();

    if (offerError || !offer) {
      throw new Error('Offer를 찾을 수 없습니다.');
    }

    const candidate = offer.candidates as { id: string } | null | undefined;
    if (!candidate) {
      throw new Error('후보자 정보를 찾을 수 없습니다.');
    }

    // 후보자 접근 권한 확인
    await verifyCandidateAccess(candidate.id);

    // Offer 상태 업데이트
    const { data: updatedOffer, error: updateError } = await supabase
      .from('offers')
      .update({
        offer_status: 'rejected',
        offer_response_at: new Date().toISOString(),
      })
      .eq('id', offerId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Offer 거절 처리 실패: ${updateError.message}`);
    }

    // 타임라인 이벤트 생성
    const { error: timelineError } = await supabase.from('timeline_events').insert({
      candidate_id: candidate.id,
      type: 'system_log',
      content: {
        message: 'Offer가 거절되었습니다.',
        action: 'offer_rejected',
        offer_id: offerId,
      },
      created_by: user.userId,
    });

    if (timelineError) {
      console.error('[타임라인] 이벤트 생성 실패 (Offer 거절):', timelineError);
    }

    // 캐시 무효화
    revalidatePath('/candidates');
    revalidatePath(`/candidates/${candidate.id}`);
    revalidatePath('/offers');

    return updatedOffer;
  });
}

/**
 * 입사 확정 처리 (오퍼 단계에서 입사 확정으로 이동)
 * @param candidateId 후보자 ID
 * @returns 업데이트된 Offer 데이터
 */
export async function confirmHire(candidateId: string) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const isAdmin = user.role === 'admin';
    const supabase = isAdmin ? createServiceClient() : await createClient();

    // 후보자 접근 권한 확인
    await verifyCandidateAccess(candidateId);

    // 후보자의 오퍼 조회
    const { data: offer, error: offerError } = await supabase
      .from('offers')
      .select('*')
      .eq('candidate_id', validateUUID(candidateId, '후보자 ID'))
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (offerError || !offer) {
      throw new Error('후보자의 오퍼를 찾을 수 없습니다. 먼저 오퍼를 생성해주세요.');
    }

    // 이미 accepted 상태인지 확인
    if (offer.offer_status === 'accepted') {
      throw new Error('이미 입사 확정된 후보자입니다.');
    }

    // Offer 상태를 'accepted'로 업데이트
    const { data: updatedOffer, error: updateError } = await supabase
      .from('offers')
      .update({
        offer_status: 'accepted',
        offer_response_at: new Date().toISOString(),
      })
      .eq('id', offer.id)
      .select()
      .single();

    if (updateError) {
      throw new Error(`입사 확정 처리 실패: ${updateError.message}`);
    }

    // 타임라인 이벤트 생성
    const { error: timelineError } = await supabase.from('timeline_events').insert({
      candidate_id: candidateId,
      type: 'system_log',
      content: {
        message: '입사가 확정되었습니다.',
        action: 'hire_confirmed',
        offer_id: offer.id,
      },
      created_by: user.userId,
    });

    if (timelineError) {
      console.error('[타임라인] 이벤트 생성 실패 (입사 확정):', timelineError);
    }

    // 캐시 무효화
    revalidatePath('/candidates');
    revalidatePath(`/candidates/${candidateId}`);
    revalidatePath('/dashboard/candidates');
    revalidatePath(`/dashboard/candidates/${candidateId}`);

    return updatedOffer;
  });
}