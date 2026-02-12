-- ============================================
-- 더미 데이터 생성 스크립트
-- ============================================
-- 테스트를 위한 샘플 데이터를 생성합니다.
-- RLS가 활성화되어 있으므로 Service Role Key로 실행하거나
-- Supabase 대시보드의 SQL Editor에서 실행하세요.
-- ============================================

-- 1. 조직 생성
-- 개발 모드에서 사용하는 mock organization_id와 일치시킴
INSERT INTO organizations (id, name) VALUES
  ('00000000-0000-0000-0000-000000000000', 'VNTG 테크'),
  ('00000000-0000-0000-0000-000000000001', 'VNTG 테크 (추가)'),
  ('00000000-0000-0000-0000-000000000002', '스타트업 A')
ON CONFLICT (id) DO NOTHING;

-- 2. 프로세스 생성
INSERT INTO processes (id, organization_id, name, stages) VALUES
  (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    '기본 채용 프로세스',
    '[
      {"id": "stage1", "name": "서류 전형", "interviewers": []},
      {"id": "stage2", "name": "1차 면접", "interviewers": []},
      {"id": "stage3", "name": "2차 면접", "interviewers": []},
      {"id": "stage4", "name": "최종 면접", "interviewers": []}
    ]'::jsonb
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    '신입 개발자 채용 프로세스',
    '[
      {"id": "stage1", "name": "서류 전형", "interviewers": []},
      {"id": "stage2", "name": "코딩 테스트", "interviewers": []},
      {"id": "stage3", "name": "기술 면접", "interviewers": []},
      {"id": "stage4", "name": "인성 면접", "interviewers": []}
    ]'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

-- 3. 채용 공고 생성
INSERT INTO job_posts (id, organization_id, title, description, process_id) VALUES
  (
    '20000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    '프론트엔드 개발자',
    'React, Next.js를 활용한 웹 애플리케이션 개발을 담당합니다.
    
필수 요구사항:
- React, TypeScript 경험 2년 이상
- Next.js 프레임워크 사용 경험
- RESTful API 연동 경험

우대사항:
- 채용 관리 시스템 개발 경험
- AI/LLM API 연동 경험
- Tailwind CSS 사용 경험',
    '10000000-0000-0000-0000-000000000001'
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    '백엔드 개발자',
    'Node.js, PostgreSQL을 활용한 서버 개발을 담당합니다.

필수 요구사항:
- Node.js, TypeScript 경험 2년 이상
- PostgreSQL 데이터베이스 설계 및 최적화 경험
- RESTful API 설계 및 개발 경험

우대사항:
- Supabase 사용 경험
- AI/LLM API 연동 경험
- 마이크로서비스 아키텍처 경험',
    '10000000-0000-0000-0000-000000000001'
  ),
  (
    '20000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    '풀스택 개발자 (신입)',
    '신입 개발자를 채용합니다. 체계적인 온보딩과 멘토링을 제공합니다.

필수 요구사항:
- 컴퓨터 공학 또는 관련 학과 전공
- 기본적인 프로그래밍 능력
- 학습에 대한 열정

우대사항:
- 개인 프로젝트 경험
- 오픈소스 기여 경험
- 인턴십 경험',
    '10000000-0000-0000-0000-000000000002'
  )
ON CONFLICT (id) DO NOTHING;

-- 4. 후보자 생성
INSERT INTO candidates (id, job_post_id, name, email, phone, status, current_stage_id, token) VALUES
  -- 프론트엔드 개발자 지원자들
  (
    '30000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    '김철수',
    'kim.chulsoo@example.com',
    '010-1234-5678',
    'in_progress',
    'stage2',
    'token_kim_chulsoo_001'
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000001',
    '이영희',
    'lee.younghee@example.com',
    '010-2345-6789',
    'pending',
    'stage1',
    'token_lee_younghee_002'
  ),
  (
    '30000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000001',
    '박민수',
    'park.minsu@example.com',
    '010-3456-7890',
    'confirmed',
    'stage3',
    'token_park_minsu_003'
  ),
  (
    '30000000-0000-0000-0000-000000000004',
    '20000000-0000-0000-0000-000000000001',
    '정수진',
    'jung.sujin@example.com',
    '010-4567-8901',
    'rejected',
    'stage1',
    'token_jung_sujin_004'
  ),
  -- 백엔드 개발자 지원자들
  (
    '30000000-0000-0000-0000-000000000005',
    '20000000-0000-0000-0000-000000000002',
    '최동현',
    'choi.donghyun@example.com',
    '010-5678-9012',
    'in_progress',
    'stage2',
    'token_choi_donghyun_005'
  ),
  (
    '30000000-0000-0000-0000-000000000006',
    '20000000-0000-0000-0000-000000000002',
    '한지은',
    'han.jieun@example.com',
    '010-6789-0123',
    'pending',
    'stage1',
    'token_han_jieun_006'
  ),
  -- 신입 개발자 지원자들
  (
    '30000000-0000-0000-0000-000000000007',
    '20000000-0000-0000-0000-000000000003',
    '강태영',
    'kang.taeyoung@example.com',
    '010-7890-1234',
    'pending',
    'stage1',
    'token_kang_taeyoung_007'
  ),
  (
    '30000000-0000-0000-0000-000000000008',
    '20000000-0000-0000-0000-000000000003',
    '윤서연',
    'yoon.seoyeon@example.com',
    '010-8901-2345',
    'in_progress',
    'stage2',
    'token_yoon_seoyeon_008'
  )
ON CONFLICT (id) DO NOTHING;

-- 5. 일정 생성
INSERT INTO schedules (id, candidate_id, stage_id, scheduled_at, duration_minutes, status, interviewer_ids, candidate_response) VALUES
  (
    '40000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    'stage2',
    NOW() + INTERVAL '3 days',
    60,
    'confirmed',
    ARRAY[]::UUID[],
    'accepted'
  ),
  (
    '40000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000003',
    'stage3',
    NOW() + INTERVAL '5 days',
    90,
    'pending',
    ARRAY[]::UUID[],
    'pending'
  ),
  (
    '40000000-0000-0000-0000-000000000003',
    '30000000-0000-0000-0000-000000000005',
    'stage2',
    NOW() + INTERVAL '2 days',
    60,
    'confirmed',
    ARRAY[]::UUID[],
    'accepted'
  ),
  (
    '40000000-0000-0000-0000-000000000004',
    '30000000-0000-0000-0000-000000000008',
    'stage2',
    NOW() + INTERVAL '4 days',
    60,
    'pending',
    ARRAY[]::UUID[],
    'pending'
  )
ON CONFLICT (id) DO NOTHING;

-- 6. 일정 옵션 생성 (AI 생성 옵션)
INSERT INTO schedule_options (id, schedule_id, scheduled_at, status) VALUES
  (
    '50000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000002',
    NOW() + INTERVAL '5 days' + INTERVAL '10 hours',
    'selected'
  ),
  (
    '50000000-0000-0000-0000-000000000002',
    '40000000-0000-0000-0000-000000000002',
    NOW() + INTERVAL '6 days' + INTERVAL '14 hours',
    'rejected'
  ),
  (
    '50000000-0000-0000-0000-000000000003',
    '40000000-0000-0000-0000-000000000002',
    NOW() + INTERVAL '7 days' + INTERVAL '9 hours',
    'rejected'
  )
ON CONFLICT (id) DO NOTHING;

-- 7. 타임라인 이벤트 생성
INSERT INTO timeline_events (id, candidate_id, type, content, created_by) VALUES
  (
    '60000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    'system_log',
    '{"message": "후보자가 지원했습니다.", "stage": "stage1"}'::jsonb,
    NULL
  ),
  (
    '60000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000001',
    'stage_changed',
    '{"from": "stage1", "to": "stage2", "message": "서류 전형 통과"}'::jsonb,
    NULL
  ),
  (
    '60000000-0000-0000-0000-000000000003',
    '30000000-0000-0000-0000-000000000001',
    'schedule_created',
    '{"schedule_id": "40000000-0000-0000-0000-000000000001", "scheduled_at": "2024-02-15T10:00:00Z"}'::jsonb,
    NULL
  ),
  (
    '60000000-0000-0000-0000-000000000004',
    '30000000-0000-0000-0000-000000000003',
    'schedule_confirmed',
    '{"schedule_id": "40000000-0000-0000-0000-000000000002", "message": "면접 일정이 확정되었습니다."}'::jsonb,
    NULL
  ),
  (
    '60000000-0000-0000-0000-000000000005',
    '30000000-0000-0000-0000-000000000005',
    'system_log',
    '{"message": "후보자가 지원했습니다.", "stage": "stage1"}'::jsonb,
    NULL
  ),
  (
    '60000000-0000-0000-0000-000000000006',
    '30000000-0000-0000-0000-000000000005',
    'stage_changed',
    '{"from": "stage1", "to": "stage2", "message": "서류 전형 통과"}'::jsonb,
    NULL
  )
ON CONFLICT (id) DO NOTHING;

-- 8. 코멘트 생성 (Phase 2)
-- 주의: created_by는 users 테이블의 실제 사용자 ID가 필요합니다.
-- users 테이블은 auth.users를 참조하므로, 먼저 Supabase Auth에서 사용자를 생성한 후
-- 해당 사용자 ID를 사용하여 코멘트를 생성해야 합니다.
-- 
-- 예시:
-- INSERT INTO comments (id, candidate_id, content, created_by, mentioned_user_ids, parent_comment_id) VALUES
--   (
--     '70000000-0000-0000-0000-000000000001',
--     '30000000-0000-0000-0000-000000000001',
--     '이 후보자는 React 경험이 풍부해 보입니다.',
--     '실제_사용자_UUID_여기', -- Supabase Auth에서 생성한 사용자 ID
--     ARRAY[]::UUID[],
--     NULL
--   );

-- 9. 이메일 생성 (Phase 2)
INSERT INTO emails (id, candidate_id, message_id, subject, body, from_email, to_email, direction, sent_at, received_at) VALUES
  (
    '80000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    'email_001',
    '서류 전형 결과 안내',
    '안녕하세요. 서류 전형 결과를 안내드립니다. 1차 면접으로 진행하시게 되었습니다.',
    'hr@vntg-tech.com',
    'kim.chulsoo@example.com',
    'outbound',
    NOW() - INTERVAL '2 days',
    NULL
  ),
  (
    '80000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000001',
    'email_002',
    'Re: 서류 전형 결과 안내',
    '감사합니다. 면접 일정 확인하겠습니다.',
    'kim.chulsoo@example.com',
    'hr@vntg-tech.com',
    'inbound',
    NULL,
    NOW() - INTERVAL '1 day'
  )
ON CONFLICT (id) DO NOTHING;

-- 10. 이력서 파일 생성 (Phase 3) - 파싱 완료된 샘플
INSERT INTO resume_files (id, candidate_id, file_url, file_name, file_type, file_size, parsing_status, parsed_data) VALUES
  (
    '90000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    'resumes/kim_chulsoo_resume.pdf',
    '김철수_이력서.pdf',
    'pdf',
    245760,
    'completed',
    '{
      "name": "김철수",
      "email": "kim.chulsoo@example.com",
      "phone": "010-1234-5678",
      "education": [
        {"school": "서울대학교", "major": "컴퓨터공학과", "degree": "학사", "graduation": "2020"}
      ],
      "skills": ["React", "TypeScript", "Next.js", "Node.js", "PostgreSQL"],
      "experience": [
        {
          "company": "테크 스타트업",
          "position": "프론트엔드 개발자",
          "duration": "2021-2024",
          "description": "React 기반 웹 애플리케이션 개발"
        }
      ]
    }'::jsonb
  ),
  (
    '90000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000003',
    'resumes/park_minsu_resume.pdf',
    '박민수_이력서.pdf',
    'pdf',
    198432,
    'completed',
    '{
      "name": "박민수",
      "email": "park.minsu@example.com",
      "phone": "010-3456-7890",
      "education": [
        {"school": "카이스트", "major": "전산학과", "degree": "석사", "graduation": "2019"}
      ],
      "skills": ["React", "Vue.js", "TypeScript", "Python", "Django"],
      "experience": [
        {
          "company": "대기업 IT",
          "position": "시니어 프론트엔드 개발자",
          "duration": "2019-2024",
          "description": "대규모 웹 서비스 프론트엔드 개발 및 아키텍처 설계"
        }
      ]
    }'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

-- 11. 후보자 테이블에 파싱된 데이터 업데이트
UPDATE candidates SET
  parsed_data = (SELECT parsed_data FROM resume_files WHERE candidate_id = candidates.id LIMIT 1),
  education = (SELECT parsed_data->'education' FROM resume_files WHERE candidate_id = candidates.id LIMIT 1),
  skills = ARRAY(SELECT jsonb_array_elements_text((SELECT parsed_data->'skills' FROM resume_files WHERE candidate_id = candidates.id LIMIT 1))),
  experience = (SELECT parsed_data->'experience' FROM resume_files WHERE candidate_id = candidates.id LIMIT 1),
  parsed_at = NOW()
WHERE id IN (
  SELECT candidate_id FROM resume_files WHERE parsing_status = 'completed'
);

-- 완료 메시지
DO $$
BEGIN
  RAISE NOTICE '✅ 더미 데이터 생성이 완료되었습니다!';
  RAISE NOTICE '   - 조직: 2개';
  RAISE NOTICE '   - 프로세스: 2개';
  RAISE NOTICE '   - 채용 공고: 3개';
  RAISE NOTICE '   - 후보자: 8명';
  RAISE NOTICE '   - 일정: 4개';
  RAISE NOTICE '   - 타임라인 이벤트: 6개';
  RAISE NOTICE '   - 코멘트: (사용자 생성 후 수동으로 추가 필요)';
  RAISE NOTICE '   - 이메일: 2개';
  RAISE NOTICE '   - 이력서 파일: 2개';
END $$;
