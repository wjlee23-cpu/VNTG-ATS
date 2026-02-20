# jd_requests 테이블 마이그레이션 가이드

## 문제 상황

에러 메시지: `"Could not find the table 'public.jd_requests' in the schema cache"`

이 에러는 `jd_requests` 테이블이 Supabase 데이터베이스에 생성되지 않았거나, 스키마 캐시가 오래된 상태일 때 발생합니다.

## 해결 방법

### 방법 1: Supabase 대시보드에서 SQL 실행 (권장)

1. **Supabase 대시보드 접속**
   - [Supabase Dashboard](https://app.supabase.com)에 로그인
   - 프로젝트 선택

2. **SQL Editor 열기**
   - 좌측 메뉴에서 "SQL Editor" 클릭
   - "New query" 클릭

3. **마이그레이션 SQL 실행**
   - `scripts/apply-jd-requests-migration.sql` 파일의 내용을 복사
   - SQL Editor에 붙여넣기
   - "Run" 버튼 클릭하여 실행

4. **실행 확인**
   - 좌측 메뉴에서 "Table Editor" 클릭
   - `jd_requests` 테이블이 생성되었는지 확인

### 방법 2: Supabase CLI 사용

```bash
# Supabase CLI가 설치되어 있고 프로젝트가 연결되어 있는 경우
supabase db push
```

또는 특정 마이그레이션 파일만 실행:

```bash
# 마이그레이션 파일을 직접 실행
psql -h [your-db-host] -U postgres -d postgres -f scripts/apply-jd-requests-migration.sql
```

## 마이그레이션 내용

이 마이그레이션은 다음을 생성합니다:

1. **jd_requests 테이블**
   - JD 요청 정보를 저장하는 테이블
   - 컬럼: id, organization_id, title, description, category, priority, status, requested_by, submitted_at, created_at, updated_at

2. **인덱스**
   - organization_id, status, requested_by, submitted_at에 대한 인덱스

3. **트리거**
   - updated_at 자동 업데이트 트리거

4. **외래키**
   - `jd_requests_requested_by_fkey`: requested_by → users(id)
   - `jd_requests_organization_id_fkey`: organization_id → organizations(id)

5. **RLS 정책**
   - 조직별 데이터 접근 제어 정책

## 스키마 캐시 새로고침

마이그레이션 실행 후에도 에러가 계속 발생하면:

1. **Supabase 대시보드에서 새로고침**
   - Settings > API > "Refresh Schema Cache" 클릭

2. **애플리케이션 재시작**
   - 개발 서버를 재시작하여 스키마 캐시를 갱신

## 검증

마이그레이션이 성공적으로 적용되었는지 확인:

```sql
-- 테이블 존재 확인
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'jd_requests'
);

-- 외래키 확인
SELECT conname, conrelid::regclass, confrelid::regclass
FROM pg_constraint
WHERE conname = 'jd_requests_requested_by_fkey';
```

## 관련 파일

- `supabase/migrations/20250221000003_add_figma_fields.sql`: 원본 마이그레이션 파일
- `scripts/apply-jd-requests-migration.sql`: 실행 가능한 마이그레이션 SQL
- `api/queries/jd-requests.ts`: JD 요청 조회 쿼리
- `api/actions/jd-requests.ts`: JD 요청 생성/수정/삭제 액션
