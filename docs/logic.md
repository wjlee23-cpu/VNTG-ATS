# Google OAuth (로그인·캘린더·Gmail)

- 캘린더·Gmail이 필요한 기능은 **반드시 `/api/auth/google` 계열**(로그인 `type` 기본값 또는 `type=connect`)만 사용합니다. 루트 랜딩 등에서 Supabase `signInWithOAuth({ provider: 'google' })`만 쓰면 `users`에 refresh 토큰이 저장되지 않아 일정 자동화가 동작하지 않습니다.

# Activity Timeline — 멘션·스레드·인용

- **멘션**: 본문에 `@[사용자UUID]` 형태로 저장하고, 화면에서는 조직 사용자 목록으로 표시 이름을 치환합니다. `comments.mentioned_user_ids`에 UUID를 함께 저장합니다.
- **스레드(답장)**: `comments`에 `activity_thread_root_timeline_event_id` 또는 `activity_thread_root_email_id`가 설정되면 해당 코멘트는 **메인 타임라인에 새 `timeline_events` 행을 만들지 않습니다.** (합성 이메일 행은 `emails.id`를 루트로 사용)
- **인용**: `createQuotedActivityTimelineEntry`가 `timeline_events`에 `type = activity_quote`만 추가하며, `content.quoted_snapshot`에 원문 요약을 넣습니다.
  - UI 정책: 인용 버튼 클릭 시 별도 모달을 띄우지 않고, **메모 작성 입력창 상단에 인용 프리뷰를 붙여** 같은 입력창에서 메시지를 작성/전송합니다.
- **리액션(이모지)**: 타임라인 항목에 이모지 반응을 달 수 있습니다.
  - 정책: 이벤트(타임라인 행)당 이모지 종류/개수 제한은 없지만, **같은 계정은 같은 이모지를 1번만** 누를 수 있습니다. 다시 누르면 취소(토글)됩니다.
  - 저장: `timeline_event_reactions`에 `(timeline_event_id, user_id, emoji)` 유니크로 저장합니다.

# 스케줄링 비즈니스 로직

## 타임존
- 모든 슬롯 생성과 요일/점심 등의 시간 비교는 한국시간(KST, `Asia/Seoul`) 기준으로 수행합니다.
- 내부 비교 및 캘린더 API 호출용 `dateTime`은 UTC ISO 문자열을 사용하되, Google Calendar 이벤트에는 `timeZone: 'Asia/Seoul'`을 함께 설정합니다.

## 가능시간/제외시간
- 기본 가능시간: 10:00 ~ 17:00
- 기본 제외시간: 11:30 ~ 12:30
- “가능 시간대(allowed)”가 전달되면 해당 구간 내에서만 슬롯을 생성합니다. 전달되지 않으면 기본 비즈니스 시간(10~17시)을 사용합니다.
- “제외 시간대(excluded)”는 항상 우선 적용됩니다. 즉, 가능시간 안에 있더라도 제외시간에 속하면 슬롯을 만들지 않습니다.
- 부분 겹침 포함: 슬롯 [시작, 종료)와 제외시간 [시작, 종료) 사이에 교집합이 존재하면 해당 슬롯을 생성하지 않습니다. (예: 11:15~12:15, 11:30~12:30 등 모두 제외)

## 면접관 선호
- 선호 없음(none): 모든 가능시간 허용
- 오전만(morning): 10:00 ~ 11:30만 허용 (점심 11:30~12:30은 자동 제외)
- 오후만(afternoon): 13:00 ~ 17:00만 허용
- 선호는 슬롯별 `availableInterviewers` 계산 시 반영되며, 선호와 맞지 않는 인터뷰어는 해당 슬롯에서 불가 처리됩니다.

## 주말/공휴일
- KST 기준 토/일과 한국 공휴일(`isKoreanHoliday`)은 슬롯 생성에서 제외합니다.

## 데이터 흐름
1. UI(`components/candidates/ScheduleInterviewAutomatedModal.tsx`)에서 기간, 면접관, (선택)가능시간, (선택)제외시간, 면접관 선호를 입력합니다.
2. 서버 액션(`api/actions/schedules.ts`)이 파라미터를 수신합니다.
   - 제외시간이 비어있으면 기본값 11:30~12:30을 자동 적용합니다.
3. 슬롯 생성기(`lib/ai/schedule.ts`)가
   - KST 경계로 날짜를 순회
   - allowed/excluded/prefs을 반영하여 후보 슬롯을 생성
   - 점수화/정렬/간격유지 후 최종 옵션을 반환합니다.

## 보안/기타
- 모든 이벤트 생성 시 `timeZone: 'Asia/Seoul'`을 명시하여 사용자 캘린더 표시와 일치시킵니다.
- 재시도/재조율 로직은 기존 옵션과 중복되지 않도록 busy time에 포함하여 필터링합니다.

## 인터뷰룸 캘린더 정책
- 면접 일정은 면접관 개인 캘린더가 아니라 “인터뷰룸 전용 캘린더”에 직접 생성합니다.
- Organizer(주최자)는 기존과 동일하게 채용담당자 계정을 사용합니다.
- 사용 캘린더 ID는 환경변수 `INTERVIEW_ROOM_CALENDAR_ID`로 주입되며, 미설정 시 `primary`로 폴백합니다.
- 생성/수정/삭제 등 모든 Calendar API 호출은 동일한 캘린더 ID로 수행됩니다.
- 운영 추적을 위해 `schedule_options.interviewer_responses._metadata.googleCalendarIdUsed`에 사용한 캘린더 ID를 기록합니다.

## 캘린더 충돌(바쁨) 계산 규칙
- 자동화 제안 슬롯은 “면접관(들) + 인터뷰룸(회의실) 캘린더”의 바쁨(busy)과 **하나라도 겹치면 생성되지 않습니다.**
- 면접관 캘린더의 바쁨 조회는 **면접관 개인 OAuth 토큰이 아니라, 채용담당자(Organizer) 구글 계정 권한**으로 수행합니다.
  - 내부(가입) 면접관: `users.email`을 **calendarId(이메일)**로 사용해 FreeBusy 조회합니다.
  - 외부(비가입) 면접관: `schedules.external_interviewer_emails`의 이메일을 **calendarId(이메일)**로 사용해 FreeBusy 조회합니다.
  - 전제: 자동화를 실행하는 채용담당자(Organizer) 구글 계정이 해당 캘린더를 조회할 수 있어야 합니다(공유/권한).
  - 정책: 특정 면접관/회의실 캘린더를 조회할 수 없으면(권한/공유 문제 등) **자동화는 중단**되며, “캘린더 공유 설정 필요”로 안내합니다.
- Google Calendar에서 바쁨은 다음 이벤트를 포함합니다.
  - 일반 일정: `start.dateTime` / `end.dateTime`
  - 종일 일정: `start.date` / `end.date` (**종료일은 exclusive**)
- 종일 일정은 KST(`Asia/Seoul`) 기준으로 다음처럼 변환하여 비교합니다.
  - 시작: `start.date`의 00:00 KST
  - 종료: `end.date`의 00:00 KST (exclusive 그대로)
- `transparency=transparent`(사용 가능) 또는 `status=cancelled`인 이벤트는 바쁨에서 제외합니다.

## 이메일 템플릿
- 표준 치환 키는 `{{candidate.name}}`, `{{job.title}}`, `{{interview.location}}` 등 `lib/email/template.ts`의 `EmailTemplateContext`와 동일한 dot 경로를 사용합니다.
- 과거 워드 문서형 `{{ApplicantName}}`, `{{PositionName}}`, `{{InterviewDateTimeText}}` 등은 동일 로직에서 자동으로 위 경로에 매핑됩니다.
- VNTG 기본 안내 10종은 마이그레이션 `20260409120000_seed_vntg_default_email_templates.sql`로 **각 조직**에 삽입됩니다. 해당 조직에 `admin`/`recruiter` 사용자가 없으면 그 조직에는 행이 생기지 않으며, **이미 동일 `name`의 템플릿이 있으면 건너뜁니다.** 원문은 `constants/vntg-builtin-email-templates.ts`에서 유지·수정 후 `scripts/generate-vntg-email-templates-migration.ts`로 SQL을 다시 생성할 수 있습니다.
