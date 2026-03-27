-- ============================================
-- 이메일 템플릿 테이블 추가 (조직 공용)
-- ============================================
-- 목적:
-- - 조직 내에서 재사용 가능한 이메일 템플릿을 저장합니다.
-- - Candidate Detail 이메일 발송 모달에서 선택하여 제목/본문에 즉시 적용합니다.

CREATE TABLE IF NOT EXISTS public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_templates_organization_id
  ON public.email_templates (organization_id);

CREATE INDEX IF NOT EXISTS idx_email_templates_updated_at
  ON public.email_templates (updated_at DESC);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_templates_select_same_org" ON public.email_templates;
CREATE POLICY "email_templates_select_same_org"
  ON public.email_templates
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id
      FROM public.users
      WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "email_templates_insert_admin_recruiter" ON public.email_templates;
CREATE POLICY "email_templates_insert_admin_recruiter"
  ON public.email_templates
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.organization_id = email_templates.organization_id
        AND u.role IN ('admin', 'recruiter')
    )
  );

DROP POLICY IF EXISTS "email_templates_update_admin_recruiter" ON public.email_templates;
CREATE POLICY "email_templates_update_admin_recruiter"
  ON public.email_templates
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.organization_id = email_templates.organization_id
        AND u.role IN ('admin', 'recruiter')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.organization_id = email_templates.organization_id
        AND u.role IN ('admin', 'recruiter')
    )
  );

DROP POLICY IF EXISTS "email_templates_delete_admin_recruiter" ON public.email_templates;
CREATE POLICY "email_templates_delete_admin_recruiter"
  ON public.email_templates
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.organization_id = email_templates.organization_id
        AND u.role IN ('admin', 'recruiter')
    )
  );
