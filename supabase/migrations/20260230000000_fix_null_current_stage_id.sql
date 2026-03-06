-- ============================================
-- current_stage_id null 값 처리 마이그레이션
-- ============================================
-- 기존에 current_stage_id가 null인 후보자들을 'stage-1' (New Application)로 설정
-- 이 마이그레이션은 데이터 일관성을 보장하기 위해 실행됩니다.

-- current_stage_id가 null이거나 빈 문자열인 모든 후보자를 'stage-1'로 업데이트
UPDATE candidates
SET current_stage_id = 'stage-1'
WHERE current_stage_id IS NULL 
   OR current_stage_id = '';

-- 업데이트된 레코드 수 확인 (주석 처리 - 필요시 주석 해제)
-- SELECT COUNT(*) as updated_count 
-- FROM candidates 
-- WHERE current_stage_id = 'stage-1' 
--   AND (updated_at >= NOW() - INTERVAL '1 second');

-- 코멘트 추가
COMMENT ON COLUMN candidates.current_stage_id IS '현재 전형 단계 ID. 기본값은 stage-1 (New Application)입니다.';
