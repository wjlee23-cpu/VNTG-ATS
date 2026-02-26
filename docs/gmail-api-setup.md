# Gmail API 설정 가이드

이 가이드는 Google Workspace의 Gmail API를 사용하여 이메일을 발송하기 위한 설정 방법을 안내합니다.

## 개요

VNTG ATS는 Google Workspace의 Gmail API를 사용하여 이메일을 발송합니다. 현재 로그인한 사용자의 Google Workspace 계정을 통해 이메일이 발송되므로, 추가적인 이메일 서비스(Resend 등)가 필요하지 않습니다.

## 사전 요구사항

1. Google Workspace 계정
2. Google Cloud Console 프로젝트
3. Google OAuth 2.0 클라이언트 ID 및 Secret (이미 설정되어 있어야 함)

## 설정 단계

### 1단계: Gmail API 활성화

1. [Google Cloud Console](https://console.cloud.google.com/)에 접속합니다.
2. 프로젝트를 선택합니다 (구글 캘린더 연동에 사용한 프로젝트와 동일한 프로젝트 사용 권장).
3. **API 및 서비스 > 라이브러리**로 이동합니다.
4. 검색창에 "Gmail API"를 입력합니다.
5. **Gmail API**를 선택하고 **사용 설정** 버튼을 클릭합니다.

### 2단계: OAuth 동의 화면 확인 및 범위 추가

1. **API 및 서비스 > OAuth 동의 화면**으로 이동합니다.
   - 직접 링크: https://console.cloud.google.com/apis/credentials/consent
   - 또는 왼쪽 메뉴에서 "API 및 서비스" > "OAuth 동의 화면" 클릭

2. OAuth 동의 화면이 이미 설정되어 있는지 확인합니다.
   - 설정되지 않았다면 "사용자 유형" 선택 후 기본 정보를 입력하세요.

3. **범위(Scopes)** 섹션 찾기:
   - OAuth 동의 화면 페이지에서 아래로 스크롤하여 **"범위"** 또는 **"Scopes"** 섹션을 찾습니다.
   - 또는 **"범위 추가"** 또는 **"Add or remove scopes"** 버튼을 클릭합니다.

4. **gmail.send 스코프 추가**:
   - "범위 추가" 또는 "Add or remove scopes" 버튼 클릭
   - 검색창에 `gmail.send` 또는 `gmail` 입력
   - `https://www.googleapis.com/auth/gmail.send` (Gmail API v1 - 이메일 보내기) 선택
   - "업데이트" 또는 "Update" 버튼 클릭

5. 다음 스코프가 모두 포함되어 있는지 확인:
   - `https://www.googleapis.com/auth/calendar` (캘린더 읽기/쓰기)
   - `https://www.googleapis.com/auth/gmail.send` (Gmail 발송) ← **새로 추가 필요**
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`

**참고**: 범위 섹션이 보이지 않으면 OAuth 동의 화면 설정이 완료되지 않았을 수 있습니다. 먼저 기본 정보(앱 이름, 사용자 지원 이메일 등)를 입력하고 저장한 후 다시 확인하세요.

### 3단계: OAuth 클라이언트 ID 확인

1. **API 및 서비스 > 사용자 인증 정보**로 이동합니다.
2. **OAuth 2.0 클라이언트 ID** 목록에서 사용 중인 클라이언트 ID를 확인합니다.
3. **승인된 리디렉션 URI**에 다음이 포함되어 있는지 확인합니다:
   - `http://localhost:3000/api/auth/callback/google` (로컬 개발 환경)
   - `https://yourdomain.com/api/auth/callback/google` (프로덕션 환경)

### 4단계: 기존 사용자 재인증 (중요)

기존에 Google Calendar만 연동한 사용자는 Gmail 발송 권한을 추가하기 위해 재인증이 필요합니다.

1. 대시보드에서 **구글 캘린더 연동** 버튼을 클릭합니다.
2. Google OAuth 동의 화면에서 **Gmail 발송 권한**도 함께 승인합니다.
3. 인증이 완료되면 `calendar_access_token`과 `calendar_refresh_token`이 업데이트됩니다.
4. 이 토큰은 Gmail API와 Calendar API 모두에 사용됩니다.

## 사용 방법

### 이메일 발송

이메일 발송은 자동으로 처리됩니다:

1. **면접 일정 옵션 전송**: 모든 면접관이 일정을 수락하면 후보자에게 자동으로 이메일이 발송됩니다.
2. **수동 이메일 발송**: 후보자 상세 페이지에서 수동으로 이메일을 발송할 수 있습니다.

### 발신자 정보

- **발신자 이메일**: 현재 로그인한 사용자의 Google Workspace 이메일 주소
- **발신자 이름**: 사용자의 이메일 주소 (Gmail API는 발신자 이름을 별도로 설정하지 않음)

## 제한 사항

### 일일 발송 한도

Google Workspace 계정별로 일일 이메일 발송 한도가 있습니다:

- **일반 Google Workspace 계정**: 2,000통/일
- **Google Workspace Enterprise 계정**: 10,000통/일

한도를 초과하면 이메일 발송이 실패합니다. 에러 메시지를 확인하여 한도 초과 여부를 확인할 수 있습니다.

### 토큰 관리

- `calendar_access_token`과 `calendar_refresh_token`은 Gmail API와 Calendar API 모두에 사용됩니다.
- 토큰이 만료되면 자동으로 갱신됩니다.
- 토큰이 없거나 유효하지 않으면 이메일 발송이 실패합니다.

## 문제 해결

### "Google Workspace 계정이 연동되지 않았습니다" 에러

**원인**: 사용자가 Google Calendar를 연동하지 않았거나, 토큰이 없습니다.

**해결 방법**:
1. 대시보드에서 **구글 캘린더 연동** 버튼을 클릭합니다.
2. Google OAuth 동의 화면에서 모든 권한을 승인합니다.
3. 인증이 완료되면 다시 시도합니다.

### "이메일 발송에 실패했습니다" 에러

**가능한 원인**:
1. Gmail API가 활성화되지 않음
2. OAuth 스코프에 `gmail.send`가 포함되지 않음
3. 일일 발송 한도 초과
4. 토큰이 만료되었고 갱신 실패

**해결 방법**:
1. Google Cloud Console에서 Gmail API가 활성화되어 있는지 확인합니다.
2. OAuth 동의 화면에서 `gmail.send` 스코프가 포함되어 있는지 확인합니다.
3. 브라우저 콘솔에서 에러 메시지를 확인합니다.
4. 필요시 구글 캘린더를 재연동합니다.

### OAuth 재인증이 필요합니다

**원인**: 기존에 Google Calendar만 연동한 사용자는 Gmail 스코프가 없습니다.

**해결 방법**:
1. 대시보드에서 **구글 캘린더 연동** 버튼을 다시 클릭합니다.
2. Google OAuth 동의 화면에서 **Gmail 발송 권한**도 함께 승인합니다.
3. 인증이 완료되면 자동으로 토큰이 업데이트됩니다.

## 추가 정보

- [Gmail API 문서](https://developers.google.com/gmail/api)
- [Google OAuth 2.0 문서](https://developers.google.com/identity/protocols/oauth2)
- [Google Workspace 발송 한도](https://support.google.com/a/answer/166852)
