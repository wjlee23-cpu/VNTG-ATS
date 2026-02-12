# 데이터베이스 아키텍처 요약

## 테이블 목록

### Phase 1: MVP 기본 테이블 (8개)
1. **organizations** - 조직
2. **users** - 사용자 (채용 담당자, 면접관)
3. **processes** - 채용 프로세스 템플릿
4. **job_posts** - 채용 공고
5. **candidates** - 후보자
6. **schedules** - 면접 일정
7. **schedule_options** - AI 생성 일정 옵션
8. **timeline_events** - 타임라인 이벤트

### Phase 2: 협업 강화 (3개)
9. **emails** - 이메일 동기화
10. **comments** - 코멘트 및 멘션
11. **scorecards** - 면접 평가표

### Phase 3: ATS 완성 (2개)
12. **resume_files** - 이력서 파일
13. **application_submissions** - 지원서 제출

**총 13개 테이블**

## 주요 관계

```
Organizations (1) ──< (N) Users
Organizations (1) ──< (N) Processes
Organizations (1) ──< (N) Job Posts
Job Posts (1) ──< (N) Candidates
Candidates (1) ──< (N) Schedules
Schedules (1) ──< (N) Schedule Options
Schedules (1) ──< (1) Scorecards
Candidates (1) ──< (N) Timeline Events
Candidates (1) ──< (N) Emails
Candidates (1) ──< (N) Comments
Candidates (1) ──< (N) Resume Files
Job Posts (1) ──< (N) Application Submissions
```

## 핵심 기능별 테이블 매핑

### 1. AI 일정 조율
- `schedules` - 확정 일정
- `schedule_options` - AI 생성 옵션
- `users` - 면접관 캘린더 정보

### 2. 프로세스 빌더
- `processes` - 프로세스 템플릿
- `candidates.current_stage_id` - 현재 단계

### 3. 후보자 대시보드
- `candidates` - 후보자 정보 및 상태
- `schedules` - 일정 정보

### 4. 타임라인 통합 뷰
- `timeline_events` - 모든 이벤트 통합
- `emails` - 이메일 히스토리
- `comments` - 코멘트
- `scorecards` - 평가표

### 5. 이력서 파싱
- `resume_files` - 업로드된 파일
- `candidates.parsed_data` - 파싱 결과
- `application_submissions` - 지원서 제출

## 인덱스 전략

### 성능 최적화 인덱스
- **조직 단위 필터링**: `organization_id` (모든 조직 관련 테이블)
- **후보자 조회**: `job_post_id`, `status`, `token`
- **일정 조회**: `candidate_id`, `status`, `scheduled_at`
- **타임라인 조회**: `candidate_id`, `created_at DESC`
- **이메일 동기화**: `message_id`, `candidate_id`
- **멘션 검색**: `mentioned_user_ids` (GIN 인덱스)
- **스킬 검색**: `skills` (GIN 인덱스)

## 자동화 기능

### 트리거 함수
1. **updated_at 자동 업데이트** - 모든 테이블
2. **Scorecard → Timeline Event** - 평가표 제출 시 자동 생성
3. **Email → Timeline Event** - 이메일 동기화 시 자동 생성
4. **Comment → Timeline Event** - 코멘트 작성 시 자동 생성
5. **Resume Parsing → Candidate Update** - 파싱 완료 시 후보자 정보 업데이트

## 보안 (RLS)

모든 테이블에 Row Level Security 활성화:
- 조직 단위 데이터 격리
- 사용자는 자신의 조직 내 데이터만 접근
- 면접관은 자신이 참여하는 일정만 조회
- 코멘트는 작성자만 수정/삭제 가능

## 마이그레이션 파일

1. **001_initial_schema.sql** - Phase 1 기본 테이블
2. **002_phase2_features.sql** - Phase 2 기능 추가
3. **003_phase3_resume_parsing.sql** - Phase 3 기능 추가
4. **000_complete_schema.sql** - 전체 통합 스키마 (새 프로젝트용)

## 다음 단계

1. Supabase에 마이그레이션 적용
2. TypeScript 타입 생성
3. Storage 버킷 설정 (이력서 파일용)
4. 애플리케이션 테스트

자세한 내용은 `docs/supabase-setup-guide.md` 참조
