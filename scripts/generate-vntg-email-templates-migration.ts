/**
 * constants/vntg-builtin-email-templates.ts → supabase/migrations SQL 생성
 * 실행: npx tsx scripts/generate-vntg-email-templates-migration.ts
 */
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { VNTG_BUILTIN_EMAIL_TEMPLATES } from '../constants/vntg-builtin-email-templates';

function escLiteral(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

const lines: string[] = [];
lines.push(`-- VNTG 기본 이메일 템플릿 10종 (UI에서 생성한 것과 동일한 행)
-- 조직마다 admin/recruiter 사용자 1명을 created_by로 사용합니다.
-- 이미 동일 이름 템플릿이 있으면 삽입하지 않습니다.`);

lines.push(`
INSERT INTO public.email_templates (organization_id, name, subject, body, created_by)
SELECT
  o.id,
  v.name,
  v.subject,
  v.body,
  u.id
FROM public.organizations o
INNER JOIN LATERAL (
  SELECT id
  FROM public.users
  WHERE organization_id = o.id
    AND role IN ('admin', 'recruiter')
  ORDER BY created_at ASC NULLS LAST
  LIMIT 1
) u ON true
CROSS JOIN (
  VALUES`);

const valueRows = VNTG_BUILTIN_EMAIL_TEMPLATES.map((t, i) => {
  const tag = `vntg_email_body_${i}`;
  const nameLit = escLiteral(t.name);
  const subLit = escLiteral(t.subject);
  return `    (${nameLit}, ${subLit}, $${tag}$\n${t.body}$${tag}$)`;
});

lines.push(valueRows.join(',\n'));
lines.push(`) AS v(name, subject, body)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.email_templates et
  WHERE et.organization_id = o.id
    AND et.name = v.name
);
`);

const out = resolve(process.cwd(), 'supabase/migrations/20260409120000_seed_vntg_default_email_templates.sql');
writeFileSync(out, lines.join('\n'), 'utf8');
console.log('Wrote', out);
