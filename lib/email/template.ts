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
  /** 면접 일정 메일 등 — 일정 확정 시 스케줄/수동 입력으로 채웁니다. */
  interview?: {
    location?: string | null;
    dateTimeText?: string | null;
    beverageType?: string | null;
    beverageTemperature?: string | null;
  };
};

/** 레거시 워드형 플레이스홀더 → context 경로 (기존 양식 호환) */
const LEGACY_PLACEHOLDER_TO_PATH: Record<string, string> = {
  ApplicantName: 'candidate.name',
  PositionName: 'job.title',
  Location: 'interview.location',
  InterviewDateTimeText: 'interview.dateTimeText',
  BeverageType: 'interview.beverageType',
  BeverageTemperature: 'interview.beverageTemperature',
};

/**
 * {{candidate.name}} 또는 레거시 {{ApplicantName}} 등을 context 값으로 치환합니다.
 * - 값이 없으면 빈 문자열로 치환합니다.
 */
export function applyEmailTemplate(text: string, context: EmailTemplateContext): string {
  if (!text) return '';

  // 토큰 형식: {{ a.b.c }} 또는 {{ PascalCase }} (공백 허용)
  const tokenRegex = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

  return text.replace(tokenRegex, (_full, rawKey: string) => {
    const path = LEGACY_PLACEHOLDER_TO_PATH[rawKey] ?? rawKey;
    const value = getValueByPath(context, path);
    return value ?? '';
  });
}

function getValueByPath(context: EmailTemplateContext, path: string): string | null {
  const parts = path.split('.');
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

