-- ============================================
-- job_posts 테이블 확장: 커스텀 프로세스 단계 (드래그 앤 드롭)
-- ============================================

-- job_posts에 custom_stages 추가 (커스텀 단계 정보 객체 배열)
-- JSONB 형식: [{"id": "stage-1", "name": "New Application", "order": 1, "assignees": ["user-id"]}, ...]
-- NULL인 경우 기본 8단계 모두 활성화로 간주 (하위 호환성)
ALTER TABLE job_posts
ADD COLUMN IF NOT EXISTS custom_stages JSONB;

-- 인덱스 추가 (JSONB 쿼리 성능 향상)
CREATE INDEX IF NOT EXISTS idx_job_posts_custom_stages ON job_posts USING GIN (custom_stages);

-- 코멘트 추가
COMMENT ON COLUMN job_posts.custom_stages IS '커스텀 프로세스 단계 배열. 각 단계는 id, name, order, assignees를 포함. NULL이면 기본 8단계 모두 활성화 (기본값)';

-- 기존 enabled_stages 데이터를 custom_stages 형식으로 마이그레이션 (선택사항)
-- enabled_stages가 있고 custom_stages가 NULL인 경우에만 변환
DO $$
DECLARE
  job_record RECORD;
  enabled_stages_array TEXT[];
  process_stages JSONB;
  custom_stages_array JSONB := '[]'::jsonb;
  stage_item JSONB;
  stage_order INTEGER := 1;
BEGIN
  FOR job_record IN 
    SELECT jp.id, jp.enabled_stages, p.stages
    FROM job_posts jp
    LEFT JOIN processes p ON jp.process_id = p.id
    WHERE jp.enabled_stages IS NOT NULL 
      AND jp.custom_stages IS NULL
  LOOP
    -- enabled_stages를 배열로 변환
    IF jsonb_typeof(job_record.enabled_stages) = 'array' THEN
      enabled_stages_array := ARRAY(SELECT jsonb_array_elements_text(job_record.enabled_stages));
    ELSE
      CONTINUE;
    END IF;

    -- process의 stages에서 정보 가져오기
    IF job_record.stages IS NOT NULL AND jsonb_typeof(job_record.stages) = 'array' THEN
      process_stages := job_record.stages;
    ELSE
      -- process stages가 없으면 기본 매핑 사용
      process_stages := '[
        {"id": "stage-1", "name": "New Application"},
        {"id": "stage-2", "name": "HR Screening"},
        {"id": "stage-3", "name": "Application Review"},
        {"id": "stage-4", "name": "Competency Assessment"},
        {"id": "stage-5", "name": "Technical Test"},
        {"id": "stage-6", "name": "1st Interview"},
        {"id": "stage-7", "name": "Reference Check"},
        {"id": "stage-8", "name": "2nd Interview"}
      ]'::jsonb;
    END IF;

    -- enabled_stages에 포함된 단계만 custom_stages로 변환
    custom_stages_array := '[]'::jsonb;
    stage_order := 1;
    
    FOR stage_item IN SELECT * FROM jsonb_array_elements(process_stages)
    LOOP
      IF (stage_item->>'id') = ANY(enabled_stages_array) THEN
        custom_stages_array := custom_stages_array || jsonb_build_object(
          'id', stage_item->>'id',
          'name', stage_item->>'name',
          'order', stage_order,
          'assignees', COALESCE(stage_item->'interviewers', '[]'::jsonb)
        );
        stage_order := stage_order + 1;
      END IF;
    END LOOP;

    -- custom_stages 업데이트
    UPDATE job_posts
    SET custom_stages = custom_stages_array
    WHERE id = job_record.id;
  END LOOP;
END $$;
