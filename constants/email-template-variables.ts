export type EmailTemplateVariableGroupId = 'candidate' | 'job' | 'stage' | 'organization' | 'interview';

export type EmailTemplateVariableKey =
  | 'candidate.name'
  | 'candidate.status'
  | 'job.title'
  | 'stage.name'
  | 'organization.name'
  | 'interview.dateTimeText';

export type EmailTemplateVariableItem = {
  groupId: EmailTemplateVariableGroupId;
  label: string;
  key: EmailTemplateVariableKey;
  token: `{{${EmailTemplateVariableKey}}}`;
};

/**
 * 이메일 템플릿 Insert(치환 변수) 단일 소스.
 * - UI(칩/버튼)와 치환 로직이 같은 목록을 공유하도록 합니다.
 * - 토큰 표기 규칙: {{path.to.value}}
 */
export const EMAIL_TEMPLATE_VARIABLES: EmailTemplateVariableItem[] = [
  { groupId: 'candidate', label: '후보자 이름', key: 'candidate.name', token: '{{candidate.name}}' },
  { groupId: 'candidate', label: '후보자 상태', key: 'candidate.status', token: '{{candidate.status}}' },

  { groupId: 'job', label: '지원 포지션', key: 'job.title', token: '{{job.title}}' },

  { groupId: 'stage', label: '전형명', key: 'stage.name', token: '{{stage.name}}' },

  { groupId: 'organization', label: '회사명', key: 'organization.name', token: '{{organization.name}}' },

  { groupId: 'interview', label: '면접일시(문구)', key: 'interview.dateTimeText', token: '{{interview.dateTimeText}}' },
];

export const EMAIL_TEMPLATE_VARIABLE_GROUP_LABEL: Record<EmailTemplateVariableGroupId, string> = {
  candidate: '후보자',
  job: '포지션',
  stage: '전형',
  organization: '회사/조직',
  interview: '면접·일정',
};

