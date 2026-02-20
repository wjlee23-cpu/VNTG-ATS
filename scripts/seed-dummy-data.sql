-- 더미 데이터 생성 SQL 스크립트
-- Supabase 대시보드 > SQL Editor에서 실행하세요.

-- 기존 데이터 삭제 (선택사항 - 주석 해제하여 사용)
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
ON CONFLICT DO NOTHING
RETURNING id;

-- 조직 ID 가져오기 (변수 대신 서브쿼리 사용)
DO $$
DECLARE
  org_id UUID;
  process_id UUID;
  job_post_ids UUID[];
  candidate_ids UUID[];
  schedule_ids UUID[];
  i INTEGER;
  j INTEGER;
BEGIN
  -- 조직 ID 가져오기 또는 생성
  SELECT id INTO org_id FROM organizations WHERE name = 'VNTG Tech' LIMIT 1;
  
  IF org_id IS NULL THEN
    INSERT INTO organizations (name) VALUES ('VNTG Tech') RETURNING id INTO org_id;
  END IF;

  RAISE NOTICE '조직 ID: %', org_id;

  -- 2. 프로세스 생성
  INSERT INTO processes (organization_id, name, stages)
  VALUES (
    org_id,
    '기본 채용 프로세스',
    '[
      {"id": "stage-1", "name": "서류 전형", "order": 1, "interviewers": []},
      {"id": "stage-2", "name": "1차 면접", "order": 2, "interviewers": []},
      {"id": "stage-3", "name": "2차 면접", "order": 3, "interviewers": []},
      {"id": "stage-4", "name": "최종 면접", "order": 4, "interviewers": []},
      {"id": "stage-5", "name": "최종 합격", "order": 5, "interviewers": []}
    ]'::jsonb
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO process_id;

  IF process_id IS NULL THEN
    SELECT id INTO process_id FROM processes WHERE organization_id = org_id AND name = '기본 채용 프로세스' LIMIT 1;
  END IF;

  RAISE NOTICE '프로세스 ID: %', process_id;

  -- 3. 채용 공고 생성 (8개)
  INSERT INTO job_posts (organization_id, title, description, process_id)
  VALUES
    (org_id, 'Senior Product Designer', 'Senior Product Designer 포지션에 대한 상세 설명입니다.

주요 업무:
- 관련 업무 수행
- 팀과의 협업
- 프로젝트 관리

자격 요건:
- 관련 경력 3년 이상
- 협업 능력
- 문제 해결 능력', process_id),
    (org_id, 'Product Manager', 'Product Manager 포지션에 대한 상세 설명입니다.

주요 업무:
- 제품 기획 및 관리
- 팀과의 협업
- 데이터 분석

자격 요건:
- 관련 경력 5년 이상
- 커뮤니케이션 능력
- 전략적 사고', process_id),
    (org_id, 'UX Researcher', 'UX Researcher 포지션에 대한 상세 설명입니다.

주요 업무:
- 사용자 리서치 수행
- 데이터 분석 및 인사이트 도출
- 디자인 팀과의 협업

자격 요건:
- 관련 경력 2년 이상
- 리서치 방법론 이해
- 분석 능력', process_id),
    (org_id, 'Frontend Developer', 'Frontend Developer 포지션에 대한 상세 설명입니다.

주요 업무:
- React, Next.js를 활용한 프론트엔드 개발
- UI/UX 구현
- 성능 최적화

자격 요건:
- React, TypeScript 경험 필수
- 협업 능력
- 문제 해결 능력', process_id),
    (org_id, 'Backend Developer', 'Backend Developer 포지션에 대한 상세 설명입니다.

주요 업무:
- API 개발 및 설계
- 데이터베이스 설계
- 시스템 아키텍처 설계

자격 요건:
- Node.js, PostgreSQL 경험 필수
- RESTful API 설계 경험
- 보안 이해', process_id),
    (org_id, 'Full Stack Developer', 'Full Stack Developer 포지션에 대한 상세 설명입니다.

주요 업무:
- 프론트엔드 및 백엔드 개발
- 전체 시스템 설계
- 팀과의 협업

자격 요건:
- 풀스택 개발 경험 3년 이상
- 다양한 기술 스택 이해
- 문제 해결 능력', process_id),
    (org_id, 'Data Engineer', 'Data Engineer 포지션에 대한 상세 설명입니다.

주요 업무:
- 데이터 파이프라인 구축
- 데이터 분석 인프라 구축
- 데이터 품질 관리

자격 요건:
- Python, SQL 경험 필수
- 빅데이터 기술 이해
- 분석 능력', process_id),
    (org_id, 'DevOps Engineer', 'DevOps Engineer 포지션에 대한 상세 설명입니다.

주요 업무:
- CI/CD 파이프라인 구축
- 인프라 관리 및 모니터링
- 자동화 스크립트 작성

자격 요건:
- Docker, Kubernetes 경험
- 클라우드 인프라 이해
- 자동화 경험', process_id)
  ON CONFLICT DO NOTHING
  RETURNING id;

  -- 채용 공고 ID 배열에 저장
  SELECT ARRAY_AGG(id) INTO job_post_ids FROM job_posts WHERE organization_id = org_id;

  RAISE NOTICE '채용 공고 %개 생성 완료', array_length(job_post_ids, 1);

  -- 4. 후보자 생성 (30명)
  FOR i IN 1..30 LOOP
    INSERT INTO candidates (
      job_post_id,
      name,
      email,
      phone,
      status,
      current_stage_id,
      token,
      parsed_data,
      created_at
    )
    VALUES (
      job_post_ids[((i - 1) % array_length(job_post_ids, 1)) + 1],
      CASE (i - 1) % 20
        WHEN 0 THEN 'Sarah Kim'
        WHEN 1 THEN 'James Lee'
        WHEN 2 THEN 'Emma Park'
        WHEN 3 THEN 'Michael Choi'
        WHEN 4 THEN 'Lisa Jung'
        WHEN 5 THEN 'David Kim'
        WHEN 6 THEN 'Sophia Park'
        WHEN 7 THEN 'Daniel Lee'
        WHEN 8 THEN 'Olivia Kim'
        WHEN 9 THEN 'Ryan Park'
        WHEN 10 THEN 'Grace Lee'
        WHEN 11 THEN 'Kevin Choi'
        WHEN 12 THEN 'Amy Yoon'
        WHEN 13 THEN 'Tom Kim'
        WHEN 14 THEN 'Jessica Park'
        WHEN 15 THEN 'Chris Lee'
        WHEN 16 THEN 'Maria Kim'
        WHEN 17 THEN 'John Park'
        WHEN 18 THEN 'Emily Choi'
        ELSE 'Alex Lee'
      END,
      'candidate' || i || '@example.com',
      '010-' || LPAD((RANDOM() * 10000)::INT::TEXT, 4, '0') || '-' || LPAD((RANDOM() * 10000)::INT::TEXT, 4, '0'),
      CASE (i - 1) % 5
        WHEN 0 THEN 'pending'
        WHEN 1 THEN 'in_progress'
        WHEN 2 THEN 'confirmed'
        WHEN 3 THEN 'rejected'
        ELSE 'issue'
      END,
      CASE (i - 1) / 6
        WHEN 0 THEN 'stage-1'
        WHEN 1 THEN 'stage-2'
        WHEN 2 THEN 'stage-3'
        WHEN 3 THEN 'stage-4'
        ELSE 'stage-5'
      END,
      gen_random_uuid(),
      jsonb_build_object(
        'match_score', 70 + (RANDOM() * 30)::INT,
        'skills', ARRAY['JavaScript', 'TypeScript', 'React', 'Node.js'][1:(1 + (RANDOM() * 3)::INT)],
        'experience', ((RANDOM() * 5)::INT + 2) || '년',
        'education', CASE WHEN RANDOM() > 0.5 THEN '학사' ELSE '석사' END
      ),
      NOW() - (INTERVAL '1 day' * (30 - ((i - 1) % 30)))
    )
    RETURNING id INTO candidate_ids[i];
  END LOOP;

  RAISE NOTICE '후보자 30명 생성 완료';

  -- 5. 면접 일정 생성 (15개)
  FOR i IN 1..15 LOOP
    INSERT INTO schedules (
      candidate_id,
      stage_id,
      scheduled_at,
      duration_minutes,
      status,
      interviewer_ids,
      candidate_response,
      beverage_preference
    )
    VALUES (
      candidate_ids[((i - 1) % 30) + 1],
      CASE (i - 1) % 3
        WHEN 0 THEN 'stage-2'
        WHEN 1 THEN 'stage-3'
        ELSE 'stage-4'
      END,
      NOW() + (INTERVAL '1 day' * ((RANDOM() * 14)::INT + 1)) + (INTERVAL '1 hour' * (10 + (RANDOM() * 6)::INT)),
      CASE (i - 1) % 3
        WHEN 0 THEN 30
        WHEN 1 THEN 60
        ELSE 90
      END,
      CASE (i - 1) % 4
        WHEN 0 THEN 'pending'
        WHEN 1 THEN 'confirmed'
        WHEN 2 THEN 'rejected'
        ELSE 'completed'
      END,
      ARRAY[]::UUID[],
      CASE (i - 1) % 3
        WHEN 0 THEN 'accepted'
        WHEN 1 THEN 'rejected'
        ELSE 'pending'
      END,
      CASE (i - 1) % 5
        WHEN 0 THEN 'coffee'
        WHEN 1 THEN 'tea'
        WHEN 2 THEN 'water'
        WHEN 3 THEN 'juice'
        ELSE 'none'
      END
    )
    RETURNING id INTO schedule_ids[i];
  END LOOP;

  RAISE NOTICE '면접 일정 15개 생성 완료';

  -- 6. 면접 일정 옵션 생성 (각 일정당 3개)
  FOR i IN 1..15 LOOP
    FOR j IN 1..3 LOOP
      INSERT INTO schedule_options (
        schedule_id,
        scheduled_at,
        status
      )
      VALUES (
        schedule_ids[i],
        (SELECT scheduled_at FROM schedules WHERE id = schedule_ids[i]) + (INTERVAL '1 hour' * ((j - 2) * 2)),
        CASE WHEN j = 2 THEN 'selected' ELSE 'pending' END
      );
    END LOOP;
  END LOOP;

  RAISE NOTICE '면접 일정 옵션 생성 완료';

  -- 7. 타임라인 이벤트 생성 (후보자당 3-6개)
  FOR i IN 1..30 LOOP
    FOR j IN 1..(3 + (RANDOM() * 4)::INT) LOOP
      INSERT INTO timeline_events (
        candidate_id,
        type,
        content,
        created_by,
        created_at
      )
      VALUES (
        candidate_ids[i],
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
        NOW() - (INTERVAL '1 day' * (30 - (i * 2 + j)))
      );
    END LOOP;
  END LOOP;

  RAISE NOTICE '타임라인 이벤트 생성 완료';

  RAISE NOTICE '✨ 더미 데이터 생성 완료!';
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
