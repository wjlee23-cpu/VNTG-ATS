# JD Requests 기능 테스트 가이드

## 전제 조건

1. `jd_requests` 테이블이 Supabase에 생성되어 있어야 합니다.
2. 마이그레이션이 성공적으로 적용되었는지 확인하세요.
3. Supabase 스키마 캐시가 새로고침되었는지 확인하세요.

## 테스트 시나리오

### 1. JD 요청 목록 조회 테스트

**경로**: `/jd-requests`

**예상 결과**:
- 페이지가 정상적으로 로드됨
- 에러 메시지가 콘솔에 나타나지 않음
- JD 요청 목록이 표시됨 (데이터가 없는 경우 빈 목록)

**확인 사항**:
- 브라우저 개발자 도구 콘솔에 에러가 없는지 확인
- "JD 요청 조회 실패" 에러가 없는지 확인

### 2. JD 요청 통계 조회 테스트

**경로**: `/jd-requests`

**예상 결과**:
- 통계 카드가 정상적으로 표시됨
- All, Pending, Approved, Rejected 카운트가 표시됨

**확인 사항**:
- "JD 요청 통계 조회 실패" 에러가 없는지 확인

### 3. 채용 공고 생성 페이지 테스트

**경로**: `/jobs/create`

**예상 결과**:
- 페이지가 정상적으로 로드됨
- "승인된 JD 목록" 드롭다운이 표시됨 (데이터가 있는 경우)

**확인 사항**:
- "승인된 JD 목록 조회 실패" 에러가 콘솔에 나타나지 않음
- JD 요청 선택 드롭다운이 정상적으로 작동함

### 4. JD 요청 생성 테스트

**경로**: `/jd-requests/create`

**예상 결과**:
- JD 요청 생성 폼이 정상적으로 표시됨
- 폼 제출 시 JD 요청이 생성됨
- 생성 후 목록 페이지로 리다이렉트됨

**확인 사항**:
- 데이터베이스에 JD 요청이 정상적으로 저장됨
- 에러 없이 생성됨

## 문제 해결

### 에러가 계속 발생하는 경우

1. **스키마 캐시 확인**
   - Supabase 대시보드 > Settings > API > "Refresh Schema Cache" 클릭
   - 개발 서버 재시작

2. **테이블 존재 확인**
   ```sql
   -- Supabase SQL Editor에서 실행
   SELECT EXISTS (
     SELECT FROM information_schema.tables 
     WHERE table_schema = 'public' 
     AND table_name = 'jd_requests'
   );
   ```

3. **외래키 확인**
   ```sql
   -- Supabase SQL Editor에서 실행
   SELECT conname, conrelid::regclass, confrelid::regclass
   FROM pg_constraint
   WHERE conname = 'jd_requests_requested_by_fkey';
   ```

4. **RLS 정책 확인**
   ```sql
   -- Supabase SQL Editor에서 실행
   SELECT * FROM pg_policies 
   WHERE tablename = 'jd_requests';
   ```

### 권한 문제가 발생하는 경우

- RLS 정책이 올바르게 설정되었는지 확인
- 현재 사용자의 `organization_id`가 올바른지 확인
- 관리자 계정으로 테스트해보기

## 성공 기준

다음 조건을 모두 만족하면 테스트 성공:

- ✅ `/jd-requests` 페이지가 에러 없이 로드됨
- ✅ `/jobs/create` 페이지가 에러 없이 로드됨
- ✅ JD 요청 목록이 정상적으로 조회됨
- ✅ JD 요청 통계가 정상적으로 표시됨
- ✅ 브라우저 콘솔에 에러가 없음
- ✅ JD 요청 생성/수정/삭제가 정상적으로 작동함
