'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/api/utils/auth';
import { withErrorHandling } from '@/api/utils/errors';

export interface EmailTemplateItem {
  id: string;
  name: string;
  subject: string;
  body: string;
  created_at: string;
  updated_at: string;
  created_by: string;
}

/**
 * 조직 공용 이메일 템플릿 목록을 조회합니다.
 */
export async function getEmailTemplates() {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const isAdmin = user.role === 'admin';
    const supabase = isAdmin ? createServiceClient() : await createClient();

    const { data, error } = await supabase
      .from('email_templates')
      .select('id, name, subject, body, created_at, updated_at, created_by')
      .eq('organization_id', user.organizationId)
      .order('updated_at', { ascending: false });

    if (error) {
      throw new Error(`이메일 템플릿 조회 실패: ${error.message}`);
    }

    return (data || []) as EmailTemplateItem[];
  });
}
