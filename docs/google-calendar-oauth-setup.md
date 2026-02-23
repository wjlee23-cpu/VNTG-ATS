# 구글 캘린더 OAuth 설정 가이드

## 문제: redirect_uri_mismatch 에러

구글 캘린더 연동 시 `redirect_uri_mismatch` 에러가 발생하는 경우, Google Cloud Console에 리디렉션 URI를 추가해야 합니다.

## 해결 방법

### 1단계: Google Cloud Console 접속

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 프로젝트 선택
3. **API 및 서비스 > 사용자 인증 정보**로 이동

### 2단계: OAuth 2.0 클라이언트 ID 확인

1. **OAuth 2.0 클라이언트 ID** 목록에서 사용 중인 클라이언트 ID 클릭
2. **승인된 리디렉션 URI** 섹션 확인

### 3단계: 리디렉션 URI 추가

**로컬 개발 환경용:**
```
http://localhost:3000/api/auth/callback/google
```

**프로덕션 환경용 (배포 후):**
```
https://yourdomain.com/api/auth/callback/google
```

### 4단계: URI 추가 방법

1. **+ URI 추가** 버튼 클릭
2. 위 URI를 정확히 입력 (복사/붙여넣기 권장)
3. **저장** 버튼 클릭
4. **5-10분 대기** (변경사항 반영 시간)

## 중요 체크사항

- ✅ `http://` 또는 `https://` 프로토콜 포함
- ✅ URI 끝에 슬래시(`/`) 없음
- ✅ 정확한 경로: `/api/auth/callback/google`
- ✅ 포트 번호 포함 (로컬: `:3000`)

## 현재 필요한 리디렉션 URI

### 로컬 개발 환경
```
http://localhost:3000/api/auth/callback/google
```

### Supabase OAuth (이미 등록되어 있을 수 있음)
```
https://[YOUR_PROJECT_REF].supabase.co/auth/v1/callback
```

## 확인 방법

1. Google Cloud Console에서 **승인된 리디렉션 URI** 목록 확인
2. 위 URI가 정확히 포함되어 있는지 확인
3. 5-10분 대기 후 다시 시도

## 문제 해결

### 여전히 에러가 발생하는 경우

1. **브라우저 캐시 삭제**
   - Ctrl + Shift + Delete (Windows)
   - Cmd + Shift + Delete (Mac)

2. **시크릿 모드에서 테스트**
   - 시크릿/프라이빗 모드로 브라우저 열기
   - 다시 시도

3. **변경사항 반영 대기**
   - Google Cloud Console 변경 후 최소 5-10분 대기

4. **환경 변수 확인**
   - `.env` 파일에 `NEXT_PUBLIC_APP_URL=http://localhost:3000` 설정 확인
