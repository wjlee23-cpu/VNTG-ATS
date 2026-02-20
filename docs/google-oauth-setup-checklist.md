# Google OAuth 설정 체크리스트

## 현재 프로젝트 정보
- Supabase 프로젝트 참조 ID: `pmfzabgoiqnmlvdrlgpp`
- 필요한 리디렉션 URI: `https://pmfzabgoiqnmlvdrlgpp.supabase.co/auth/v1/callback`

## Google Cloud Console 설정 확인

### 1단계: OAuth 클라이언트 ID 확인
1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 프로젝트 선택
3. **API 및 서비스 > 사용자 인증 정보**로 이동
4. **OAuth 2.0 클라이언트 ID** 목록에서 클라이언트 ID 클릭

### 2단계: 승인된 리디렉션 URI 확인 및 추가
**승인된 리디렉션 URI** 섹션에 다음이 **정확히** 포함되어 있는지 확인:

```
https://pmfzabgoiqnmlvdrlgpp.supabase.co/auth/v1/callback
```

**중요 체크사항:**
- ✅ `https://` 사용 (http:// 아님)
- ✅ URI 끝에 슬래시(`/`) 없음
- ✅ 정확한 프로젝트 참조 ID: `pmfzabgoiqnmlvdrlgpp`
- ✅ 경로: `/auth/v1/callback` (정확히)

**없다면 추가:**
1. **+ URI 추가** 버튼 클릭
2. 위 URI를 정확히 입력
3. **저장** 클릭
4. **5분 이상 대기** (변경사항 반영 시간)

### 3단계: Supabase 대시보드 확인

1. [Supabase 대시보드](https://app.supabase.com/) 접속
2. 프로젝트 선택
3. **Authentication > Providers**로 이동
4. **Google** 프로바이더 확인:
   - ✅ **Enable Google provider** 토글이 켜져 있는지
   - ✅ **Client ID**가 올바르게 입력되어 있는지
   - ✅ **Client Secret**이 올바르게 입력되어 있는지

5. **Authentication > URL Configuration**로 이동
6. **Redirect URLs**에 다음이 포함되어 있는지 확인:
   - `http://localhost:3000/auth/callback` (로컬 개발용)

## 문제 해결

### 여전히 redirect_uri_mismatch 오류가 발생하는 경우

1. **Google Cloud Console에서 URI 다시 확인**
   - 복사/붙여넣기로 정확히 입력했는지 확인
   - 공백이나 특수문자가 없는지 확인

2. **캐시 삭제**
   - 브라우저 캐시 및 쿠키 삭제
   - 시크릿/프라이빗 모드에서 테스트

3. **변경사항 반영 대기**
   - Google Cloud Console 변경 후 최소 5-10분 대기

4. **Supabase 설정 확인**
   - Supabase 대시보드에서 Google 프로바이더가 활성화되어 있는지 확인
   - Client ID와 Secret이 Google Cloud Console과 일치하는지 확인

## 참고

- `.env` 파일의 `GOOGLE_REDIRECT_URI`는 코드에서 사용되지 않습니다
- Supabase OAuth는 자동으로 Supabase 콜백 URL을 사용합니다
- Google Cloud Console에만 올바른 URI를 등록하면 됩니다
