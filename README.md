# RecruitOps - AI 기반 채용 관리 플랫폼

AI 기반 일정 조율, 프로세스 관리, 후보자 대시보드를 포함한 채용 관리 플랫폼입니다.

## 기능

### Phase 1 (MVP)
- ✅ AI 일정 조율 에이전트
- ✅ 커스텀 프로세스 빌더 (드래그 앤 드롭)
- ✅ 후보자 Kanban 대시보드
- ✅ 후보자 인터랙션 페이지 (모바일 최적화)
- ✅ 타임라인 기본 기능
- ✅ 후보자 상세 타임라인 기반 일정 관리 (2025.02.28)
- ✅ Activity Timeline 실행 주체 프로필 표시 (2026.03.27)
- ✅ 조직 공용 이메일 템플릿 생성/적용 기능 (2026.03.27)
- ✅ 구글 OAuth 로그인
- ✅ 사용자 권한 시스템 (admin, recruiter, interviewer)
- ✅ 면접관 일정 확인 안내 메일 발송
- ✅ 면접관 응답 미확인 시 데일리 리마인드 메일 발송
- ✅ 구글 캘린더 웹훅 기반 면접관 응답 자동 확인
- ✅ 일정 자동화 KST 기준/가능시간+제외시간 동시 설정/오전·오후 선호 반영 (2026.04.01)

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

# Next.js
NEXT_PUBLIC_APP_URL=http://localhost:3000

# AI Providers (최소 하나 필요)
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key

# Google Calendar API & Gmail API
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Google Calendar 웹훅(구글이 호출하는 공개 URL)
# - 반드시 https 권장(구글 Push Notification 요구사항)
GOOGLE_CALENDAR_WEBHOOK_URL=https://your-domain.com/api/webhooks/google-calendar-events

# Cron Job (리마인드 메일 발송용)
CRON_SECRET_KEY=your_cron_secret_key
```

**참고**: 
- 구글 OAuth 로그인을 사용하려면 Supabase 대시보드에서 구글 프로바이더를 설정해야 합니다. 자세한 내용은 [구글 OAuth 설정 가이드](docs/setup-guide.md)를 참조하세요.
- 이메일 발송 기능은 Google Workspace의 Gmail API를 사용합니다. Google Cloud Console에서 Gmail API를 활성화하고, 구글 캘린더 연동 시 Gmail 발송 권한도 함께 승인해야 합니다. 자세한 내용은 [Gmail API 설정 가이드](docs/gmail-api-setup.md)를 참조하세요.
- 리마인드 메일 발송 기능을 사용하려면 외부 cron 서비스(예: [cron-job.org](https://cron-job.org))에서 매일 `https://your-domain.com/api/cron/send-reminder-emails`를 호출하도록 설정하세요. Authorization 헤더에 `Bearer {CRON_SECRET_KEY}`를 포함해야 합니다.

### 배포 (GCP Cloud Run)

다음 문서를 순서대로 따라 하시면 GitHub Actions로 Cloud Run에 자동 배포됩니다.

1. 인프라 1회 설정
   - `docs/deploy/gcp-bootstrap.md`의 스크립트를 실행하여 Artifact Registry, Service Account, Workload Identity Federation(OIDC), Secret Manager를 준비합니다.
   - GitHub 리포지토리 시크릿 설정:
     - `GCP_PROJECT_ID`, `GCP_REGION`, `GCP_SERVICE_NAME`
     - `GAR_LOCATION` (예: `asia-northeast3`)
     - `GCP_WORKLOAD_IDP` (WIF Provider 리소스 경로)
     - `GCP_SERVICE_ACCOUNT` (예: `vntg-ats-deployer@{project}.iam.gserviceaccount.com`)

2. 애플리케이션 컨테이너 빌드/배포
   - `main` 브랜치에 커밋/푸시하면 `.github/workflows/deploy.yml`이 자동으로:
     - Docker 이미지를 빌드하여 Artifact Registry에 푸시
     - Cloud Run에 새 리비전 배포

3. Cloud Run 서비스 구성
   - `docs/deploy/cloud-run-config.md`를 참고해:
     - Secret Manager 값을 환경변수로 연결
     - 동시성/리소스/오토스케일 파라미터 조정
     - 무중단 배포를 위한 트래픽 전환(선택)

4. 커스텀 도메인/HTTPS (선택)
   - `docs/deploy/domain-and-cdn.md`를 참고해 도메인 매핑 및 (필요 시) Cloud CDN을 구성합니다.

배포가 완료되면 Cloud Run 서비스 URL이 워크플로우 로그에 출력됩니다.

### 2. 데이터베이스 마이그레이션

Supabase 대시보드에서 다음 마이그레이션 파일들을 순서대로 실행하세요:

1. `supabase/migrations/001_initial_schema.sql` - 기본 스키마
2. `supabase/migrations/20250221000003_add_figma_fields.sql` - JD Requests 및 추가 기능

또는 Supabase CLI를 사용하는 경우:

```bash
supabase db push
```

**중요**: `jd_requests` 테이블이 없다는 에러가 발생하는 경우, `scripts/apply-jd-requests-migration.sql` 파일을 Supabase 대시보드의 SQL Editor에서 실행하세요. 자세한 내용은 [JD Requests 마이그레이션 가이드](docs/jd-requests-migration-guide.md)를 참조하세요.

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
4. 후보자 상세 페이지에서 "일정 등록" 버튼 클릭
5. AI가 면접관 캘린더를 분석하여 일정 옵션 생성
6. 후보자에게 전송된 링크로 일정 선택

#### 일정 자동화 옵션 (KST 기준)
- 기본 가능시간: 10:00 ~ 17:00
- 기본 제외시간: 11:30 ~ 12:30
- 면접관별 선호: 없음/오전만(10:00~11:30)/오후만(13:00~17:00)
- 선택적으로 “가능 시간대”를 직접 지정할 수 있습니다. 지정 시 해당 구간 내에서만 슬롯이 생성됩니다.

**일정 관리**: 모든 일정 진행 현황과 관리는 후보자 상세 페이지의 Activity Timeline에서 확인하고 관리할 수 있습니다. 타임라인 내 일정 카드에서 재조율, 취소, 삭제 등의 액션을 바로 수행할 수 있습니다.

### 3. 후보자 인터랙션

후보자는 로그인 없이 토큰 기반 링크로 접근하여:
- AI가 제안한 일정 옵션 중 선택
- 음료 선호도 선택
- 일정 확정

## 라이선스

MIT
