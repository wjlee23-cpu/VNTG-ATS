# Supabase 스키마 캐시 새로고침 가이드

## 문제 상황

`jd_requests` 테이블을 생성한 후에도 여전히 "Could not find the table 'public.jd_requests' in the schema cache" 에러가 발생하는 경우, Supabase의 스키마 캐시를 새로고침해야 합니다.

## 해결 방법

### 방법 1: Supabase 대시보드에서 새로고침 (권장)

1. **Supabase 대시보드 접속**
   - [Supabase Dashboard](https://app.supabase.com)에 로그인
   - 프로젝트 선택

2. **API Settings 열기**
   - 좌측 메뉴에서 "Settings" 클릭
   - "API" 섹션 선택

3. **스키마 캐시 새로고침**
   - "Refresh Schema Cache" 버튼 클릭
   - 또는 "Reload Schema" 버튼 클릭

### 방법 2: 애플리케이션 재시작

개발 서버를 재시작하면 스키마 캐시가 자동으로 갱신될 수 있습니다:

```bash
# 개발 서버 중지 (Ctrl+C)
# 개발 서버 재시작
npm run dev
```

### 방법 3: Supabase REST API를 통한 새로고침

Supabase는 REST API를 통해 스키마 캐시를 새로고침할 수 없지만, 테이블에 대한 간단한 쿼리를 실행하면 캐시가 갱신될 수 있습니다:

```sql
-- Supabase SQL Editor에서 실행
SELECT * FROM jd_requests LIMIT 1;
```

## 확인 방법

스키마 캐시가 새로고침되었는지 확인:

1. **Table Editor에서 확인**
   - Supabase 대시보드 > Table Editor
   - `jd_requests` 테이블이 목록에 나타나는지 확인

2. **애플리케이션에서 확인**
   - 개발 서버 재시작 후
   - `/jd-requests` 페이지 접속
   - 에러가 사라지고 정상적으로 작동하는지 확인

## 추가 문제 해결

여전히 문제가 발생하는 경우:

1. **브라우저 캐시 삭제**
   - 브라우저의 개발자 도구 열기 (F12)
   - Network 탭에서 "Disable cache" 체크
   - 페이지 새로고침 (Ctrl+Shift+R)

2. **환경 변수 확인**
   - `.env.local` 파일에서 Supabase URL과 키가 올바른지 확인
   - 개발 서버 재시작

3. **Supabase 프로젝트 확인**
   - 올바른 Supabase 프로젝트에 연결되어 있는지 확인
   - 다른 프로젝트의 환경 변수를 사용하고 있지 않은지 확인
