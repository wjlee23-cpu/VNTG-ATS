-- ============================================
-- Storage Bucket RLS 정책 설정
-- resumes bucket에 대한 접근 권한 설정
-- ============================================
-- 
-- 이 마이그레이션은 Storage bucket의 RLS 정책을 설정합니다.
-- 리크루터(recruiter) 이상 권한을 가진 사용자만 이력서 파일에 접근할 수 있습니다.
--
-- 주의: 이 SQL을 실행하기 전에 Storage bucket 'resumes'가 생성되어 있어야 합니다.
-- 프로덕션 환경에서는 scripts/setup-storage-bucket.ts를 먼저 실행하세요.
-- 로컬 환경에서는 supabase/config.toml에 bucket 설정이 있어야 합니다.
-- ============================================

-- Storage objects 테이블에 RLS 활성화 (이미 활성화되어 있을 수 있음)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 기존 정책이 있다면 삭제 (재실행 시 충돌 방지)
DROP POLICY IF EXISTS "Recruiters can view resumes" ON storage.objects;
DROP POLICY IF EXISTS "Recruiters can upload resumes" ON storage.objects;
DROP POLICY IF EXISTS "Recruiters can update resumes" ON storage.objects;
DROP POLICY IF EXISTS "Recruiters can delete resumes" ON storage.objects;

-- SELECT 정책: 리크루터 이상 권한만 조회 가능
CREATE POLICY "Recruiters can view resumes" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'resumes' AND
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'recruiter')
    )
  );

-- INSERT 정책: 리크루터 이상 권한만 업로드 가능
CREATE POLICY "Recruiters can upload resumes" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'resumes' AND
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'recruiter')
    )
  );

-- UPDATE 정책: 리크루터 이상 권한만 수정 가능
CREATE POLICY "Recruiters can update resumes" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'resumes' AND
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'recruiter')
    )
  )
  WITH CHECK (
    bucket_id = 'resumes' AND
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'recruiter')
    )
  );

-- DELETE 정책: 리크루터 이상 권한만 삭제 가능
CREATE POLICY "Recruiters can delete resumes" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'resumes' AND
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'recruiter')
    )
  );
