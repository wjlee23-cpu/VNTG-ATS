import type { EmailTemplateVariableKey } from '@/constants/email-template-variables';

export type EmailTemplateContext = {
  candidate?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    status?: string | null;
  };
  job?: {
    title?: string | null;
  };
  stage?: {
    id?: string | null;
    name?: string | null;
  };
  organization?: {
    name?: string | null;
  };
};

/**
 * {{candidate.name}} 같은 토큰을 context 값으로 치환합니다.
 * - 토큰 값이 없으면 빈 문자열로 치환합니다. (메일 문장이 어색하지 않게 하기 위함)
 * - 지원 path는 EmailTemplateVariableKey로 제한합니다.
 */
export function applyEmailTemplate(text: string, context: EmailTemplateContext): string {
  if (!text) return '';

  // 토큰 형식: {{ a.b.c }} (공백 허용)
  const tokenRegex = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

  return text.replace(tokenRegex, (_full, rawKey: string) => {
    const key = rawKey as EmailTemplateVariableKey;
    const value = getValueByKey(context, key);
    return value ?? '';
  });
}

function getValueByKey(
  context: EmailTemplateContext,
  key: EmailTemplateVariableKey
): string | null {
  // 안전하게 dot-path를 따라가며 값을 꺼냅니다.
  // - UI에서 제공하는 key 목록만 들어오도록 타입을 제한했지만,
  //   런타임에서도 방어적으로 처리합니다.
  const parts = key.split('.');
  let cur: any = context as any;
  for (const part of parts) {
    if (!cur || typeof cur !== 'object') return null;
    cur = cur[part];
  }
  if (cur === null || cur === undefined) return null;
  if (typeof cur === 'string') return cur;
  if (typeof cur === 'number' || typeof cur === 'boolean') return String(cur);
  return null;
}

