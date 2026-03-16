-- resume_files 테이블에 original_name 컬럼 추가
-- 원본 파일명을 저장하여 UI에서 표시할 수 있도록 함

ALTER TABLE resume_files 
ADD COLUMN IF NOT EXISTS original_name TEXT;

-- 기존 데이터에 대한 설명 주석
COMMENT ON COLUMN resume_files.original_name IS '업로드된 원본 파일명 (한글 포함 가능)';
