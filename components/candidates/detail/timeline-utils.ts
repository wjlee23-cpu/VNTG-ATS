import { STAGE_ID_TO_NAME_MAP } from '@/constants/stages';
import type { TimelineEvent } from '@/types/candidate-detail';

/** DB/레거시 값이 대소문자 혼용일 때 평가 결과를 통일합니다. */
export function normalizeStageEvalResult(r: unknown): 'pass' | 'fail' | 'pending' | undefined {
  if (r === 'pass' || r === 'fail' || r === 'pending') return r;
  if (typeof r === 'string') {
    const u = r.toLowerCase();
    if (u === 'pass') return 'pass';
    if (u === 'fail') return 'fail';
    if (u === 'pending' || u === 'hold') return 'pending';
  }
  return undefined;
}

/** 타임라인 이벤트 제목 */
export function getTimelineEventTitle(event: TimelineEvent): string {
  switch (event.type) {
    case 'scorecard':
    case 'scorecard_created':
      return '면접 평가표 작성';
    case 'email':
      // 제목은 본문 카드에만 표시해 헤더 중복을 줄입니다.
      return '이메일 발송';
    case 'email_received':
      return '이메일 수신';
    case 'comment':
    case 'comment_created':
      return '코멘트 작성';
    case 'comment_updated':
      return '코멘트 수정';
    case 'stage_changed':
      return '전형 단계 변경';
    case 'schedule_created':
      return '면접 일정 생성';
    case 'schedule_confirmed':
      return '면접 일정 확정';
    case 'schedule_deleted':
      return '면접 일정 삭제';
    case 'schedule_regenerated':
      return '면접 일정 재생성';
    case 'interviewer_response':
      return event.content?.all_accepted ? '모든 면접관 수락' : '면접관 응답';
    case 'position_changed':
      return '포지션 변경';
    case 'system_log':
      return '시스템 로그';
    case 'archive':
      return '아카이브';
    case 'stage_evaluation': {
      const stageName = event.content?.stage_id
        ? (STAGE_ID_TO_NAME_MAP[event.content.stage_id as string] ||
          event.content?.stage_name ||
          '전형 평가')
        : (event.content?.stage_name || '전형 평가');
      return `${stageName} 평가`;
    }
    default:
      return event.type;
  }
}

/** 타임라인 이벤트 제목 색상 클래스 */
export function getTimelineEventColor(type: string): string {
  switch (type) {
    case 'scorecard':
    case 'scorecard_created':
      return 'text-yellow-600';
    case 'email':
    case 'email_received':
      return 'text-blue-600';
    case 'comment':
    case 'comment_created':
    case 'comment_updated':
      return 'text-slate-600';
    case 'stage_changed':
      return 'text-purple-600';
    case 'schedule_created':
    case 'schedule_confirmed':
    case 'schedule_deleted':
    case 'schedule_regenerated':
      return 'text-green-600';
    case 'interviewer_response':
      return 'text-green-600';
    case 'position_changed':
      return 'text-indigo-600';
    case 'archive':
      return 'text-orange-600';
    case 'stage_evaluation':
      return 'text-yellow-600';
    default:
      return 'text-muted-foreground';
  }
}
