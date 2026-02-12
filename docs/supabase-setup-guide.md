# Supabase 데이터베이스 설정 가이드

## 개요
이 가이드는 RecruitOps 플랫폼의 데이터베이스 스키마를 Supabase에 적용하는 방법을 설명합니다.

## 마이그레이션 파일 구조

```
supabase/migrations/
├── 001_initial_schema.sql      # Phase 1 MVP 기본 테이블
├── 002_phase2_features.sql     # Phase 2 협업 기능 (이메일, 코멘트, 평가표)
└── 003_phase3_resume_parsing.sql # Phase 3 이력서 파싱 기능
```

## 적용 방법

### 방법 1: Supabase 대시보드 사용 (권장)

1. **Supabase 프로젝트 접속**
   - [Supabase Dashboard](https://app.supabase.com)에 로그인
   - 프로젝트 선택

2. **SQL Editor 열기**
   - 좌측 메뉴에서 "SQL Editor" 클릭
   - "New query" 클릭

3. **마이그레이션 파일 순서대로 실행**
   - `001_initial_schema.sql` 내용 복사하여 실행
   - `002_phase2_features.sql` 내용 복사하여 실행
   - `003_phase3_resume_parsing.sql` 내용 복사하여 실행

4. **실행 확인**
   - 좌측 메뉴에서 "Table Editor" 클릭
   - 다음 테이블들이 생성되었는지 확인:
     - organizations
     - users
     - processes
     - job_posts
     - candidates
     - schedules
     - schedule_options
     - timeline_events
     - emails (Phase 2)
     - comments (Phase 2)
     - scorecards (Phase 2)
     - resume_files (Phase 3)
     - application_submissions (Phase 3)

### 방법 2: Supabase CLI 사용

1. **Supabase CLI 설치**
   ```bash
   npm install -g supabase
   ```

2. **프로젝트 초기화 (처음 한 번만)**
   ```bash
   supabase init
   ```

3. **Supabase 프로젝트 연결**
   ```bash
   supabase link --project-ref your-project-ref
   ```

4. **마이그레이션 적용**
   ```bash
   supabase db push
   ```

## 중요 사항

### 1. 마이그레이션 순서
마이그레이션 파일은 **반드시 순서대로** 실행해야 합니다:
1. `001_initial_schema.sql` (기본 테이블)
2. `002_phase2_features.sql` (Phase 2 기능)
3. `003_phase3_resume_parsing.sql` (Phase 3 기능)

### 2. 기존 데이터 보존
- 기존에 데이터가 있는 경우, 마이그레이션 전에 백업을 권장합니다.
- `ALTER TABLE` 구문은 기존 데이터를 보존합니다.

### 3. RLS (Row Level Security)
모든 테이블에 RLS가 활성화되어 있습니다. 테스트를 위해 일시적으로 비활성화하려면:
```sql
ALTER TABLE table_name DISABLE ROW LEVEL SECURITY;
```

## 테스트 데이터 생성

### 조직 및 사용자 생성
```sql
-- 조직 생성
INSERT INTO organizations (name) VALUES ('테스트 회사');

-- 사용자 생성 (auth.users에 먼저 생성 필요)
-- Supabase Auth에서 사용자를 생성한 후 아래 쿼리 실행
INSERT INTO users (id, email, organization_id, role)
VALUES (
  'user-uuid-here',
  'test@example.com',
  (SELECT id FROM organizations WHERE name = '테스트 회사'),
  'admin'
);
```

### 프로세스 및 채용 공고 생성
```sql
-- 프로세스 생성
INSERT INTO processes (organization_id, name, stages)
VALUES (
  (SELECT id FROM organizations LIMIT 1),
  '기본 채용 프로세스',
  '[
    {"id": "stage1", "name": "서류 전형", "interviewers": []},
    {"id": "stage2", "name": "1차 면접", "interviewers": []},
    {"id": "stage3", "name": "2차 면접", "interviewers": []}
  ]'::jsonb
);

-- 채용 공고 생성
INSERT INTO job_posts (organization_id, title, description, process_id)
VALUES (
  (SELECT id FROM organizations LIMIT 1),
  '프론트엔드 개발자',
  'React, Next.js 경험자 우대',
  (SELECT id FROM processes LIMIT 1)
);
```

## 타입 생성 (TypeScript)

마이그레이션 적용 후 TypeScript 타입을 생성하려면:

```bash
npx supabase gen types typescript --project-id your-project-id > lib/supabase/types.ts
```

또는 Supabase CLI 사용:
```bash
supabase gen types typescript --local > lib/supabase/types.ts
```

## 문제 해결

### 오류: "relation already exists"
- 이미 테이블이 존재하는 경우, `CREATE TABLE IF NOT EXISTS` 구문을 사용하거나
- 기존 테이블을 삭제 후 재생성 (주의: 데이터 손실)

### 오류: "permission denied"
- RLS 정책 확인
- Service Role Key 사용 여부 확인

### 오류: "constraint violation"
- 외래 키 제약 조건 확인
- 참조하는 레코드가 존재하는지 확인

## 다음 단계

1. **환경 변수 설정**
   - `.env`에 Supabase URL과 키 추가

2. **인증 설정**
   - Supabase Auth에서 이메일/비밀번호 인증 활성화

3. **Storage 설정** (Phase 3 이력서 파일용)
   - Storage 버킷 생성: `resumes`
   - RLS 정책 설정

4. **애플리케이션 테스트**
   - 회원가입/로그인 테스트
   - 프로세스 생성 테스트
   - 후보자 추가 테스트
