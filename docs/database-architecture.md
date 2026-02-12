# 데이터베이스 아키텍처 설계서

## 개요
본 문서는 RecruitOps 플랫폼의 데이터베이스 스키마 설계를 정의합니다.
기획서(PRD.md)의 Phase 1, 2, 3 모든 기능을 지원하는 완전한 테이블 구조를 포함합니다.

## 테이블 구조

### 1. 핵심 엔티티 (Core Entities)

#### 1.1 Organizations (조직)
- **목적**: 멀티 테넌트 지원을 위한 조직 단위
- **주요 필드**: id, name, created_at

#### 1.2 Users (사용자)
- **목적**: 채용 담당자, 면접관 등 시스템 사용자
- **주요 필드**: 
  - id (auth.users 참조)
  - organization_id
  - role (admin, recruiter, interviewer)
  - calendar_provider, calendar_access_token, calendar_refresh_token (캘린더 연동)

#### 1.3 Processes (프로세스)
- **목적**: 채용 프로세스 템플릿 (드래그 앤 드롭으로 구성)
- **주요 필드**: 
  - organization_id
  - name
  - stages (JSONB - 단계 정보 및 면접관 매핑)

#### 1.4 Job Posts (채용 공고)
- **목적**: 실제 채용 공고 및 후보자 관리 단위
- **주요 필드**: 
  - organization_id
  - title, description
  - process_id (프로세스 템플릿 참조)

### 2. 후보자 관리 (Candidate Management)

#### 2.1 Candidates (후보자)
- **목적**: 지원자 정보 관리
- **주요 필드**:
  - job_post_id
  - name, email, phone
  - status (pending, in_progress, confirmed, rejected, issue)
  - current_stage_id (현재 채용 단계)
  - token (비로그인 접근용)
  - **Phase 3 추가 필드**:
    - resume_file_url (이력서 파일 경로)
    - parsed_data (JSONB - AI 파싱 결과)
    - education, skills, experience (파싱된 구조화 데이터)

#### 2.2 Resume Files (이력서 파일) - Phase 3
- **목적**: 업로드된 이력서 파일 관리
- **주요 필드**:
  - candidate_id
  - file_url (Supabase Storage 경로)
  - file_type (pdf, doc, docx)
  - parsing_status (pending, processing, completed, failed)
  - parsed_data (JSONB - AI 파싱 결과)

### 3. 일정 관리 (Schedule Management)

#### 3.1 Schedules (면접 일정)
- **목적**: 확정된 면접 일정
- **주요 필드**:
  - candidate_id
  - stage_id
  - scheduled_at, duration_minutes
  - status (pending, confirmed, rejected, completed)
  - interviewer_ids (UUID 배열)
  - candidate_response (accepted, rejected, pending)
  - beverage_preference

#### 3.2 Schedule Options (일정 옵션)
- **목적**: AI가 생성한 일정 후보들
- **주요 필드**:
  - schedule_id
  - scheduled_at
  - status (pending, selected, rejected)

### 4. 타임라인 및 협업 (Timeline & Collaboration) - Phase 2

#### 4.1 Timeline Events (타임라인 이벤트)
- **목적**: 후보자 관련 모든 활동을 시간순으로 기록
- **주요 필드**:
  - candidate_id
  - type: 
    - system_log (시스템 자동 로그)
    - schedule_created, schedule_confirmed, stage_changed (Phase 1)
    - email (Phase 2)
    - comment (Phase 2)
    - scorecard (Phase 2)
    - approval (Phase 2)
  - content (JSONB - 이벤트별 상세 정보)
  - created_by (사용자 참조)

#### 4.2 Emails (이메일) - Phase 2
- **목적**: 후보자와의 이메일 수발신 내역 동기화
- **주요 필드**:
  - candidate_id
  - message_id (이메일 서버의 고유 ID)
  - subject, body
  - from_email, to_email
  - direction (inbound, outbound)
  - sent_at, received_at
  - synced_at (동기화 시점)

#### 4.3 Comments (코멘트) - Phase 2
- **목적**: 팀원 간 코멘트 및 멘션 기능
- **주요 필드**:
  - candidate_id
  - content (텍스트)
  - created_by
  - mentioned_user_ids (UUID 배열 - 멘션된 사용자)
  - parent_comment_id (대댓글 지원)

### 5. 평가 (Evaluation) - Phase 2

#### 5.1 Scorecards (면접 평가표)
- **목적**: 면접관의 평가 및 피드백
- **주요 필드**:
  - schedule_id (어떤 면접에 대한 평가인지)
  - candidate_id
  - interviewer_id (평가 작성자)
  - overall_rating (1-5 점수)
  - criteria_scores (JSONB - 세부 평가 항목)
  - strengths, weaknesses, notes (텍스트)
  - submitted_at

## 관계도 (ERD)

```
Organizations
  ├── Users (1:N)
  ├── Processes (1:N)
  └── Job Posts (1:N)
      └── Candidates (1:N)
          ├── Schedules (1:N)
          │   ├── Schedule Options (1:N)
          │   └── Scorecards (1:1)
          ├── Timeline Events (1:N)
          ├── Emails (1:N)
          ├── Comments (1:N)
          └── Resume Files (1:N)
```

## 인덱스 전략

### 성능 최적화를 위한 인덱스
1. **조직 단위 필터링**: organization_id 인덱스
2. **후보자 조회**: job_post_id, status, token 인덱스
3. **일정 조회**: candidate_id, status, scheduled_at 인덱스
4. **타임라인 조회**: candidate_id, created_at DESC 인덱스
5. **이메일 동기화**: message_id, candidate_id 인덱스
6. **멘션 알림**: mentioned_user_ids GIN 인덱스

## Row Level Security (RLS)

모든 테이블에 RLS가 활성화되어 있으며, 조직 단위로 데이터 격리가 보장됩니다.
- 사용자는 자신의 조직 내 데이터만 조회/수정 가능
- 면접관은 자신이 참여하는 일정만 조회 가능
- 후보자는 토큰 기반으로 자신의 정보만 조회 가능

## 마이그레이션 전략

1. **001_initial_schema.sql**: Phase 1 MVP 기본 테이블
2. **002_phase2_features.sql**: Phase 2 기능 추가 (이메일, 코멘트, 평가표)
3. **003_phase3_resume_parsing.sql**: Phase 3 이력서 파싱 기능
