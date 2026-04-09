'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getCurrentUser, checkRole } from '@/api/utils/auth';
import { validateRequired } from '@/api/utils/validation';
import { withErrorHandling } from '@/api/utils/errors';

interface CreateEmailTemplateInput {
  name: string;
  subject: string;
  body: string;
}

interface UpdateEmailTemplateInput {
  id: string;
  name: string;
  subject: string;
  body: string;
}

/**
 * 조직 공용 이메일 템플릿을 생성합니다.
 */
export async function createEmailTemplate(input: CreateEmailTemplateInput) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const canManageTemplate = checkRole(user.role, 'recruiter');

    if (!canManageTemplate) {
      throw new Error('이메일 템플릿을 생성할 권한이 없습니다.');
    }

    const name = validateRequired(input.name, '템플릿 이름').trim();
    const subject = validateRequired(input.subject, '템플릿 제목').trim();
    const body = validateRequired(input.body, '템플릿 본문').trim();

    if (name.length > 100) {
      throw new Error('템플릿 이름은 100자 이내로 입력해주세요.');
    }

    const isAdmin = user.role === 'admin';
    const supabase = isAdmin ? createServiceClient() : await createClient();

    const { data, error } = await supabase
      .from('email_templates')
      .insert({
        organization_id: user.organizationId,
        name,
        subject,
        body,
        created_by: user.userId,
      })
      .select('id, name, subject, body, created_at, updated_at, created_by')
      .single();

    if (error) {
      throw new Error(`이메일 템플릿 생성 실패: ${error.message}`);
    }

    revalidatePath('/templates');
    revalidatePath('/dashboard/templates');

    return data;
  });
}

/**
 * 조직 공용 이메일 템플릿을 수정합니다.
 */
export async function updateEmailTemplate(input: UpdateEmailTemplateInput) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const canManageTemplate = checkRole(user.role, 'recruiter');

    if (!canManageTemplate) {
      throw new Error('이메일 템플릿을 수정할 권한이 없습니다.');
    }

    const id = validateRequired(input.id, '템플릿 ID').trim();
    const name = validateRequired(input.name, '템플릿 이름').trim();
    const subject = validateRequired(input.subject, '템플릿 제목').trim();
    const body = validateRequired(input.body, '템플릿 본문').trim();

    if (name.length > 100) {
      throw new Error('템플릿 이름은 100자 이내로 입력해주세요.');
    }

    const isAdmin = user.role === 'admin';
    const supabase = isAdmin ? createServiceClient() : await createClient();

    const { data, error } = await supabase
      .from('email_templates')
      .update({
        name,
        subject,
        body,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('organization_id', user.organizationId)
      .select('id, name, subject, body, created_at, updated_at, created_by')
      .single();

    if (error) {
      throw new Error(`이메일 템플릿 수정 실패: ${error.message}`);
    }

    revalidatePath('/templates');
    revalidatePath('/dashboard/templates');

    return data;
  });
}

/**
 * 조직 공용 이메일 템플릿을 삭제합니다.
 */
export async function deleteEmailTemplate(id: string) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser();
    const canManageTemplate = checkRole(user.role, 'recruiter');

    if (!canManageTemplate) {
      throw new Error('이메일 템플릿을 삭제할 권한이 없습니다.');
    }

    const templateId = validateRequired(id, '템플릿 ID').trim();
    const isAdmin = user.role === 'admin';
    const supabase = isAdmin ? createServiceClient() : await createClient();

    const { error } = await supabase
      .from('email_templates')
      .delete()
      .eq('id', templateId)
      .eq('organization_id', user.organizationId);

    if (error) {
      throw new Error(`이메일 템플릿 삭제 실패: ${error.message}`);
    }

    revalidatePath('/templates');
    revalidatePath('/dashboard/templates');

    return { id: templateId };
  });
}
