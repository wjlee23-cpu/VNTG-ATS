-- 기존 더미 데이터의 organization_id를 개발 모드에서 사용하는 ID로 업데이트
-- 먼저 organizations에 개발 모드용 ID가 없으면 생성
INSERT INTO organizations (id, name) 
VALUES ('00000000-0000-0000-0000-000000000000', 'VNTG 테크')
ON CONFLICT (id) DO NOTHING;

-- processes와 job_posts의 organization_id 업데이트
UPDATE processes SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id = '00000000-0000-0000-0000-000000000001';
UPDATE job_posts SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id = '00000000-0000-0000-0000-000000000001';
