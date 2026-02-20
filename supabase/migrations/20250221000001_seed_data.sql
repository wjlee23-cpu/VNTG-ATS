-- 더미 데이터 생성 SQL 스크립트
-- Supabase 대시보드 > SQL Editor에서 실행하세요.

-- 기존 데이터 삭제 (선택사항)
-- DELETE FROM timeline_events;
-- DELETE FROM schedule_options;
-- DELETE FROM schedules;
-- DELETE FROM candidates;
-- DELETE FROM job_posts;
-- DELETE FROM processes;
-- DELETE FROM users;
-- DELETE FROM organizations;

-- 1. 조직 생성
INSERT INTO organizations (name)
VALUES ('VNTG Tech')
ON CONFLICT DO NOTHING;

-- 2. 프로세스 생성
INSERT INTO processes (organization_id, name, stages)
SELECT 
  (SELECT id FROM organizations WHERE name = 'VNTG Tech' LIMIT 1),
  '기본 채용 프로세스',
  '[
    {"id": "stage-1", "name": "서류 전형", "order": 1, "interviewers": []},
    {"id": "stage-2", "name": "1차 면접", "order": 2, "interviewers": []},
    {"id": "stage-3", "name": "2차 면접", "order": 3, "interviewers": []},
    {"id": "stage-4", "name": "최종 면접", "order": 4, "interviewers": []},
    {"id": "stage-5", "name": "최종 합격", "order": 5, "interviewers": []}
  ]'::jsonb
ON CONFLICT DO NOTHING;

-- 3. 채용 공고 생성 (8개)
INSERT INTO job_posts (organization_id, title, description, process_id)
SELECT 
  (SELECT id FROM organizations WHERE name = 'VNTG Tech' LIMIT 1),
  title,
  description,
  (SELECT id FROM processes WHERE name = '기본 채용 프로세스' LIMIT 1)
FROM (VALUES
  ('Senior Product Designer', 'Senior Product Designer 포지션에 대한 상세 설명입니다.'),
  ('Product Manager', 'Product Manager 포지션에 대한 상세 설명입니다.'),
  ('UX Researcher', 'UX Researcher 포지션에 대한 상세 설명입니다.'),
  ('Frontend Developer', 'Frontend Developer 포지션에 대한 상세 설명입니다.'),
  ('Backend Developer', 'Backend Developer 포지션에 대한 상세 설명입니다.'),
  ('Full Stack Developer', 'Full Stack Developer 포지션에 대한 상세 설명입니다.'),
  ('Data Engineer', 'Data Engineer 포지션에 대한 상세 설명입니다.'),
  ('DevOps Engineer', 'DevOps Engineer 포지션에 대한 상세 설명입니다.')
) AS t(title, description)
ON CONFLICT DO NOTHING;

-- 4. 후보자 생성 (30명) - 간단한 버전
DO $$
DECLARE
  org_id UUID;
  job_post_ids UUID[];
  i INTEGER;
  job_idx INTEGER;
BEGIN
  SELECT id INTO org_id FROM organizations WHERE name = 'VNTG Tech' LIMIT 1;
  SELECT ARRAY_AGG(id) INTO job_post_ids FROM job_posts WHERE organization_id = org_id;
  
  FOR i IN 1..30 LOOP
    job_idx := ((i - 1) % array_length(job_post_ids, 1)) + 1;
    
    INSERT INTO candidates (job_post_id, name, email, phone, status, current_stage_id, token, parsed_data)
    VALUES (
      job_post_ids[job_idx],
      CASE (i - 1) % 20
        WHEN 0 THEN 'Sarah Kim' WHEN 1 THEN 'James Lee' WHEN 2 THEN 'Emma Park'
        WHEN 3 THEN 'Michael Choi' WHEN 4 THEN 'Lisa Jung' WHEN 5 THEN 'David Kim'
        WHEN 6 THEN 'Sophia Park' WHEN 7 THEN 'Daniel Lee' WHEN 8 THEN 'Olivia Kim'
        WHEN 9 THEN 'Ryan Park' WHEN 10 THEN 'Grace Lee' WHEN 11 THEN 'Kevin Choi'
        WHEN 12 THEN 'Amy Yoon' WHEN 13 THEN 'Tom Kim' WHEN 14 THEN 'Jessica Park'
        WHEN 15 THEN 'Chris Lee' WHEN 16 THEN 'Maria Kim' WHEN 17 THEN 'John Park'
        WHEN 18 THEN 'Emily Choi' ELSE 'Alex Lee'
      END,
      'candidate' || i || '@example.com',
      '010-' || LPAD((RANDOM() * 10000)::INT::TEXT, 4, '0') || '-' || LPAD((RANDOM() * 10000)::INT::TEXT, 4, '0'),
      CASE (i - 1) % 5
        WHEN 0 THEN 'pending' WHEN 1 THEN 'in_progress' WHEN 2 THEN 'confirmed'
        WHEN 3 THEN 'rejected' ELSE 'issue'
      END,
      CASE (i - 1) / 6
        WHEN 0 THEN 'stage-1' WHEN 1 THEN 'stage-2' WHEN 2 THEN 'stage-3'
        WHEN 3 THEN 'stage-4' ELSE 'stage-5'
      END,
      gen_random_uuid()::TEXT,
      jsonb_build_object(
        'match_score', 70 + (RANDOM() * 30)::INT,
        'skills', ARRAY['JavaScript', 'TypeScript', 'React', 'Node.js'],
        'experience', ((RANDOM() * 5)::INT + 2) || '년',
        'education', CASE WHEN RANDOM() > 0.5 THEN '학사' ELSE '석사' END
      )
    ) ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- 5. 면접 일정 생성 (15개)
DO $$
DECLARE
  candidate_ids UUID[];
  i INTEGER;
  candidate_idx INTEGER;
BEGIN
  SELECT ARRAY_AGG(id) INTO candidate_ids FROM candidates LIMIT 30;
  
  FOR i IN 1..15 LOOP
    candidate_idx := ((i - 1) % array_length(candidate_ids, 1)) + 1;
    
    INSERT INTO schedules (candidate_id, stage_id, scheduled_at, duration_minutes, status, interviewer_ids, candidate_response, beverage_preference)
    VALUES (
      candidate_ids[candidate_idx],
      CASE (i - 1) % 3 WHEN 0 THEN 'stage-2' WHEN 1 THEN 'stage-3' ELSE 'stage-4' END,
      NOW() + (INTERVAL '1 day' * ((RANDOM() * 14)::INT + 1)) + (INTERVAL '1 hour' * (10 + (RANDOM() * 6)::INT)),
      CASE (i - 1) % 3 WHEN 0 THEN 30 WHEN 1 THEN 60 ELSE 90 END,
      CASE (i - 1) % 4 WHEN 0 THEN 'pending' WHEN 1 THEN 'confirmed' WHEN 2 THEN 'rejected' ELSE 'completed' END,
      ARRAY[]::UUID[],
      CASE (i - 1) % 3 WHEN 0 THEN 'accepted' WHEN 1 THEN 'rejected' ELSE 'pending' END,
      CASE (i - 1) % 5 WHEN 0 THEN 'coffee' WHEN 1 THEN 'tea' WHEN 2 THEN 'water' WHEN 3 THEN 'juice' ELSE 'none' END
    ) ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- 6. 면접 일정 옵션 생성 (각 일정당 3개)
DO $$
DECLARE
  schedule_rec RECORD;
  j INTEGER;
BEGIN
  FOR schedule_rec IN SELECT id, scheduled_at FROM schedules LIMIT 15 LOOP
    FOR j IN 1..3 LOOP
      INSERT INTO schedule_options (schedule_id, scheduled_at, status)
      VALUES (
        schedule_rec.id,
        schedule_rec.scheduled_at + (INTERVAL '1 hour' * ((j - 2) * 2)),
        CASE WHEN j = 2 THEN 'selected' ELSE 'pending' END
      ) ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- 7. 타임라인 이벤트 생성 (후보자당 3-6개)
DO $$
DECLARE
  candidate_rec RECORD;
  j INTEGER;
  event_count INTEGER;
BEGIN
  FOR candidate_rec IN SELECT id FROM candidates LIMIT 30 LOOP
    event_count := 3 + (RANDOM() * 4)::INT;
    FOR j IN 1..event_count LOOP
      INSERT INTO timeline_events (candidate_id, type, content, created_by, created_at)
      VALUES (
        candidate_rec.id,
        CASE (j - 1) % 4
          WHEN 0 THEN 'system_log'
          WHEN 1 THEN 'schedule_created'
          WHEN 2 THEN 'schedule_confirmed'
          ELSE 'stage_changed'
        END,
        jsonb_build_object(
          'message', CASE (j - 1) % 4
            WHEN 0 THEN '시스템 로그 이벤트'
            WHEN 1 THEN '면접 일정이 생성되었습니다.'
            WHEN 2 THEN '면접 일정이 확정되었습니다.'
            ELSE '단계가 변경되었습니다.'
          END
        ),
        NULL,
        NOW() - (INTERVAL '1 day' * (30 - (j * 2)))
      ) ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- 생성된 데이터 확인
SELECT 
  (SELECT COUNT(*) FROM organizations) as organizations,
  (SELECT COUNT(*) FROM processes) as processes,
  (SELECT COUNT(*) FROM job_posts) as job_posts,
  (SELECT COUNT(*) FROM candidates) as candidates,
  (SELECT COUNT(*) FROM schedules) as schedules,
  (SELECT COUNT(*) FROM schedule_options) as schedule_options,
  (SELECT COUNT(*) FROM timeline_events) as timeline_events;
