# AI Match 분석 필드 마이그레이션 가이드

## 문제 상황

에러 메시지: `"Could not find the 'ai_summary' column of 'candidates' in the schema cache"`

이 에러는 `candidates` 테이블에 AI 매칭 분석에 필요한 컬럼들이 Supabase 데이터베이스에 생성되지 않았거나, 스키마 캐시가 오래된 상태일 때 발생합니다.

## 필요한 컬럼

AI Match 분석 기능을 사용하기 위해 다음 컬럼들이 필요합니다:

- `ai_summary` (TEXT): AI가 생성한 지원서 요약 및 JD-이력서 매칭 분석 요약
- `ai_score` (INTEGER): AI가 분석한 JD-이력서 매칭 점수 (0-100)
- `ai_strengths` (TEXT[]): AI가 분석한 지원자 강점 리스트
- `ai_weaknesses` (TEXT[]): AI가 분석한 지원자 보완점 리스트
- `ai_analysis_status` (TEXT): AI 분석 상태 ('pending', 'processing', 'completed', 'failed')

## 해결 방법

### 방법 1: Supabase 대시보드에서 SQL 실행 (권장)

1. **Supabase 대시보드 접속**
   - [Supabase Dashboard](https://app.supabase.com)에 로그인
   - 프로젝트 선택

2. **SQL Editor 열기**
   - 좌측 메뉴에서 "SQL Editor" 클릭
   - "New query" 클릭

3. **마이그레이션 SQL 실행**
   - `supabase/migrations/20260307000000_add_ai_match_fields.sql` 파일의 내용을 복사
   - SQL Editor에 붙여넣기
   - "Run" 버튼 클릭하여 실행

4. **실행 확인**
   - 좌측 메뉴에서 "Table Editor" 클릭
   - `candidates` 테이블 선택
   - 다음 컬럼들이 추가되었는지 확인:
     - `ai_summary`
     - `ai_score`
     - `ai_strengths`
     - `ai_weaknesses`
     - `ai_analysis_status`

### 방법 2: Supabase CLI 사용

```bash
# Supabase CLI가 설치되어 있고 프로젝트가 연결되어 있는 경우
npx supabase db push
```

또는 특정 마이그레이션 파일만 실행:

```bash
# 마이그레이션 파일을 직접 실행
psql -h [your-db-host] -U postgres -d postgres -f supabase/migrations/20260307000000_add_ai_match_fields.sql
```

## 마이그레이션 내용

이 마이그레이션은 다음을 추가합니다:

1. **AI 분석 관련 컬럼**
   - `ai_summary`: AI가 생성한 지원서 요약 및 JD-이력서 매칭 분석 요약
   - `ai_score`: AI가 분석한 JD-이력서 매칭 점수 (0-100, CHECK 제약조건 포함)
   - `ai_strengths`: AI가 분석한 지원자 강점 리스트 (TEXT 배열)
   - `ai_weaknesses`: AI가 분석한 지원자 보완점 리스트 (TEXT 배열)
   - `ai_analysis_status`: AI 분석 상태 ('pending', 'processing', 'completed', 'failed')

2. **인덱스**
   - `idx_candidates_ai_analysis_status`: 분석 상태로 필터링 시 성능 향상
   - `idx_candidates_ai_score`: 점수로 정렬/필터링 시 성능 향상

3. **컬럼 코멘트**
   - 각 컬럼의 용도를 명확히 설명하는 코멘트 추가

## ⚠️ 중요: 스키마 캐시 새로고침

마이그레이션 실행 후 **반드시** 스키마 캐시를 갱신해야 합니다. 그렇지 않으면 계속 같은 오류가 발생합니다.

1. **Supabase 대시보드에서 새로고침**
   - Settings > API 메뉴로 이동
   - "Refresh Schema Cache" 버튼 클릭
   - 성공 메시지가 표시될 때까지 대기

2. **애플리케이션 재시작** (선택사항)
   - 개발 서버를 재시작하여 로컬 스키마 캐시를 갱신

## 검증

마이그레이션이 성공적으로 적용되었는지 확인:

```sql
-- 컬럼 존재 확인
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'candidates'
  AND column_name IN ('ai_summary', 'ai_score', 'ai_strengths', 'ai_weaknesses', 'ai_analysis_status')
ORDER BY column_name;

-- 인덱스 확인
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'candidates'
  AND indexname LIKE 'idx_candidates_ai%';
```

예상 결과:
- 5개의 컬럼이 모두 조회되어야 합니다
- 2개의 인덱스가 조회되어야 합니다

## 트러블슈팅

### 문제 1: 마이그레이션 실행 후에도 여전히 오류 발생

**원인**: 스키마 캐시가 갱신되지 않았습니다.

**해결**:
1. Supabase 대시보드 > Settings > API > "Refresh Schema Cache" 클릭
2. 개발 서버 재시작
3. 브라우저 캐시 삭제 후 다시 시도

### 문제 2: "column already exists" 오류

**원인**: 일부 컬럼이 이미 존재합니다.

**해결**: 마이그레이션 파일은 `IF NOT EXISTS`를 사용하므로 안전하게 재실행할 수 있습니다. 이미 존재하는 컬럼은 건너뛰고 없는 컬럼만 추가됩니다.

### 문제 3: 특정 컬럼만 누락됨

**원인**: 이전 마이그레이션이 부분적으로만 실행되었을 수 있습니다.

**해결**: 전체 마이그레이션 파일을 다시 실행하세요. `IF NOT EXISTS`로 인해 이미 존재하는 컬럼은 건너뛰고 누락된 컬럼만 추가됩니다.

## 관련 파일

- `supabase/migrations/20260307000000_add_ai_match_fields.sql`: AI Match 필드 마이그레이션 파일
- `supabase/migrations/20260224150530_add_candidate_fields.sql`: 이전에 `ai_summary`를 추가한 마이그레이션 (통합됨)
- `lib/ai/candidate-matching.ts`: AI 매칭 분석 로직
- `lib/supabase/types.ts`: TypeScript 타입 정의

## 기능 사용

마이그레이션이 완료되면 다음 기능을 사용할 수 있습니다:

1. **이력서 업로드 시 자동 AI 분석**
   - 후보자가 이력서를 업로드하면 자동으로 AI 분석이 시작됩니다
   - 분석 상태는 `ai_analysis_status` 컬럼에서 확인할 수 있습니다

2. **AI 매칭 점수 확인**
   - `ai_score`: 0-100 사이의 매칭 점수
   - `ai_summary`: 분석 요약
   - `ai_strengths`: 지원자의 강점
   - `ai_weaknesses`: 지원자의 보완점

3. **분석 상태 추적**
   - `pending`: 분석 대기 중
   - `processing`: 분석 진행 중
   - `completed`: 분석 완료
   - `failed`: 분석 실패
