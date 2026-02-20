# RecruitOps - AI 기반 채용 관리 플랫폼

AI 기반 일정 조율, 프로세스 관리, 후보자 대시보드를 포함한 채용 관리 플랫폼입니다.

## 기능

### Phase 1 (MVP)
- ✅ AI 일정 조율 에이전트
- ✅ 커스텀 프로세스 빌더 (드래그 앤 드롭)
- ✅ 후보자 Kanban 대시보드
- ✅ 후보자 인터랙션 페이지 (모바일 최적화)
- ✅ 타임라인 기본 기능
- ✅ 구글 OAuth 로그인
- ✅ 사용자 권한 시스템 (admin, recruiter, interviewer)

## 기술 스택

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js Server Actions, Supabase
- **Database**: PostgreSQL (Supabase)
- **AI/LLM**: OpenAI API / Anthropic API
- **Calendar**: Google Calendar API
- **UI**: @dnd-kit (드래그 앤 드롭)

## 시작하기

### 1. 환경 변수 설정

`.env` 파일을 생성하고 다음 변수들을 설정하세요:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# AI Providers (최소 하나 필요)
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key

# Google Calendar API
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**참고**: 구글 OAuth 로그인을 사용하려면 Supabase 대시보드에서 구글 프로바이더를 설정해야 합니다. 자세한 내용은 [구글 OAuth 설정 가이드](docs/setup-guide.md)를 참조하세요.

### 2. 데이터베이스 마이그레이션

Supabase 대시보드에서 `supabase/migrations/001_initial_schema.sql` 파일의 내용을 실행하세요.

또는 Supabase CLI를 사용하는 경우:

```bash
supabase db push
```

### 3. 의존성 설치

```bash
npm install
```

### 4. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 확인하세요.

## 프로젝트 구조

```
app/
├── (auth)/              # 인증 페이지
├── (dashboard)/         # 대시보드 (인증 필요)
├── candidate/           # 후보자 인터랙션 페이지 (토큰 기반)
├── api/                 # API 라우트
├── lib/                 # 유틸리티 및 클라이언트
│   ├── supabase/        # Supabase 클라이언트
│   ├── ai/              # AI 클라이언트
│   └── calendar/        # 캘린더 연동
├── components/          # React 컴포넌트
│   ├── dashboard/       # 대시보드 컴포넌트
│   ├── process/         # 프로세스 빌더
│   ├── schedule/        # 일정 관리
│   └── timeline/        # 타임라인
└── actions/             # Server Actions
```

## 인증 및 권한

### 로그인 방법

1. **이메일/비밀번호 로그인**: 기존 이메일과 비밀번호로 로그인
2. **구글 OAuth 로그인**: 구글 계정으로 간편 로그인

### 권한 시스템

시스템은 3가지 권한 레벨을 지원합니다:

- **admin**: 모든 기능 접근 가능 (설정 변경, 사용자 관리 등)
- **recruiter**: 후보자 관리, 채용 공고 관리 가능
- **interviewer**: 평가표 작성만 가능

**초대 전용 정책**: 구글 로그인을 포함한 모든 로그인은 `users` 테이블에 등록된 사용자만 가능합니다. 관리자가 먼저 사용자를 초대해야 합니다.

### 권한 체크 사용법

Server Actions에서 권한을 체크하려면:

```typescript
import { requireAdmin, requireRecruiterOrAdmin } from '@/api/utils/auth';

// admin 권한만 허용
export async function deleteOrganization() {
  await requireAdmin();
  // ... 로직
}

// recruiter 이상 권한 허용
export async function createJobPost() {
  await requireRecruiterOrAdmin();
  // ... 로직
}
```

## 주요 기능 사용법

### 1. 프로세스 생성

1. 채용 공고 페이지에서 "프로세스 만들기" 클릭
2. 드래그 앤 드롭으로 단계 순서 변경
3. 각 단계에 면접관 지정
4. 저장

### 2. 후보자 추가 및 일정 조율

1. 채용 공고 상세 페이지에서 "후보자 추가"
2. 후보자 정보 입력
3. Kanban 보드에서 후보자를 단계로 드래그
4. "일정 조율" 버튼 클릭
5. AI가 면접관 캘린더를 분석하여 일정 옵션 생성
6. 후보자에게 전송된 링크로 일정 선택

### 3. 후보자 인터랙션

후보자는 로그인 없이 토큰 기반 링크로 접근하여:
- AI가 제안한 일정 옵션 중 선택
- 음료 선호도 선택
- 일정 확정

## 라이선스

MIT
