# 백엔드 아키텍처 설계서

## 개요

본 문서는 RecruitOps 플랫폼의 백엔드 아키텍처를 설명합니다. Next.js 16 App Router의 Server Actions를 기반으로 하며, Supabase를 데이터베이스로 사용합니다.

## 아키텍처 원칙

### 1. 모듈화 (Modularity)
- 기능별로 모듈을 분리하여 유지보수성을 높입니다.
- `api/actions/`: 데이터 변경 작업 (CREATE, UPDATE, DELETE)
- `api/queries/`: 데이터 조회 작업 (READ)
- `api/utils/`: 공통 유틸리티 함수

### 2. 타입 안전성 (Type Safety)
- TypeScript를 활용한 엄격한 타입 체크
- Supabase에서 생성된 타입을 재사용
- `any` 타입 사용 최소화

### 3. 보안 (Security)
- 모든 데이터 접근은 organization_id 기반으로 필터링
- Row Level Security (RLS)와 애플리케이션 레벨 보안 이중 체크
- 인증되지 않은 요청은 즉시 차단

### 4. 에러 처리 (Error Handling)
- 일관된 에러 응답 형식
- 사용자 친화적인 에러 메시지
- 모든 Server Actions는 `withErrorHandling` 래퍼 사용

## 폴더 구조

```
api/
├── actions/           # 데이터 변경 작업
│   ├── candidates.ts  # 후보자 CRUD
│   ├── jobs.ts        # 채용 공고 CRUD
│   ├── schedules.ts   # 면접 일정 CRUD
│   └── processes.ts   # 채용 프로세스 CRUD
├── queries/           # 데이터 조회 작업
│   ├── candidates.ts  # 후보자 조회
│   ├── jobs.ts        # 채용 공고 조회
│   ├── schedules.ts   # 면접 일정 조회
│   ├── processes.ts   # 채용 프로세스 조회
│   ├── timeline.ts    # 타임라인 이벤트 조회
│   └── dashboard.ts   # 대시보드 통계 조회
└── utils/             # 공통 유틸리티
    ├── auth.ts        # 인증 및 권한 체크
    ├── errors.ts      # 에러 처리
    └── validation.ts  # 입력 검증
```

## 공통 유틸리티 모듈

### `api/utils/auth.ts`

인증 및 권한 체크를 담당합니다.

**주요 함수:**
- `getCurrentUser()`: 현재 로그인한 사용자 정보와 organization_id 반환
- `checkOrganizationAccess(organizationId)`: 특정 조직 접근 권한 확인
- `verifyJobPostAccess(jobPostId)`: 채용 공고 접근 권한 확인
- `verifyCandidateAccess(candidateId)`: 후보자 접근 권한 확인

**사용 예시:**
```typescript
const user = await getCurrentUser();
// user.organizationId를 사용하여 데이터 필터링
```

### `api/utils/errors.ts`

에러 처리를 표준화합니다.

**주요 클래스:**
- `AppError`: 기본 애플리케이션 에러
- `AuthenticationError`: 인증 에러 (401)
- `AuthorizationError`: 권한 에러 (403)
- `NotFoundError`: 리소스 없음 에러 (404)
- `ValidationError`: 입력 검증 에러 (400)

**주요 함수:**
- `handleError(error)`: 에러를 사용자 친화적인 메시지로 변환
- `withErrorHandling(fn)`: Server Action을 안전하게 래핑

**사용 예시:**
```typescript
export async function createCandidate(formData: FormData) {
  return withErrorHandling(async () => {
    // ... 로직
    return data;
  });
}
```

### `api/utils/validation.ts`

입력값 검증을 담당합니다.

**주요 함수:**
- `validateRequired(value, fieldName)`: 필수값 검증
- `validateEmail(email)`: 이메일 형식 검증
- `validatePhone(phone)`: 전화번호 형식 검증
- `validateUUID(id, fieldName)`: UUID 형식 검증
- `validateNumberRange(value, min, max, fieldName)`: 숫자 범위 검증
- `validateFutureDate(date, fieldName)`: 미래 날짜 검증
- `validateNonEmptyArray(array, fieldName)`: 비어있지 않은 배열 검증

## Server Actions 패턴

### 기본 구조

모든 Server Action은 다음 패턴을 따릅니다:

```typescript
'use server';

import { withErrorHandling } from '@/api/utils/errors';
import { getCurrentUser } from '@/api/utils/auth';
import { validateRequired } from '@/api/utils/validation';

export async function createResource(formData: FormData) {
  return withErrorHandling(async () => {
    // 1. 인증 확인
    const user = await getCurrentUser();
    
    // 2. 입력값 검증
    const name = validateRequired(formData.get('name'), '이름');
    
    // 3. 권한 확인 (필요시)
    // await verifyResourceAccess(resourceId);
    
    // 4. 데이터베이스 작업
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('resources')
      .insert({ ... })
      .select()
      .single();
    
    if (error) {
      throw new Error(`리소스 생성 실패: ${error.message}`);
    }
    
    // 5. 캐시 무효화
    revalidatePath('/dashboard/resources');
    
    // 6. 반환
    return data;
  });
}
```

### 반환 형식

모든 Server Action은 `{ data?: T; error?: string }` 형식으로 반환합니다:

```typescript
// 성공 시
{ data: { id: '...', name: '...' } }

// 실패 시
{ error: '에러 메시지' }
```

## Queries 패턴

### 기본 구조

모든 Query 함수는 다음 패턴을 따릅니다:

```typescript
'use server';

import { withErrorHandling } from '@/api/utils/errors';
import { getCurrentUser } from '@/api/utils/auth';

export async function getResources() {
  return withErrorHandling(async () => {
    // 1. 인증 확인
    const user = await getCurrentUser();
    
    // 2. 데이터베이스 조회 (organization_id 필터링 필수)
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('resources')
      .select('*')
      .eq('organization_id', user.organizationId)
      .order('created_at', { ascending: false });
    
    if (error) {
      throw new Error(`리소스 조회 실패: ${error.message}`);
    }
    
    // 3. 반환
    return data || [];
  });
}
```

## 보안 체크리스트

모든 Server Action과 Query는 다음을 확인해야 합니다:

- [ ] `getCurrentUser()`를 호출하여 인증 확인
- [ ] `organization_id` 기반 데이터 필터링
- [ ] 입력값 검증 (`validateRequired`, `validateEmail` 등)
- [ ] `withErrorHandling` 래퍼 사용
- [ ] 에러 발생 시 사용자 친화적인 메시지 반환
- [ ] 데이터 변경 후 `revalidatePath` 호출

## 데이터 흐름

### 1. 조회 흐름 (Read)

```
[Page Component]
  ↓
[Query Function] (api/queries/*.ts)
  ↓
[getCurrentUser()] (인증 확인)
  ↓
[Supabase Query] (organization_id 필터링)
  ↓
[Return Data]
```

### 2. 변경 흐름 (Write)

```
[Form Component]
  ↓
[Server Action] (api/actions/*.ts)
  ↓
[withErrorHandling] (에러 처리)
  ↓
[getCurrentUser()] (인증 확인)
  ↓
[validate*] (입력 검증)
  ↓
[verify*Access] (권한 확인)
  ↓
[Supabase Mutation]
  ↓
[revalidatePath] (캐시 무효화)
  ↓
[Return Result]
```

## 테스트 전략

### 더미 데이터 생성

`scripts/seed-dummy-data.ts`를 실행하여 테스트용 더미 데이터를 생성할 수 있습니다:

```bash
npx tsx scripts/seed-dummy-data.ts
```

이 스크립트는 다음을 생성합니다:
- 조직 1개
- 채용 공고 8개
- 후보자 30명
- 면접 일정 15개
- 타임라인 이벤트 (후보자당 3-6개)
- 면접 일정 옵션 (일정당 3개)

### 테스트 시나리오

1. **인증 테스트**: 로그인하지 않은 사용자의 요청은 에러 반환
2. **권한 테스트**: 다른 조직의 데이터 접근 시 에러 반환
3. **입력 검증 테스트**: 잘못된 형식의 입력값은 에러 반환
4. **데이터 무결성 테스트**: 외래키 제약 조건 확인

## 성능 최적화

### 1. 인덱스 활용

Supabase에서 생성한 인덱스를 활용:
- `organization_id` 인덱스
- `job_post_id` 인덱스
- `candidate_id` 인덱스
- `created_at` 인덱스

### 2. 쿼리 최적화

- 필요한 컬럼만 선택 (`select('id, name')`)
- 적절한 `limit` 사용
- `order` 절 활용

### 3. 캐시 전략

- `revalidatePath`로 필요한 경로만 무효화
- 불필요한 재검증 방지

## 확장 가이드

### 새로운 모듈 추가하기

1. **Actions 추가**: `api/actions/[module].ts` 생성
2. **Queries 추가**: `api/queries/[module].ts` 생성
3. **타입 정의**: Supabase 타입 활용
4. **보안 체크**: `getCurrentUser()` 및 권한 확인 추가
5. **에러 처리**: `withErrorHandling` 래퍼 사용

### 예시: Comments 모듈 추가

```typescript
// api/actions/comments.ts
'use server';

import { withErrorHandling } from '@/api/utils/errors';
import { verifyCandidateAccess } from '@/api/utils/auth';
import { validateRequired } from '@/api/utils/validation';

export async function createComment(candidateId: string, content: string) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    await verifyCandidateAccess(candidateId);
    
    const validatedContent = validateRequired(content, '댓글 내용');
    
    // ... 데이터베이스 작업
  });
}
```

## 마이그레이션 가이드

기존 코드를 새로운 아키텍처로 마이그레이션하는 방법:

1. **에러 처리 개선**: `throw new Error` → `withErrorHandling` 래퍼
2. **인증 추가**: 모든 함수에 `getCurrentUser()` 추가
3. **입력 검증 추가**: `validateRequired`, `validateEmail` 등 사용
4. **타입 안전성**: Supabase 타입 활용
5. **반환 형식 통일**: `{ data, error }` 형식으로 변경

## 참고 자료

- [Next.js Server Actions 문서](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
- [Supabase 문서](https://supabase.com/docs)
- [TypeScript 핸드북](https://www.typescriptlang.org/docs/)
