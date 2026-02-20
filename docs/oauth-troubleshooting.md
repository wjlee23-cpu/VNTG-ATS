# OAuth 리다이렉션 URI 설정 확인 가이드

## redirect_uri_mismatch 오류 해결

이 오류는 Google Cloud Console에 등록된 리디렉션 URI와 Supabase에서 사용하는 URI가 일치하지 않을 때 발생합니다.

## 확인 사항 체크리스트

### 1. Supabase 프로젝트 URL 확인

1. [Supabase 대시보드](https://app.supabase.com/)에 접속
2. 프로젝트 선택
3. **Settings > API**로 이동
4. **Project URL** 확인 (예: `https://abcdefghijklmnop.supabase.co`)
5. 이 URL의 프로젝트 참조 ID를 복사 (예: `abcdefghijklmnop`)

### 2. Google Cloud Console 설정 확인

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. **API 및 서비스 > 사용자 인증 정보**로 이동
3. OAuth 2.0 클라이언트 ID 클릭
4. **승인된 리디렉션 URI** 섹션 확인
5. 다음 형식이 **정확히** 포함되어 있는지 확인:
   ```
   https://[YOUR_PROJECT_REF].supabase.co/auth/v1/callback
   ```
   - 예시: `https://abcdefghijklmnop.supabase.co/auth/v1/callback`
   - **주의**: URI 끝에 슬래시(`/`)가 없어야 합니다
   - **주의**: `http://`가 아닌 `https://`를 사용해야 합니다

### 3. Supabase 리디렉션 URL 확인

1. Supabase 대시보드 > **Authentication > URL Configuration**로 이동
2. **Redirect URLs** 섹션 확인
3. 다음 URL이 포함되어 있는지 확인:
   ```
   http://localhost:3000/auth/callback
   ```
   - 로컬 개발용: `http://localhost:3000/auth/callback`
   - 프로덕션용: `https://yourdomain.com/auth/callback` (배포 시 추가)

### 4. Google OAuth 프로바이더 설정 확인

1. Supabase 대시보드 > **Authentication > Providers**로 이동
2. **Google** 프로바이더 클릭
3. **Enable Google provider** 토글이 켜져 있는지 확인
4. **Client ID**와 **Client Secret**이 올바르게 입력되어 있는지 확인

## 일반적인 실수

1. ❌ `http://localhost:3000/auth/callback`을 Google Cloud Console에 추가
   - 올바른 URI: `https://[PROJECT_REF].supabase.co/auth/v1/callback`

2. ❌ URI 끝에 슬래시 추가
   - ❌ `https://...supabase.co/auth/v1/callback/`
   - ✅ `https://...supabase.co/auth/v1/callback`

3. ❌ `http://` 사용
   - ❌ `http://...supabase.co/auth/v1/callback`
   - ✅ `https://...supabase.co/auth/v1/callback`

4. ❌ 프로젝트 참조 ID 오타
   - Supabase 대시보드에서 정확한 프로젝트 참조 ID를 복사해야 합니다

## 설정 후 확인

1. Google Cloud Console에서 리디렉션 URI를 저장한 후 **최소 5분** 대기 (변경사항 반영 시간)
2. 브라우저 캐시 및 쿠키 삭제
3. 다시 로그인 시도

## 추가 도움말

- [Supabase Google OAuth 가이드](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Google OAuth 2.0 문서](https://developers.google.com/identity/protocols/oauth2)
