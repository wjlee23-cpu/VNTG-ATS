# Supabase Google OAuth 설정 수정 가이드

## 문제 진단

Supabase 대시보드의 Google OAuth 설정에서 Callback URL이 제대로 표시되지 않거나 설정이 누락되었을 수 있습니다.

## 해결 방법

### 1단계: Supabase 대시보드에서 Google 프로바이더 설정 확인

1. [Supabase 대시보드](https://app.supabase.com/) 접속
2. 프로젝트 선택
3. **Authentication > Providers**로 이동
4. **Google** 프로바이더 클릭 (또는 화살표 버튼 클릭)

### 2단계: Callback URL 확인 및 수정

**Callback URL (for OAuth)** 필드에 다음이 **정확히** 입력되어 있는지 확인:

```
https://pmfzabgoiqnmlvdrlgpp.supabase.co/auth/v1/callback
```

**중요 체크사항:**
- ✅ 전체 경로가 입력되어 있어야 함 (`/auth/v1/callback`까지)
- ✅ `https://` 사용
- ✅ 프로젝트 참조 ID 정확: `pmfzabgoiqnmlvdrlgpp`
- ✅ URI 끝에 슬래시(`/`) 없음

**만약 잘려 있거나 다르다면:**
1. Callback URL 필드에 전체 URL 입력
2. **Save** 버튼 클릭

### 3단계: Client ID와 Client Secret 확인

1. **Client IDs** 필드 확인:
   - Google Cloud Console의 OAuth 클라이언트 ID와 일치하는지 확인
   - 예: `854087310195-33vkm376c39m9iepi8ghg2f3rredped1.apps.googleusercontent.com`

2. **Client Secret (for OAuth)** 필드 확인:
   - Google Cloud Console에서 생성한 Client Secret이 올바르게 입력되어 있는지
   - 눈 아이콘을 클릭하여 실제 값이 올바른지 확인

### 4단계: Google Cloud Console과 일치 확인

Google Cloud Console의 **승인된 리디렉션 URI**와 Supabase의 **Callback URL**이 정확히 일치해야 합니다:

**Google Cloud Console:**
```
https://pmfzabgoiqnmlvdrlgpp.supabase.co/auth/v1/callback
```

**Supabase 대시보드:**
```
https://pmfzabgoiqnmlvdrlgpp.supabase.co/auth/v1/callback
```

두 값이 **정확히** 일치해야 합니다.

### 5단계: 설정 저장 및 테스트

1. Supabase 대시보드에서 **Save** 버튼 클릭
2. 변경사항이 저장되었는지 확인
3. 5-10분 대기 (변경사항 반영 시간)
4. 브라우저 캐시 삭제
5. 다시 로그인 시도

## 일반적인 문제

### 문제 1: Callback URL이 잘려 있음
- **증상**: `https://pmfzabgoiqnmlvdrlgpp.supabase.co/auth/v` (끝이 잘림)
- **해결**: 전체 URL `https://pmfzabgoiqnmlvdrlgpp.supabase.co/auth/v1/callback` 입력

### 문제 2: Client ID 불일치
- **증상**: Supabase의 Client ID와 Google Cloud Console의 Client ID가 다름
- **해결**: Google Cloud Console에서 정확한 Client ID 복사하여 Supabase에 입력

### 문제 3: Client Secret 불일치
- **증상**: Supabase의 Client Secret과 Google Cloud Console의 Client Secret이 다름
- **해결**: Google Cloud Console에서 새로 생성하거나 기존 Secret 확인 후 입력

## 확인 체크리스트

- [ ] Supabase Callback URL이 전체 경로로 입력되어 있음
- [ ] Google Cloud Console의 승인된 리디렉션 URI와 일치함
- [ ] Supabase Client ID가 Google Cloud Console과 일치함
- [ ] Supabase Client Secret이 올바르게 입력되어 있음
- [ ] Supabase에서 Save 버튼을 클릭하여 저장함
- [ ] 5-10분 대기 후 테스트함
- [ ] 브라우저 캐시를 삭제하고 재시도함
