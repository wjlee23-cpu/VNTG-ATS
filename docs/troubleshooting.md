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
