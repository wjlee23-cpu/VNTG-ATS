'use server';

import { createServiceClient } from '@/lib/supabase/server';
import { withErrorHandling } from '@/api/utils/errors';
import { validateUUID } from '@/api/utils/validation';

type JsonObject = Record<string, any>;

export type ScheduleAutomationStatus =
  | 'pending_interviewers'
  | 'regenerated'
  | 'needs_rescheduling'
  | 'pending_candidate'
  | 'confirmed'
  | 'cancelled'
  | 'deleted';

export type UpsertScheduleAutomationTimelineInput = {
  candidateId: string;
  scheduleId: string;
  createdBy: string | null;
  /**
   * 타임라인 이벤트 타입
   * - 기존 UI/타이틀 매핑과 호환을 위해 기본은 schedule_created를 사용합니다.
   */
  type?: 'schedule_created';
  /**
   * 최신 요약 메시지 (카드 상단에 표시)
   */
  latestMessage: string;
  /**
   * 자동화 워크플로우 상태 (카드 상태 뱃지로 표시)
   */
  automationStatus: ScheduleAutomationStatus;
  /**
   * 현재 유효한 일정 옵션(표시용)
   */
  scheduleOptions?: Array<{ id: string; scheduled_at: string }>;
  /**
   * 면접관 응답 요약(표시용)
   */
  interviewerSummary?: {
    accepted: number;
    declined: number;
    pending: number;
    tentative?: number;
    total: number;
  };
  /**
   * 카드 내부 히스토리(감사 추적용)
   * - 새 이벤트를 위에 쌓지 않고, 같은 카드 안에서 변화 이력을 누적합니다.
   */
  appendHistory?: Array<{ at: string; message: string }>;
  /**
   * 기존 content에 합쳐 넣을 추가 데이터(확장용)
   */
  extraContent?: JsonObject;
};

function mergeHistory(
  existing: any,
  append?: Array<{ at: string; message: string }>,
): Array<{ at: string; message: string }> {
  const prev = Array.isArray(existing) ? existing : [];
  const next = Array.isArray(append) ? append : [];
  const merged = [...prev, ...next];

  // 중복(동일 at+message) 제거
  const seen = new Set<string>();
  const deduped: Array<{ at: string; message: string }> = [];
  for (const item of merged) {
    const key = `${item?.at ?? ''}::${item?.message ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (item?.at && item?.message) deduped.push({ at: item.at, message: item.message });
  }
  return deduped;
}

/**
 * "면접 일정 자동화 카드"를 schedule_id 기준으로 업서트(갱신)합니다.
 * - insert로 새 줄을 쌓지 않고, 같은 카드에서 status/message/options/history를 업데이트합니다.
 */
export async function upsertScheduleAutomationTimeline(input: UpsertScheduleAutomationTimelineInput) {
  return withErrorHandling(async () => {
    const candidateId = validateUUID(input.candidateId, 'candidateId');
    const scheduleId = validateUUID(input.scheduleId, 'scheduleId');
    const type = input.type ?? 'schedule_created';

    // Service Role로 RLS 영향 없이 안정적으로 upsert합니다.
    const supabase = createServiceClient();

    // 기존 카드가 있으면 history 누적을 위해 먼저 조회합니다.
    const { data: existing, error: existingError } = await supabase
      .from('timeline_events')
      .select('id, content, created_at')
      .eq('candidate_id', candidateId)
      .eq('schedule_id', scheduleId)
      .eq('type', type)
      .maybeSingle();

    if (existingError) {
      throw new Error(`타임라인 기존 카드 조회 실패: ${existingError.message}`);
    }

    const existingContent = (existing?.content as any) || {};
    const nowIso = new Date().toISOString();

    const mergedContent: JsonObject = {
      ...existingContent,
      ...(input.extraContent || {}),
      message: input.latestMessage, // 기존 UI가 message를 보여주므로 호환 유지
      latest_message: input.latestMessage,
      automation_status: input.automationStatus,
      schedule_id: scheduleId, // content에도 유지(레거시 대비)
      schedule_options: input.scheduleOptions ?? existingContent?.schedule_options,
      interviewer_summary: input.interviewerSummary ?? existingContent?.interviewer_summary,
      updated_at: nowIso,
      history: mergeHistory(existingContent?.history, input.appendHistory),
    };

    // created_at은 “처음 카드가 만들어진 시각”을 유지해야 타임라인이 계속 위로 솟지 않습니다.
    // - 기존 카드가 있으면 created_at 유지
    // - 없으면 now로 생성
    const createdAtToPersist = existing?.created_at ? (existing.created_at as string) : nowIso;

    // 업서트(유니크 인덱스: candidate_id, schedule_id, type)
    const { error: upsertError } = await supabase.from('timeline_events').upsert(
      {
        candidate_id: candidateId,
        schedule_id: scheduleId,
        type,
        content: mergedContent,
        created_by: input.createdBy,
        created_at: createdAtToPersist,
      } as any,
      {
        onConflict: 'candidate_id,schedule_id,type',
      },
    );

    if (upsertError) {
      throw new Error(`타임라인 카드 업서트 실패: ${upsertError.message}`);
    }

    return { ok: true };
  });
}

