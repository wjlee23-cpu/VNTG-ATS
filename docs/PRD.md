# Project: AI-Based ATS & Scheduling Platform (RecruitOps)

## 1. 프로젝트 개요 (Overview)
본 프로젝트는 채용 담당자의 반복적인 일정 조율 업무를 자동화하고, 파편화된 채용 커뮤니케이션을 타임라인 기반으로 통합하는 AI 기반 채용 관리 플랫폼 구축을 목표로 합니다.

### 1.1. 해결 과제 (Problem)
* [cite_start]**운영 비효율:** 다대일 면접 일정 조율 시 수동 캘린더 대조 및 반복적인 메일 발송으로 리소스 낭비[cite: 3].
* [cite_start]**맥락(Context) 부재:** 메신저 소통으로 인해 후보자 히스토리(이메일, 피드백 등) 파악이 어려움[cite: 4].
* [cite_start]**낙후된 지원 경험:** 복잡한 지원 절차로 인한 인재 이탈[cite: 5].

### 1.2. 핵심 목표 (Goals)
* [cite_start]**Phase 1 (MVP):** AI 에이전트를 통한 일정 조율 완전 자동화 (업무 시간 90% 단축)[cite: 7, 16].
* [cite_start]**Phase 2:** 후보자 중심의 타임라인 통합 뷰(Feed) 구축[cite: 8].
* [cite_start]**Phase 3:** 이력서 파싱 및 데이터 자산화[cite: 9].

---

## 2. 기술 스택 권장안 (Tech Stack Recommendation)
* **Frontend:** Next.js (React), Tailwind CSS (빠른 UI 구축)
* **Backend:** Node.js or Python (FastAPI) - *Calendar API 핸들링 및 AI 연동 유리*
* **Database:** PostgreSQL (Supabase 권장 - Realtime, Auth 포함)
* **AI/LLM:** OpenAI API or Anthropic API (이력서 파싱 및 일정 추론)
* **Integration:** Google Calendar API / Outlook API

---

## 3. 기능 명세 (Functional Specifications)

### [cite_start]Phase 1: MVP - AI 일정 조율 및 프로세스 관리 [cite: 15]

#### 3.1. [cite_start]AI 일정 조율 에이전트 (Automation Engine) [cite: 17]
* [cite_start]**Trigger:** 담당자가 '실행' 버튼 클릭 시 프로세스 시작[cite: 21].
* **Smart Matching:**
    * [cite_start]지정 기간 내 면접관 N명의 교집합 시간대 추출[cite: 20].
    * [cite_start]충돌 감지 로직(Conflict Detection) 포함[cite: 23].
* **Auto-Communication:**
    * [cite_start]안내 메시지(메일/알림톡) 자동 생성 및 발송[cite: 22].
    * [cite_start]후보자 거절/충돌 시 담당자 알림 및 재조율 경로 제공[cite: 23].

#### 3.2. [cite_start]커스텀 프로세스 빌더 (Process Builder) [cite: 24]
* [cite_start]**Drag & Drop:** 채용 단계(Stage) 생성, 삭제, 순서 변경 기능[cite: 27].
* [cite_start]**Mapping:** 각 단계별 의사결정권자(면접관) 지정 기능[cite: 28].

#### 3.3. [cite_start]후보자 현황 대시보드 (Dashboard) [cite: 29]
* [cite_start]**Kanban View:** 단계별 후보자 위치 시각화[cite: 32].
* [cite_start]**Status Indicators:** 대기 / 진행 중 / 확정 / 이슈 상태 표시[cite: 32].
* [cite_start]**Action:** 드래그 앤 드롭으로 상태 변경[cite: 33].

#### 3.4. [cite_start]후보자 인터랙션 페이지 (Mobile Web) [cite: 34]
* [cite_start]**No-Login:** 후보자는 로그인 없이 접근 가능[cite: 35].
* [cite_start]**Features:** AI 제안 일정 중 택일, 음료 선택 기능[cite: 35].

---

### [cite_start]Phase 2: 협업 강화 (Timeline & Scorecard) [cite: 36]

#### 3.5. [cite_start]후보자 타임라인 스레드 (Timeline Thread) [cite: 38]
* [cite_start]**Unified View (Feed):** 서류, 면접, 대화, 메일 등 모든 히스토리를 시간순 스크롤 뷰로 제공 (FB/Insta 스타일)[cite: 39, 47].
* [cite_start]**Email Sync:** 후보자와의 이메일 수발신 내역 자동 동기화 및 배치[cite: 41].
* **Interaction:**
    * [cite_start]평가/피드백 요약 카드 삽입[cite: 42].
    * [cite_start]팀원 멘션(@) 및 코멘트 기능[cite: 43, 44].
* [cite_start]**System Logs:** 단계 이동, 일정 확정 등 시스템 이벤트 자동 기록[cite: 46].

#### 3.6. [cite_start]온라인 면접 평가표 (Digital Scorecard) [cite: 48]
* [cite_start]**Creation:** 면접 확정 시 면접관에게 작성 권한 부여[cite: 51].
* [cite_start]**Integration:** 작성 완료된 점수/코멘트는 타임라인에 자동 포스팅[cite: 52].

---

### [cite_start]Phase 3: ATS 완성 (Data & Parsing) [cite: 53]

#### 3.7. [cite_start]AI 이력서 파싱 (Resume Parsing) [cite: 55]
* [cite_start]**Input:** PDF, Word 등 비정형 파일[cite: 56].
* [cite_start]**Processing:** AI 분석을 통해 이름, 연락처, 학력, 스킬 등 정형 데이터 추출[cite: 58].
* [cite_start]**Mapping:** 추출 데이터를 지원서 DB 필드에 자동 매핑[cite: 59].
* [cite_start]**UX:** 파일 업로드만으로 지원 완료 (Zero-Effort Apply)[cite: 13, 60].

---

## 4. 데이터 모델링 핵심 엔티티 (Proposed Schema Entities)
*개발 시 아래 엔티티 관계를 우선 설계해야 함.*

1.  **JobPost:** 채용 공고 (프로세스 설정 포함)
2.  **Candidate:** 지원자 정보 (파싱된 데이터)
3.  **ProcessStage:** 채용 단계 (순서, 담당자 매핑 정보)
4.  **Schedule:** 면접 일정 (상태, 시간, 참석자)
5.  **TimelineEvent:** 타임라인에 표시될 개별 이벤트 (Type: EMAIL, COMMENT, SYSTEM_LOG, SCORECARD)
6.  **Scorecard:** 면접 평가 데이터

---

## [cite_start]5. 구현 로드맵 (Roadmap) [cite: 61, 62]

| 단계 | 목표 | 핵심 기능 |
| :--- | :--- | :--- |
| **Phase 1** | 운영 자동화 (MVP) | AI 일정 조율, 충돌 감지, 프로세스 빌더, 대시보드 |
| **Phase 2** | 협업 및 평가 | 타임라인 스레드, 이메일 동기화, 멘션(@), 평가표 |
| **Phase 3** | 종합 ATS | AI 이력서 파싱, 데이터 정형화, 지원 페이지 |