# Activity Timeline — 멘션·스레드·인용 (구현 요약)

## DB

- `comments`: `activity_thread_root_timeline_event_id`, `activity_thread_root_email_id` (배타적, FK)
- `timeline_events.type`: `activity_quote` 추가

## 서버

- `createComment`: 스레드 루트가 있으면 `timeline_events`에 `comment_created`를 넣지 않음
- `updateComment`: 스레드 전용 코멘트는 타임라인 JSON 갱신 생략
- `createQuotedActivityTimelineEntry`: 인용 시 메인 타임라인에만 `activity_quote` insert
- `api/queries/activity-threads.ts`: 스레드 목록·요약(count/lastAt)

## UI

- `MentionTextarea`, `ActivityThreadSheet`, 후보 상세 타임라인에 답장/요약/멘션
