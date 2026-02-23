-- ============================================
-- 모든 기능에 대한 종합 더미 데이터 생성
-- 생성일: 2026-02-24
-- ============================================
-- 이 마이그레이션은 모든 테이블에 대한 테스트용 더미 데이터를 생성합니다.
-- 기존 데이터는 삭제하지 않으므로, 필요시 수동으로 삭제 후 실행하세요.
-- ============================================

-- ============================================
-- 1. 조직 및 사용자 생성
-- ============================================

-- 조직 생성 (2개)
INSERT INTO organizations (id, name, created_at)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'VNTG Tech', NOW() - INTERVAL '6 months'),
  ('00000000-0000-0000-0000-000000000002', 'Startup Inc', NOW() - INTERVAL '3 months')
ON CONFLICT (id) DO NOTHING;

-- 사용자 생성 (10명)
-- 주의: 실제 auth.users에 해당 UUID가 있어야 합니다. 없으면 외래키 제약 조건 때문에 삽입이 실패합니다.
-- 테스트 환경에서는 기존 users를 사용하거나, 이 부분을 주석 처리하세요.
-- INSERT INTO users (id, email, organization_id, role, calendar_provider, created_at)
-- VALUES 
--   -- VNTG Tech 조직 사용자
--   ('10000000-0000-0000-0000-000000000001', 'admin@vntg.com', '00000000-0000-0000-0000-000000000001', 'admin', 'google', NOW() - INTERVAL '6 months'),
--   ('10000000-0000-0000-0000-000000000002', 'recruiter1@vntg.com', '00000000-0000-0000-0000-000000000001', 'recruiter', 'google', NOW() - INTERVAL '5 months'),
--   ('10000000-0000-0000-0000-000000000003', 'recruiter2@vntg.com', '00000000-0000-0000-0000-000000000001', 'recruiter', 'outlook', NOW() - INTERVAL '5 months'),
--   ('10000000-0000-0000-0000-000000000004', 'interviewer1@vntg.com', '00000000-0000-0000-0000-000000000001', 'interviewer', 'google', NOW() - INTERVAL '4 months'),
--   ('10000000-0000-0000-0000-000000000005', 'interviewer2@vntg.com', '00000000-0000-0000-0000-000000000001', 'interviewer', 'google', NOW() - INTERVAL '4 months'),
--   ('10000000-0000-0000-0000-000000000006', 'interviewer3@vntg.com', '00000000-0000-0000-0000-000000000001', 'interviewer', NULL, NOW() - INTERVAL '3 months'),
--   
--   -- Startup Inc 조직 사용자
--   ('10000000-0000-0000-0000-000000000007', 'admin@startup.com', '00000000-0000-0000-0000-000000000002', 'admin', 'google', NOW() - INTERVAL '3 months'),
--   ('10000000-0000-0000-0000-000000000008', 'recruiter@startup.com', '00000000-0000-0000-0000-000000000002', 'recruiter', 'outlook', NOW() - INTERVAL '2 months'),
--   ('10000000-0000-0000-0000-000000000009', 'interviewer@startup.com', '00000000-0000-0000-0000-000000000002', 'interviewer', 'google', NOW() - INTERVAL '2 months'),
--   ('10000000-0000-0000-0000-000000000010', 'hr@startup.com', '00000000-0000-0000-0000-000000000002', 'recruiter', NULL, NOW() - INTERVAL '1 month')
-- ON CONFLICT (id) DO NOTHING;

-- 대신 기존 users 테이블의 첫 번째 사용자를 사용하도록 설정
-- 또는 실제 auth.users에 존재하는 사용자 ID를 사용하세요.

-- ============================================
-- 2. 프로세스 생성
-- ============================================

INSERT INTO processes (id, organization_id, name, stages, created_at)
VALUES 
  -- VNTG Tech 프로세스
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '기본 채용 프로세스', 
   '[
     {"id": "stage-1", "name": "서류 전형", "order": 1, "interviewers": []},
     {"id": "stage-2", "name": "1차 면접", "order": 2, "interviewers": []},
     {"id": "stage-3", "name": "2차 면접", "order": 3, "interviewers": []},
     {"id": "stage-4", "name": "최종 면접", "order": 4, "interviewers": []},
     {"id": "stage-5", "name": "최종 합격", "order": 5, "interviewers": []}
   ]'::jsonb,
   NOW() - INTERVAL '6 months'),
  
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '엔지니어 채용 프로세스',
   '[
     {"id": "stage-1", "name": "서류 전형", "order": 1, "interviewers": []},
     {"id": "stage-2", "name": "코딩 테스트", "order": 2, "interviewers": []},
     {"id": "stage-3", "name": "기술 면접", "order": 3, "interviewers": []},
     {"id": "stage-4", "name": "컬처 핏 면접", "order": 4, "interviewers": []},
     {"id": "stage-5", "name": "최종 합격", "order": 5, "interviewers": []}
   ]'::jsonb,
   NOW() - INTERVAL '5 months'),
  
  -- Startup Inc 프로세스
  ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', '빠른 채용 프로세스',
   '[
     {"id": "stage-1", "name": "서류 전형", "order": 1, "interviewers": []},
     {"id": "stage-2", "name": "1차 면접", "order": 2, "interviewers": []},
     {"id": "stage-3", "name": "최종 합격", "order": 3, "interviewers": []}
   ]'::jsonb,
   NOW() - INTERVAL '3 months')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 3. 채용 공고 생성
-- ============================================

INSERT INTO job_posts (id, organization_id, title, description, process_id, created_at)
VALUES 
  -- VNTG Tech 채용 공고
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 
   'Senior Product Designer', 
   '우리 팀과 함께 혁신적인 제품을 디자인할 수 있는 시니어 프로덕트 디자이너를 찾고 있습니다. 5년 이상의 경력과 강한 커뮤니케이션 능력을 보유한 분을 우대합니다.',
   '20000000-0000-0000-0000-000000000001',
   NOW() - INTERVAL '4 months'),
  
  ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
   'Product Manager',
   '제품 전략을 수립하고 실행할 수 있는 프로덕트 매니저를 모집합니다. 데이터 기반 의사결정과 팀 협업 능력이 중요합니다.',
   '20000000-0000-0000-0000-000000000001',
   NOW() - INTERVAL '4 months'),
  
  ('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001',
   'Frontend Developer',
   'React, TypeScript를 활용한 프론트엔드 개발자를 모집합니다. 사용자 경험을 중시하는 개발 문화를 지향합니다.',
   '20000000-0000-0000-0000-000000000002',
   NOW() - INTERVAL '3 months'),
  
  ('30000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001',
   'Backend Developer',
   'Node.js, PostgreSQL을 활용한 백엔드 개발자를 모집합니다. 확장 가능한 시스템 설계 경험이 있으신 분을 우대합니다.',
   '20000000-0000-0000-0000-000000000002',
   NOW() - INTERVAL '3 months'),
  
  ('30000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001',
   'Full Stack Developer',
   '프론트엔드와 백엔드를 모두 다룰 수 있는 풀스택 개발자를 모집합니다.',
   '20000000-0000-0000-0000-000000000002',
   NOW() - INTERVAL '2 months'),
  
  -- Startup Inc 채용 공고
  ('30000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000002',
   'UX Designer',
   '사용자 중심의 디자인을 추구하는 UX 디자이너를 모집합니다.',
   '20000000-0000-0000-0000-000000000003',
   NOW() - INTERVAL '2 months'),
  
  ('30000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000002',
   'Software Engineer',
   '빠르게 성장하는 스타트업에서 함께할 소프트웨어 엔지니어를 모집합니다.',
   '20000000-0000-0000-0000-000000000003',
   NOW() - INTERVAL '1 month')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 4. 후보자 생성 (50명)
-- ============================================

DO $$
DECLARE
  job_post_ids UUID[] := ARRAY[
    '30000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000003',
    '30000000-0000-0000-0000-000000000004',
    '30000000-0000-0000-0000-000000000005',
    '30000000-0000-0000-0000-000000000006',
    '30000000-0000-0000-0000-000000000007'
  ];
  candidate_names TEXT[] := ARRAY[
    '김민수', '이영희', '박준호', '최수진', '정다은',
    '강태영', '윤서연', '임동현', '한소영', '오지훈',
    '신혜진', '조성민', '배유진', '송민준', '황지은',
    '김도현', '이서아', '박현우', '최예나', '정승호',
    '강민지', '윤태준', '임수빈', '한지훈', '오서현',
    '신동욱', '조은지', '배준서', '송하늘', '황민서',
    '김지우', '이준영', '박서윤', '최민규', '정수아',
    '강태현', '윤지원', '임도윤', '한서진', '오민석',
    '신예린', '조현우', '배서연', '송지훈', '황다은',
    '김태윤', '이서준', '박지원', '최민서', '정하늘'
  ];
  candidate_emails TEXT[] := ARRAY[
    'minsu.kim@example.com', 'younghee.lee@example.com', 'junho.park@example.com',
    'sujin.choi@example.com', 'daeun.jung@example.com', 'taeyoung.kang@example.com',
    'seoyeon.yoon@example.com', 'donghyun.lim@example.com', 'soyoung.han@example.com',
    'jihoon.oh@example.com', 'hyejin.shin@example.com', 'sungmin.cho@example.com',
    'yujin.bae@example.com', 'minjun.song@example.com', 'jieun.hwang@example.com',
    'dohyun.kim@example.com', 'seoa.lee@example.com', 'hyunwoo.park@example.com',
    'yena.choi@example.com', 'seungho.jung@example.com', 'minji.kang@example.com',
    'taejun.yoon@example.com', 'subin.lim@example.com', 'jihoon.han@example.com',
    'seohyun.oh@example.com', 'dongwook.shin@example.com', 'eunji.cho@example.com',
    'junseo.bae@example.com', 'haneul.song@example.com', 'minseo.hwang@example.com',
    'jiwoo.kim@example.com', 'junyoung.lee@example.com', 'seoyoon.park@example.com',
    'mingyu.choi@example.com', 'sua.jung@example.com', 'taehyun.kang@example.com',
    'jiwon.yoon@example.com', 'doyoon.lim@example.com', 'seojin.han@example.com',
    'minseok.oh@example.com', 'yerin.shin@example.com', 'hyunwoo.cho@example.com',
    'seoyeon.bae@example.com', 'jihoon.song@example.com', 'daeun.hwang@example.com',
    'taeyoon.kim@example.com', 'seojun.lee@example.com', 'jiwon.park@example.com',
    'minseo.choi@example.com', 'haneul.jung@example.com'
  ];
  statuses TEXT[] := ARRAY['pending', 'in_progress', 'confirmed', 'rejected', 'issue'];
  stages TEXT[] := ARRAY['stage-1', 'stage-2', 'stage-3', 'stage-4', 'stage-5'];
  i INTEGER;
  job_idx INTEGER;
  status_idx INTEGER;
  stage_idx INTEGER;
  candidate_id UUID;
BEGIN
  FOR i IN 1..50 LOOP
    job_idx := ((i - 1) % array_length(job_post_ids, 1)) + 1;
    status_idx := ((i - 1) % array_length(statuses, 1)) + 1;
    stage_idx := ((i - 1) % array_length(stages, 1)) + 1;
    
    -- 후보자 생성
    INSERT INTO candidates (
      id, job_post_id, name, email, phone, status, current_stage_id, token,
      archived, archive_reason, parsed_data, education, skills, experience,
      created_at, updated_at
    )
    VALUES (
      gen_random_uuid(),
      job_post_ids[job_idx],
      candidate_names[i],
      candidate_emails[i],
      '010-' || LPAD((RANDOM() * 10000)::INT::TEXT, 4, '0') || '-' || LPAD((RANDOM() * 10000)::INT::TEXT, 4, '0'),
      statuses[status_idx],
      stages[stage_idx],
      gen_random_uuid()::TEXT,
      CASE WHEN i > 40 THEN true ELSE false END, -- 마지막 10명은 아카이브
      CASE WHEN i > 40 THEN '테스트용 아카이브 데이터' ELSE NULL END,
      jsonb_build_object(
        'match_score', 60 + (RANDOM() * 40)::INT,
        'skills', ARRAY['JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'PostgreSQL'],
        'experience', ((RANDOM() * 8)::INT + 1) || '년',
        'education', CASE WHEN RANDOM() > 0.3 THEN '학사' WHEN RANDOM() > 0.6 THEN '석사' ELSE '박사' END,
        'summary', '경력 ' || ((RANDOM() * 8)::INT + 1) || '년의 ' || 
                  CASE WHEN RANDOM() > 0.5 THEN '프론트엔드' ELSE '백엔드' END || ' 개발자'
      ),
      CASE WHEN RANDOM() > 0.3 THEN '컴퓨터공학과 학사' WHEN RANDOM() > 0.6 THEN '컴퓨터공학과 석사' ELSE '컴퓨터공학과 박사' END,
      ARRAY['JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'PostgreSQL', 'AWS', 'Docker'],
      ((RANDOM() * 8)::INT + 1) || '년의 소프트웨어 개발 경력',
      NOW() - (INTERVAL '1 day' * ((RANDOM() * 90)::INT + 1)),
      NOW() - (INTERVAL '1 day' * ((RANDOM() * 90)::INT + 1))
    )
    RETURNING id INTO candidate_id;
    
    -- 타임라인 이벤트 생성 (후보자당 2-5개)
    FOR j IN 1..(2 + (RANDOM() * 4)::INT) LOOP
      INSERT INTO timeline_events (candidate_id, type, content, created_by, created_at)
      VALUES (
        candidate_id,
        CASE (j - 1) % 6
          WHEN 0 THEN 'system_log'
          WHEN 1 THEN 'schedule_created'
          WHEN 2 THEN 'schedule_confirmed'
          WHEN 3 THEN 'stage_changed'
          WHEN 4 THEN 'email'
          ELSE 'comment'
        END,
        jsonb_build_object(
          'message', CASE (j - 1) % 6
            WHEN 0 THEN '후보자가 시스템에 등록되었습니다.'
            WHEN 1 THEN '면접 일정이 생성되었습니다.'
            WHEN 2 THEN '면접 일정이 확정되었습니다.'
            WHEN 3 THEN '전형 단계가 변경되었습니다.'
            WHEN 4 THEN '이메일이 전송되었습니다.'
            ELSE '코멘트가 추가되었습니다.'
          END
        ),
        NULL, -- created_by는 실제 users 테이블에 존재하는 사용자 ID를 사용하거나 NULL로 설정
        NOW() - (INTERVAL '1 day' * ((RANDOM() * 30)::INT + j))
      );
    END LOOP;
  END LOOP;
END $$;

-- ============================================
-- 5. 면접 일정 생성 (30개)
-- ============================================

DO $$
DECLARE
  candidate_rec RECORD;
  schedule_id UUID;
  i INTEGER := 0;
  statuses TEXT[] := ARRAY['pending', 'confirmed', 'rejected', 'completed'];
  workflow_statuses TEXT[] := ARRAY['pending_interviewers', 'pending_candidate', 'confirmed', 'cancelled'];
  responses TEXT[] := ARRAY['accepted', 'rejected', 'pending'];
  beverages TEXT[] := ARRAY['coffee', 'tea', 'water', 'juice', 'none'];
  interviewer_ids UUID[] := ARRAY[
    '10000000-0000-0000-0000-000000000004'::UUID,
    '10000000-0000-0000-0000-000000000005'::UUID,
    '10000000-0000-0000-0000-000000000006'::UUID
  ];
BEGIN
  FOR candidate_rec IN 
    SELECT id FROM candidates WHERE archived = false LIMIT 30
  LOOP
    i := i + 1;
    
    INSERT INTO schedules (
      id, candidate_id, stage_id, scheduled_at, duration_minutes, status,
      interviewer_ids, candidate_response, beverage_preference,
      created_at, updated_at
    )
    VALUES (
      gen_random_uuid(),
      candidate_rec.id,
      CASE (i - 1) % 4
        WHEN 0 THEN 'stage-2'
        WHEN 1 THEN 'stage-3'
        WHEN 2 THEN 'stage-4'
        ELSE 'stage-2'
      END,
      NOW() + (INTERVAL '1 day' * ((RANDOM() * 14)::INT + 1)) + (INTERVAL '1 hour' * (10 + (RANDOM() * 6)::INT)),
      CASE (i - 1) % 3 WHEN 0 THEN 30 WHEN 1 THEN 60 ELSE 90 END,
      statuses[((i - 1) % array_length(statuses, 1)) + 1],
      ARRAY[]::UUID[], -- interviewer_ids는 실제 users 테이블에 존재하는 사용자 ID를 사용하세요
      responses[((i - 1) % array_length(responses, 1)) + 1],
      beverages[((i - 1) % array_length(beverages, 1)) + 1],
      NOW() - (INTERVAL '1 day' * ((RANDOM() * 7)::INT + 1)),
      NOW() - (INTERVAL '1 day' * ((RANDOM() * 7)::INT + 1))
    )
    RETURNING id INTO schedule_id;
    
    -- 면접 일정 옵션 생성 (각 일정당 3개)
    FOR j IN 1..3 LOOP
      INSERT INTO schedule_options (
        schedule_id, scheduled_at, status
      )
      VALUES (
        schedule_id,
        (SELECT scheduled_at FROM schedules WHERE id = schedule_id) + (INTERVAL '1 hour' * ((j - 2) * 2)),
        CASE WHEN j = 2 THEN 'selected' ELSE 'pending' END
      );
    END LOOP;
    
    -- 타임라인 이벤트 추가
    INSERT INTO timeline_events (candidate_id, type, content, created_by, created_at)
    VALUES (
      candidate_rec.id,
      'schedule_created',
      jsonb_build_object(
        'message', '면접 일정이 생성되었습니다.',
        'schedule_id', schedule_id
      ),
      NULL, -- created_by는 실제 users 테이블에 존재하는 사용자 ID를 사용하거나 NULL로 설정
      NOW() - (INTERVAL '1 day' * ((RANDOM() * 7)::INT + 1))
    );
  END LOOP;
END $$;

-- ============================================
-- 6. 이메일 생성 (40개)
-- ============================================

DO $$
DECLARE
  candidate_rec RECORD;
  i INTEGER := 0;
  directions TEXT[] := ARRAY['inbound', 'outbound'];
  subjects TEXT[] := ARRAY[
    '면접 일정 안내',
    '서류 전형 결과 안내',
    '면접 준비 사항 안내',
    '최종 합격 안내',
    '불합격 안내',
    '추가 서류 요청',
    '면접 일정 변경 요청',
    '문의사항 답변'
  ];
BEGIN
  FOR candidate_rec IN 
    SELECT id, email FROM candidates WHERE archived = false LIMIT 40
  LOOP
    i := i + 1;
    
    INSERT INTO emails (
      candidate_id, message_id, subject, body, from_email, to_email,
      direction, sent_at, received_at, synced_at, created_at
    )
    VALUES (
      candidate_rec.id,
      'msg_' || gen_random_uuid()::TEXT,
      subjects[((i - 1) % array_length(subjects, 1)) + 1],
      '이메일 본문 내용입니다. ' || (RANDOM() * 1000)::INT || '자 분량의 더미 텍스트입니다.',
      CASE WHEN (i - 1) % 2 = 0 THEN 'recruiter1@vntg.com' ELSE candidate_rec.email END,
      CASE WHEN (i - 1) % 2 = 0 THEN candidate_rec.email ELSE 'recruiter1@vntg.com' END,
      directions[((i - 1) % array_length(directions, 1)) + 1],
      CASE WHEN (i - 1) % 2 = 0 THEN NOW() - (INTERVAL '1 day' * ((RANDOM() * 30)::INT + 1)) ELSE NULL END,
      CASE WHEN (i - 1) % 2 = 1 THEN NOW() - (INTERVAL '1 day' * ((RANDOM() * 30)::INT + 1)) ELSE NULL END,
      NOW() - (INTERVAL '1 day' * ((RANDOM() * 30)::INT + 1)),
      NOW() - (INTERVAL '1 day' * ((RANDOM() * 30)::INT + 1))
    );
    
    -- 타임라인 이벤트 추가
    INSERT INTO timeline_events (candidate_id, type, content, created_by, created_at)
    VALUES (
      candidate_rec.id,
      'email',
      jsonb_build_object(
        'message', '이메일이 ' || directions[((i - 1) % array_length(directions, 1)) + 1] || ' 되었습니다.',
        'subject', subjects[((i - 1) % array_length(subjects, 1)) + 1]
      ),
      NULL, -- created_by는 실제 users 테이블에 존재하는 사용자 ID를 사용하거나 NULL로 설정
      NOW() - (INTERVAL '1 day' * ((RANDOM() * 30)::INT + 1))
    );
  END LOOP;
END $$;

-- ============================================
-- 7. 코멘트 생성 (스킵)
-- ============================================
-- 주의: comments 테이블의 created_by는 NOT NULL 제약 조건이 있어서
-- 실제 users 테이블에 존재하는 사용자 ID가 필요합니다.
-- 기존 users 테이블의 사용자 ID를 사용하여 코멘트를 생성하거나,
-- 이 부분을 수동으로 실행하세요.
-- 
-- 예시:
-- INSERT INTO comments (candidate_id, content, created_by, created_at, updated_at)
-- SELECT 
--   c.id,
--   '테스트 코멘트',
--   (SELECT id FROM users LIMIT 1),
--   NOW(),
--   NOW()
-- FROM candidates c
-- WHERE c.archived = false
-- LIMIT 30;

-- ============================================
-- 8. 평가표 생성 (스킵)
-- ============================================
-- 주의: scorecards 테이블의 interviewer_id는 NOT NULL 제약 조건이 있어서
-- 실제 users 테이블에 존재하는 사용자 ID가 필요합니다.
-- completed 상태의 schedule이 있어야 하며, 실제 users 테이블의 사용자 ID를 사용해야 합니다.

-- ============================================
-- 9. 이력서 파일 생성 (25개)
-- ============================================

DO $$
DECLARE
  candidate_rec RECORD;
  file_types TEXT[] := ARRAY['pdf', 'doc', 'docx'];
  parsing_statuses TEXT[] := ARRAY['pending', 'processing', 'completed', 'failed'];
  i INTEGER := 0;
BEGIN
  FOR candidate_rec IN 
    SELECT id FROM candidates WHERE archived = false LIMIT 25
  LOOP
    i := i + 1;
    
    INSERT INTO resume_files (
      candidate_id, file_url, file_type, parsing_status, parsed_data,
      created_at, updated_at
    )
    VALUES (
      candidate_rec.id,
      'https://storage.supabase.co/resumes/' || gen_random_uuid()::TEXT || '.' || file_types[((i - 1) % array_length(file_types, 1)) + 1],
      file_types[((i - 1) % array_length(file_types, 1)) + 1],
      parsing_statuses[((i - 1) % array_length(parsing_statuses, 1)) + 1],
      CASE WHEN (i - 1) % 4 = 2 THEN
        jsonb_build_object(
          'name', '이력서 파싱 결과',
          'education', '컴퓨터공학과 학사',
          'experience', '5년',
          'skills', ARRAY['JavaScript', 'React', 'Node.js']
        )
      ELSE NULL END,
      NOW() - (INTERVAL '1 day' * ((RANDOM() * 30)::INT + 1)),
      NOW() - (INTERVAL '1 day' * ((RANDOM() * 30)::INT + 1))
    );
  END LOOP;
END $$;

-- ============================================
-- 10. 지원서 제출 생성 (35개)
-- ============================================

DO $$
DECLARE
  job_post_rec RECORD;
  statuses TEXT[] := ARRAY['pending', 'reviewed', 'rejected'];
  i INTEGER := 0;
BEGIN
  FOR job_post_rec IN 
    SELECT id FROM job_posts LIMIT 7
  LOOP
    -- 각 채용 공고당 5개의 지원서
    FOR j IN 1..5 LOOP
      i := i + 1;
      
      INSERT INTO application_submissions (
        job_post_id, candidate_id, submitted_data, status,
        created_at, updated_at
      )
      VALUES (
        job_post_rec.id,
        (SELECT id FROM candidates WHERE job_post_id = job_post_rec.id LIMIT 1 OFFSET (j - 1)),
        jsonb_build_object(
          'name', '지원자 ' || i,
          'email', 'applicant' || i || '@example.com',
          'phone', '010-1234-567' || j,
          'cover_letter', '지원 동기 및 자기소개서 내용입니다.',
          'portfolio_url', 'https://portfolio.example.com/' || i
        ),
        statuses[((i - 1) % array_length(statuses, 1)) + 1],
        NOW() - (INTERVAL '1 day' * ((RANDOM() * 60)::INT + 1)),
        NOW() - (INTERVAL '1 day' * ((RANDOM() * 60)::INT + 1))
      );
    END LOOP;
  END LOOP;
END $$;

-- ============================================
-- 11. 전형별 평가 생성 (스킵)
-- ============================================
-- 주의: stage_evaluations 테이블의 evaluator_id는 NOT NULL 제약 조건이 있어서
-- 실제 users 테이블에 존재하는 사용자 ID가 필요합니다.

-- ============================================
-- 12. 아카이브 관련 타임라인 이벤트 생성
-- ============================================

INSERT INTO timeline_events (candidate_id, type, content, created_by, created_at)
SELECT 
  id,
  'archive',
  jsonb_build_object(
    'message', '후보자가 아카이브되었습니다.',
    'reason', archive_reason
  ),
  NULL, -- created_by는 실제 users 테이블에 존재하는 사용자 ID를 사용하거나 NULL로 설정
  updated_at
FROM candidates
WHERE archived = true;

-- ============================================
-- 13. 추가 타임라인 이벤트 (approval 타입)
-- ============================================

DO $$
DECLARE
  candidate_rec RECORD;
  i INTEGER := 0;
BEGIN
  FOR candidate_rec IN 
    SELECT id FROM candidates WHERE archived = false AND status = 'confirmed' LIMIT 10
  LOOP
    i := i + 1;
    
    INSERT INTO timeline_events (candidate_id, type, content, created_by, created_at)
    VALUES (
      candidate_rec.id,
      'approval',
      jsonb_build_object(
        'message', '최종 승인이 완료되었습니다.',
        'approved_by', '10000000-0000-0000-0000-000000000001'
      ),
      NULL, -- created_by는 실제 users 테이블에 존재하는 사용자 ID를 사용하거나 NULL로 설정
      NOW() - (INTERVAL '1 day' * ((RANDOM() * 10)::INT + 1))
    );
  END LOOP;
END $$;

-- ============================================
-- 생성된 데이터 확인
-- ============================================

SELECT 
  'organizations' as table_name, COUNT(*) as count FROM organizations
UNION ALL
SELECT 'users', COUNT(*) FROM users
UNION ALL
SELECT 'processes', COUNT(*) FROM processes
UNION ALL
SELECT 'job_posts', COUNT(*) FROM job_posts
UNION ALL
SELECT 'candidates', COUNT(*) FROM candidates
UNION ALL
SELECT 'schedules', COUNT(*) FROM schedules
UNION ALL
SELECT 'schedule_options', COUNT(*) FROM schedule_options
UNION ALL
SELECT 'timeline_events', COUNT(*) FROM timeline_events
UNION ALL
SELECT 'emails', COUNT(*) FROM emails
UNION ALL
SELECT 'comments', COUNT(*) FROM comments
UNION ALL
SELECT 'scorecards', COUNT(*) FROM scorecards
UNION ALL
SELECT 'resume_files', COUNT(*) FROM resume_files
UNION ALL
SELECT 'application_submissions', COUNT(*) FROM application_submissions
UNION ALL
SELECT 'stage_evaluations', COUNT(*) FROM stage_evaluations
ORDER BY table_name;
