# Supabase 구글 OAuth 설정 가이드

이 문서는 Supabase에서 구글 OAuth 로그인을 설정하는 방법을 안내합니다.

## 1. Google Cloud Console 설정

### 1.1 프로젝트 생성 및 OAuth 동의 화면 설정

1. [Google Cloud Console](https://console.cloud.google.com/)에 접속합니다.
2. 새 프로젝트를 생성하거나 기존 프로젝트를 선택합니다.
3. 좌측 메뉴에서 **"API 및 서비스" > "OAuth 동의 화면"**으로 이동합니다.
4. 사용자 유형을 선택합니다 (외부 또는 내부).
5. 앱 정보를 입력합니다:
   - 앱 이름: RecruitOps (또는 원하는 이름)
   - 사용자 지원 이메일: 본인의 이메일
   - 개발자 연락처 정보: 본인의 이메일
6. 범위(Scopes)는 기본값으로 두고 저장합니다.
7. 테스트 사용자에 본인의 이메일을 추가합니다 (테스트 단계에서 필요).

### 1.2 OAuth 2.0 클라이언트 ID 생성

1. **"API 및 서비스" > "사용자 인증 정보"**로 이동합니다.
2. 상단의 **"+ 사용자 인증 정보 만들기"** 버튼을 클릭합니다.
3. **"OAuth 클라이언트 ID"**를 선택합니다.
4. 애플리케이션 유형을 **"웹 애플리케이션"**으로 선택합니다.
5. 이름을 입력합니다 (예: RecruitOps Web Client).
6. **승인된 리디렉션 URI**에 다음을 추가합니다:
   ```
   https://[YOUR_PROJECT_REF].supabase.co/auth/v1/callback
   ```
   - `[YOUR_PROJECT_REF]`는 Supabase 프로젝트의 참조 ID입니다.
   - Supabase 대시보드 > Settings > API에서 확인할 수 있습니다.
   - 예시: `https://abcdefghijklmnop.supabase.co/auth/v1/callback`
7. **만들기** 버튼을 클릭합니다.
8. 생성된 **클라이언트 ID**와 **클라이언트 보안 비밀번호**를 복사해 둡니다.

## 2. Supabase 대시보드 설정

### 2.1 구글 OAuth 프로바이더 활성화

1. [Supabase 대시보드](https://app.supabase.com/)에 접속합니다.
2. 프로젝트를 선택합니다.
3. 좌측 메뉴에서 **"Authentication" > "Providers"**로 이동합니다.
4. **"Google"** 프로바이더를 찾아 클릭합니다.
5. **"Enable Google provider"** 토글을 켭니다.
6. Google Cloud Console에서 복사한 정보를 입력합니다:
   - **Client ID (for OAuth)**: Google Cloud Console에서 복사한 클라이언트 ID
   - **Client Secret (for OAuth)**: Google Cloud Console에서 복사한 클라이언트 보안 비밀번호
7. **"Save"** 버튼을 클릭합니다.

### 2.2 리디렉션 URL 확인

1. **"Authentication" > "URL Configuration"**으로 이동합니다.
2. **"Redirect URLs"** 섹션에서 다음 URL이 포함되어 있는지 확인합니다:
   ```
   http://localhost:3000/auth/callback
   https://yourdomain.com/auth/callback
   ```
   - 로컬 개발용과 프로덕션용 URL을 모두 추가해야 합니다.
3. 필요시 URL을 추가하고 저장합니다.

## 3. 환경 변수 확인

프로젝트의 `.env` 파일에 다음 변수들이 설정되어 있는지 확인하세요:

```env
NEXT_PUBLIC_SUPABASE_URL=https://[YOUR_PROJECT_REF].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

이 변수들은 Supabase 대시보드 > Settings > API에서 확인할 수 있습니다.

**참고**: 구글 OAuth의 클라이언트 ID와 시크릿은 Supabase 대시보드에서 관리되므로, 애플리케이션 코드에 직접 설정할 필요가 없습니다.

## 4. 테스트

### 4.1 로컬 환경에서 테스트

1. 개발 서버를 실행합니다:
   ```bash
   npm run dev
   ```
2. 브라우저에서 `http://localhost:3000/login`으로 이동합니다.
3. "구글로 로그인" 버튼을 클릭합니다.
4. 구글 계정 선택 화면이 나타나면 테스트 사용자로 로그인합니다.
5. 로그인 성공 후 대시보드로 리다이렉트되는지 확인합니다.

### 4.2 초대 전용 정책 확인

- 구글 로그인에 성공했지만 `users` 테이블에 사용자 정보가 없는 경우, "초대받지 않은 사용자입니다" 메시지가 표시됩니다.
- 이는 의도된 동작이며, 관리자가 먼저 `users` 테이블에 사용자를 추가해야 합니다.

## 5. 문제 해결

### 문제: "redirect_uri_mismatch" 에러

**원인**: Google Cloud Console에 등록한 리디렉션 URI와 Supabase에서 사용하는 URI가 일치하지 않음.

**해결**:
1. Google Cloud Console > 사용자 인증 정보에서 클라이언트 ID를 확인합니다.
2. **승인된 리디렉션 URI**에 다음 형식이 정확히 포함되어 있는지 확인합니다:
   ```
   https://[YOUR_PROJECT_REF].supabase.co/auth/v1/callback
   ```
3. URI 끝에 슬래시(`/`)가 없어야 합니다.

### 문제: "access_denied" 에러

**원인**: OAuth 동의 화면에서 테스트 사용자로 등록되지 않음.

**해결**:
1. Google Cloud Console > OAuth 동의 화면으로 이동합니다.
2. **"테스트 사용자"** 섹션에 본인의 이메일을 추가합니다.
3. 앱이 프로덕션 상태가 되면 모든 사용자가 접근할 수 있습니다.

### 문제: 로그인은 성공하지만 "사용자 정보를 찾을 수 없습니다" 에러

**원인**: `users` 테이블에 해당 사용자 정보가 없음 (초대 전용 정책).

**해결**:
1. 관리자가 Supabase 대시보드에서 `users` 테이블에 사용자를 추가해야 합니다.
2. 또는 관리자용 사용자 초대 기능을 사용합니다.

## 6. 프로덕션 배포 시 주의사항

1. **OAuth 동의 화면 검증**: 프로덕션 배포 전에 Google Cloud Console에서 OAuth 동의 화면을 검증받아야 합니다.
2. **리디렉션 URL**: 프로덕션 도메인의 리디렉션 URL을 Google Cloud Console과 Supabase에 모두 추가해야 합니다.
3. **보안**: 프로덕션에서는 HTTPS를 사용해야 합니다.

## 참고 자료

- [Supabase Auth 문서](https://supabase.com/docs/guides/auth)
- [Google OAuth 2.0 문서](https://developers.google.com/identity/protocols/oauth2)
- [Supabase Google Provider 설정](https://supabase.com/docs/guides/auth/social-login/auth-google)
