## Activity Timeline 스레드: `activity_thread_root_* does not exist`

### 증상
- 답장 시트를 열 때 콘솔/토스트에 `column comments.activity_thread_root_timeline_event_id does not exist` (또는 `activity_thread_root_email_id`) 오류

### 원인
- 로컬/원격 Supabase DB에 스레드·인용용 마이그레이션이 아직 적용되지 않음

### 해결
1. 저장소의 [`supabase/migrations/20260423120000_activity_timeline_threads_quotes.sql`](../supabase/migrations/20260423120000_activity_timeline_threads_quotes.sql) 파일을 연다.
2. Supabase 대시보드 → **SQL Editor** → 내용 전체를 붙여넣고 **Run** 한다.
3. (CLI 사용 시) 프로젝트 루트에서 `supabase db push` 또는 팀에서 쓰는 배포 파이프라인으로 동일 마이그레이션을 적용한다.

### 참고
- 적용 후 `comments`에 두 컬럼이 생기고, `timeline_events.type` CHECK에 `activity_quote`가 포함되어야 답장·인용이 정상 동작한다.

## Candidate 상세 모달 스크롤 가림(줌 배율 이슈)

### 증상
- 브라우저 화면 배율(예: 80% / 90%)을 키우면 `후보자 상세` 모달 내부의 하단 영역이 가려짐
- `Profile`뿐 아니라 `AI Insight`, `Activity Timeline` 탭에서도 동일하게 스크롤이 끝까지 되지 않음
- 스크롤을 최대로 내려도 마지막 콘텐츠가 보이지 않음

### 원인
- `CandidateDetailLayout` / `CandidateDetailSkeleton` 루트가 `h-[820px]`로 고정되어 있음
- 모달은 `DialogContent`에서 `max-h-[90vh]` 제한만 걸고 “실제 높이(height)”를 확정하지 않아서,
  브라우저 배율 변경 시 내부 flex/overflow 레이아웃 계산이 어긋나 스크롤 영역이 제대로 확보되지 않음

### 해결
- `CandidateDetailDialog`에서 `DialogContent`에 실제 높이(`h-[calc(100dvh-2rem)]`)를 부여하고 `max-h`도 동일 값으로 맞춤
- `CandidateDetailLayout` / `CandidateDetailSkeleton`의 고정 높이(`h-[820px]`)를 제거하고 `h-full min-h-0`로 변경
- 결과적으로 `AI Insight` / `Activity Timeline` 내부의 `overflow-y-auto` 컨테이너가 정상 높이를 가져 끝까지 스크롤 가능

### 참고 파일
- `components/candidates/CandidateDetailDialog.tsx`
- `components/candidates/detail/CandidateDetailLayout.tsx`
- `components/candidates/CandidateDetailSkeleton.tsx`

## 구글 캘린더 웹훅이 동작하지 않음

### 증상
- 면접관이 구글 캘린더 초대에서 `수락/거절`을 해도, `Activity Timeline`에 `interviewer_response` 이벤트가 늦게(또는 전혀) 나타나지 않음
- 그 결과 `pending_candidate` / `needs_rescheduling`로 워크플로우가 자동 전환되지 않음

### 체크리스트
1. `GOOGLE_CALENDAR_WEBHOOK_URL` 설정이 올바른지 확인합니다.
   - 구글은 `events.watch`에 등록된 `address`로 호출합니다.
   - 로컬 테스트라면 ngrok 같은 공개 URL로 설정해야 합니다.
2. 서버 로그에서 `app/api/webhooks/google-calendar-events/route.ts` 관련 로그가 찍히는지 확인합니다.
   - watch 매핑을 찾지 못하면 `watch 매핑을 찾을 수 없습니다.`(404)가 반환됩니다.
3. `schedule_options.watch_channel_id/watch_resource_id/watch_token` 값이 실제로 저장되는지 확인합니다.
   - 스케줄 자동화 생성 직후(옵션 생성 후) 이 컬럼들이 비어있지 않아야 합니다.
4. `X-Goog-Channel-Token` 헤더 값이 DB의 `schedule_options.watch_token`과 매칭되는지 확인합니다.
   - 현재 구현은 토큰(`x-goog-channel-token`)을 우선 매칭합니다.

### 빠른 재현/테스트 방법
1. 면접 일정 자동화(`scheduleInterviewAutomated`)를 실행합니다.
2. 면접관이 구글 캘린더 초대에서 `수락` 또는 `거절`을 수행합니다.
3. 잠깐(수 초~수 분) 기다린 뒤 `Activity Timeline`에서 `interviewer_response` 이벤트가 추가되고,
   - 전원 수락 시: 후보자에게 메일 전송 후 `pending_candidate`로 전환
   - 전원 거절 또는 혼합 응답 시: `schedule_options` 상태/`needs_rescheduling` 전환을 확인합니다.

## 인터뷰룸(회의실)에 종일 일정이 있는데도 자동화가 제안/초대를 보냄

### 증상
- 인터뷰룸 캘린더에 1박2일 워크샵 같은 **종일 일정**이 있는데도, 해당 날짜에 면접 옵션이 생성되거나 초대가 발송됨

### 원인 후보
- 인터뷰룸 캘린더 ID가 자동화 충돌 계산에 포함되지 않음(면접관 `primary`만 조회하는 경우)
- 종일 일정(`start.date`)을 busy로 변환하지 않아 충돌로 잡히지 않음
- 인터뷰룸 캘린더가 조직/사용자 계정에 공유되어 있지 않아 API로 읽을 권한이 없음
- 이벤트가 `사용 가능(Free)`로 설정되어 있음(`transparency=transparent`)

### 체크리스트
1. 환경변수 `INTERVIEW_ROOM_CALENDAR_ID`가 올바른지 확인합니다.
2. 인터뷰룸 캘린더가 “자동화를 실행하는 구글 계정(Organizer)”에 **보기 권한 이상**으로 공유되어 있는지 확인합니다.
3. 해당 종일 일정이 `사용 가능(Free)`가 아니라 `바쁨(Busy)`인지 확인합니다.
4. (디버그) `CALENDAR_AVAILABILITY_DEBUG=true`를 설정 후 자동화를 실행하면,
   - 룸/면접관에서 조회된 busy 개수와 샘플이 서버 로그에 출력됩니다.

## AI 일정 자동화: `403 You need to have writer access to this calendar`

### 증상
- 면접 일정 자동화 실행 시 토스트/서버 로그에 `You need to have writer access to this calendar.`(403)가 발생합니다.
- Google Calendar UI에서 공유 권한을 “변경 및 공유 관리”로 줬는데도 잠깐 동안 동일 오류가 반복될 수 있습니다.

### 원인(핵심)
- OAuth로 “캘린더 API 쓰기 스코프”를 받았다는 것과 별개로, **특정 공유(그룹) 캘린더(`INTERVIEW_ROOM_CALENDAR_ID`)에 대한 ACL 쓰기 권한**이 없으면 Google이 `events.insert`에서 403을 반환합니다.
- 공유 권한 변경 직후에는 Google 쪽 **전파 지연**으로 잠깐 동안 writer가 아닌 것처럼 보일 수 있습니다.

### 빠른 확인(권장)
1. `/dashboard/connect-calendar`에서 **“테스트 일정 생성(인터뷰룸 / INTERVIEW_ROOM_CALENDAR_ID)”** 버튼으로 쓰기 테스트를 수행합니다.
   - 성공하면: 자동화의 `events.insert`도 동일하게 성공할 가능성이 큽니다.
   - 실패하면: 공유 대상/권한 레벨/캘린더 주소(Calendar address) 불일치부터 다시 확인합니다.
2. 서버 로그에서 아래를 함께 확인합니다.
   - `[ScheduleActions] Using INTERVIEW_ROOM_CALENDAR_ID = ...` (앱이 실제로 참조하는 캘린더 ID)
   - `[Google Calendar][면접 일정 자동화] 토큰 계정 진단`의 `organizerEmail` / `googleEmail` (토큰 소유자)

### 해결 체크리스트
1. `INTERVIEW_ROOM_CALENDAR_ID`가 Google 캘린더의 **Calendar address**와 정확히 일치하는지 확인합니다.
2. 자동화를 실행하는 구글 계정(로그의 `googleEmail`)이 해당 캘린더에 **“이벤트 변경(쓰기)” 이상** 권한으로 공유되어 있는지 확인합니다.
3. 권한을 방금 변경했다면 **5~30분 후 재시도**하거나 `/dashboard/connect-calendar`에서 **재연동** 후 다시 시도합니다.
4. 그래도 지속되면 Google Workspace **관리자 정책(공유/캘린더 제한)** 가능성을 검토합니다.

## 외부(비가입) 면접관이 바쁜데도 겹치는 옵션이 생성됨 / 또는 자동화가 중단됨

### 증상
- 외부 면접관(이메일 초대, 예: `kkh7324@vntgcorp.com`)이 이미 바쁜 시간이 있는데도 겹치는 `[Block] ... (확정 대기)` 옵션이 생성/초대됨
- 또는 최근 수정 이후, 외부 면접관 캘린더를 조회할 수 없다는 메시지로 자동화가 중단됨

### 원인
- 외부 면접관은 플랫폼에 가입되어 있지 않아 “사용자 토큰 기반”으로는 캘린더 조회가 불가능합니다.
- 대신 자동화 실행 주체(채용담당자/Organizer) 토큰으로 **외부 이메일 캘린더(=이메일 주소)** 를 FreeBusy로 조회해야 하는데,
  캘린더가 공유되어 있지 않으면 Google Calendar API에서 403/404 또는 FreeBusy errors가 반환됩니다.

### 해결
1. 외부 면접관이 자신의 Google Calendar를 **채용담당자(Organizer) 구글 계정**에 공유합니다.
   - 권장 권한: “바쁨 정보 보기” 이상(조직 정책에 따라 다를 수 있음)
2. 또는 외부 면접관이 플랫폼에 가입한 뒤 `/dashboard/connect-calendar`에서 구글 캘린더를 연동합니다.
3. (디버그) `CALENDAR_AVAILABILITY_DEBUG=true`를 설정 후 자동화를 실행하여,
   - `externalBusyCount` / `externalBusySample` 로그가 찍히는지 확인합니다.

## “완전 삭제”를 눌렀는데 ‘이미 삭제된 일정’만 뜨고 상태/캘린더가 남음

### 증상
- `AI 스케줄링 코파일럿`에서 **현재 스케줄링 완전 삭제**를 눌렀을 때,
  - `이미 삭제된 일정이어서 목록을 최신화했습니다.` 안내만 표시됨
  - 화면에서는 여전히 `확정` 상태가 유지됨
  - 구글 캘린더(인터뷰룸 캘린더)의 확정 일정도 삭제되지 않음

### 원인
- 스케줄 목록 조회는 Service Role 기반으로 정상 조회되지만,
  삭제 액션(`deleteSchedule`)에서 **스케줄 존재 여부를 RLS가 걸린 클라이언트로 먼저 조회**하면
  권한 조건에 따라 “없는 일정”으로 오인하여 삭제 로직(캘린더 이벤트 삭제/DB 삭제)이 실행되지 않을 수 있습니다.
- 또한 구글 캘린더 이벤트는 **면접관 토큰이 아니라 Organizer(채용담당자) 토큰**으로 삭제해야 하는데,
  면접관 토큰만 찾으면 이벤트 삭제가 건너뛰어질 수 있습니다.

### 해결
- `deleteSchedule`에서 스케줄 조회를 Service Role로 안정적으로 수행하고, 권한은 `verifyCandidateAccess`로 검증합니다.
- 구글 캘린더 이벤트 삭제는 **현재 사용자(Organizer) 토큰을 우선 사용**하고, 없을 때만 면접관 토큰을 폴백으로 사용합니다.

## GitHub Actions / 커밋 메시지 한글 깨짐

### 증상
- GitHub Actions 탭(워크플로우 실행 기록)에서 커밋 메시지의 한글이 물음표/깨진 글자로 표시됨

### 원인
- Windows PowerShell 기본 인코딩이 UTF-8이 아니어서 `git commit -m "한글"` 시 커밋 메시지 바이트가 UTF-8이 아님
- GitHub UI는 커밋 메시지를 UTF-8로 가정하고 렌더링 → 모지바케(깨짐) 발생

### 해결
1. Git 전역 설정을 UTF-8로 고정
   ```powershell
   pwsh -File .\scripts\setup-git-korean-utf8.ps1
   ```
2. 커밋 시 전용 스크립트를 사용(메시지를 UTF-8 파일로 저장 후 `-F`로 전달)
   ```powershell
   .\scripts\git-commit-utf8.ps1 -Message "[Fix] 한글 메시지 예시" -All
   ```
3. (선택) PowerShell 세션 출력 인코딩을 UTF-8로 유지하면 로그 표시도 안정적
   - 위 스크립트가 세션 출력 인코딩을 UTF-8로 시도 설정합니다.

### 추가 팁
- 파일명 한글 깨짐을 줄이기 위해 `core.quotepath=false`가 설정되어야 합니다.
- 이미 깨진 과거 기록은 되돌리기 어렵습니다. 새 커밋부터 위 규칙을 적용하세요.
