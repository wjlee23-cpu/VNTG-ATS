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

