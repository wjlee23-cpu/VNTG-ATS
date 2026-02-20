# 더미 데이터 생성 가이드

## 개요

이 가이드는 Supabase에 테스트용 더미 데이터를 생성하는 방법을 설명합니다.

## 방법 1: SQL 파일 실행 (권장)

### 1단계: SQL 파일 준비

`scripts/seed-dummy-data.sql` 파일이 준비되어 있습니다.

### 2단계: Supabase 대시보드 접속

1. [Supabase Dashboard](https://app.supabase.com)에 로그인
2. 프로젝트 선택

### 3단계: SQL Editor에서 실행

1. 좌측 메뉴에서 **"SQL Editor"** 클릭
2. **"New query"** 클릭
3. `scripts/seed-dummy-data.sql` 파일의 내용을 복사하여 붙여넣기
4. **"Run"** 버튼 클릭

### 4단계: 결과 확인

실행이 완료되면 다음 메시지가 표시됩니다:

```
✨ 더미 데이터 생성 완료!
```

그리고 마지막 SELECT 문으로 생성된 데이터 개수가 표시됩니다:

```
organizations | processes | job_posts | candidates | schedules | schedule_options | timeline_events
--------------|-----------|-----------|------------|-----------|------------------|-----------------
      1       |     1     |     8     |     30     |    15     |        45        |       ~120
```

## 방법 2: TypeScript 스크립트 실행

### 1단계: 환경 변수 설정

`.env` 또는 `.env.local` 파일에 다음 변수를 설정하세요:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 2단계: 스크립트 실행

```bash
npm run seed
```

또는:

```bash
npx tsx scripts/seed-dummy-data.ts
```

## 생성되는 데이터

### 조직 (Organizations)
- **1개**: VNTG Tech

### 채용 프로세스 (Processes)
- **1개**: 기본 채용 프로세스
  - 5단계: 서류 전형 → 1차 면접 → 2차 면접 → 최종 면접 → 최종 합격

### 채용 공고 (Job Posts)
- **8개**: 다양한 포지션
  - Senior Product Designer
  - Product Manager
  - UX Researcher
  - Frontend Developer
  - Backend Developer
  - Full Stack Developer
  - Data Engineer
  - DevOps Engineer

### 후보자 (Candidates)
- **30명**: 다양한 상태와 단계
  - 상태: pending, in_progress, confirmed, rejected, issue
  - 각 후보자마다 매치 스코어, 스킬, 경력 정보 포함

### 면접 일정 (Schedules)
- **15개**: 다양한 상태와 응답
  - 상태: pending, confirmed, rejected, completed
  - 후보자 응답: accepted, rejected, pending
  - 음료 선호도 포함

### 면접 일정 옵션 (Schedule Options)
- **45개**: 각 일정당 3개의 옵션
  - 하나는 'selected' 상태로 설정

### 타임라인 이벤트 (Timeline Events)
- **약 120개**: 후보자당 3-6개의 이벤트
  - system_log
  - schedule_created
  - schedule_confirmed
  - stage_changed

## 데이터 삭제

기존 데이터를 삭제하고 새로 생성하려면, SQL 파일의 상단 주석을 해제하세요:

```sql
-- 기존 데이터 삭제
DELETE FROM timeline_events;
DELETE FROM schedule_options;
DELETE FROM schedules;
DELETE FROM candidates;
DELETE FROM job_posts;
DELETE FROM processes;
DELETE FROM users;
DELETE FROM organizations;
```

## 주의사항

1. **RLS (Row Level Security)**: 테이블에 RLS가 활성화되어 있으면, Service Role Key를 사용하거나 RLS를 일시적으로 비활성화해야 합니다.

2. **외래키 제약**: 데이터는 순서대로 생성되므로 외래키 제약 조건을 만족합니다.

3. **중복 방지**: `ON CONFLICT DO NOTHING`을 사용하여 중복 생성을 방지합니다.

4. **사용자 데이터**: `users` 테이블은 Supabase Auth를 통해 먼저 생성되어야 합니다. 더미 데이터 스크립트는 사용자를 생성하지 않습니다.

## 문제 해결

### 에러: "permission denied for table"
- Service Role Key를 사용하거나 RLS를 일시적으로 비활성화하세요.

### 에러: "foreign key constraint"
- 테이블이 올바른 순서로 생성되었는지 확인하세요.
- 마이그레이션 파일이 모두 실행되었는지 확인하세요.

### 에러: "relation does not exist"
- 마이그레이션 파일을 먼저 실행했는지 확인하세요.
- `001_initial_schema.sql`, `002_phase2_features.sql`, `003_phase3_resume_parsing.sql` 순서대로 실행해야 합니다.
