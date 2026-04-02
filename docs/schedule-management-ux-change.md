# 일정 관리 UX 변경 사항 (2025.02.28)

## 변경 개요

기존에는 일정 등록을 후보자 상세 페이지에서 시작하고, 진행 현황 확인 및 관리는 별도의 Schedule Management(`/schedules`) 화면에서 해야 해서 사용자가 화면을 왔다갔다 해야 하는 불편함이 있었습니다.

이제는 **후보자 상세 페이지의 Activity Timeline 내에서 일정 진행 현황을 확인하고 관리할 수 있도록** 통합되었습니다.

## 주요 변경 사항

### 1. 일정 관리 통합

- **이전**: 후보자 상세 → 일정 등록 시작 → `/schedules` 화면으로 이동하여 진행 현황 확인/관리
- **현재**: 후보자 상세 → 일정 등록 시작 → Activity Timeline에서 진행 현황 확인 및 관리 (모든 작업을 한 화면에서)

### 2. Activity Timeline 개선

- **상단 요약 바**: 브랜드 컬러 그라데이션을 활용한 시각적 개선
- **일정 카드**: 타임라인 스트림 내에서 일정 관련 이벤트가 일반 이벤트처럼 자연스럽게 표시
- **인라인 액션**: 각 일정 카드에서 바로 재조율, 취소, 삭제 등의 액션 수행 가능

### 3. 제거된 기능

- `/schedules` 페이지 (Schedule Management 화면) 완전 제거
- 사이드바에서 "Schedule Management" 메뉴 항목 제거

## 기술적 변경 사항

### 컴포넌트 변경

- `ActivityTimeline`: 일정 관련 액션 콜백 props 추가 (`onDeleteSchedule`, `onCheckSchedule`)
- `TimelineEventContent`: 일정 카드에서 인라인 액션 버튼 렌더링
- `CandidateDetailClient`: 일정 액션 핸들러 구현 및 타임라인 재조회 로직 추가

### 파일 제거

- `app/(dashboard)/schedules/page.tsx`
- `app/(dashboard)/schedules/SchedulesClient.tsx`

### 네비게이션 변경

- `types/navigation.ts`: `schedules` AppView 타입 제거
- `components/modern/Sidebar.tsx`: Schedule Management 메뉴 항목 제거

## 사용자 가이드

### 일정 등록

1. 후보자 상세 페이지 좌측 사이드바에서 "일정 등록" 버튼 클릭
2. 일정 조율 폼 작성 (날짜 범위, 면접관 선택 등)
3. 제출 후 AI가 자동으로 일정 옵션 생성

### 일정 진행 현황 확인 및 관리

1. 후보자 상세 페이지의 Activity Timeline 섹션으로 스크롤
2. 타임라인 내에서 "면접 일정 생성" 또는 "면접 일정 재생성" 이벤트 카드 확인
3. 카드 하단의 액션 버튼을 사용하여:
   - **재조율**: 새로운 일정 옵션 생성
   - **일정 취소**: 워크플로우 상태를 'cancelled'로 변경
   - **완전 삭제**: 일정을 완전히 삭제 (되돌릴 수 없음)

### 일정 상태 표시

- 타임라인 상단 요약 바에서 다음 면접 일정 정보 확인 가능
- 각 일정 카드에서 생성된 옵션 수, 면접관 응답 상태 등 확인 가능

## 향후 개선 사항

- 일정 확정/완료 처리 액션 추가
- 일정 옵션별 상세 정보 표시
- 면접관 응답 상태 실시간 업데이트
