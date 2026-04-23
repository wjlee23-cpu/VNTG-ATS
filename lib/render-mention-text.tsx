import type { ReactNode } from 'react';

const MENTION_SPLIT = /(@[\w가-힣.-]+)/g;

const UUID_IN_BRACKETS = /@\[([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]/gi;

/** 저장된 @[userId] 토큰을 표시용 @이름 문자열로 바꿉니다. */
export function resolveMentionUuidTokensInText(
  text: string,
  userById: Map<string, { displayLabel: string }>,
): string {
  return text.replace(UUID_IN_BRACKETS, (_m, id: string) => {
    const u = userById.get(String(id).toLowerCase());
    return u ? `@${u.displayLabel}` : '@동료';
  });
}

/** @팀원 형태를 인디고 뱃지 스타일로 감쌉니다. */
export function renderTextWithMentionBadges(text: string): ReactNode[] {
  if (!text) return [];
  const segments = text.split(MENTION_SPLIT);
  return segments.map((part, i) => {
    if (part.startsWith('@')) {
      return (
        <span
          key={i}
          className="font-bold text-indigo-600 bg-indigo-50 px-1 rounded cursor-pointer hover:bg-indigo-100"
        >
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

/** 줄바꿈을 유지하면서 멘션만 하이라이트합니다. */
export function renderBlockTextWithMentions(text: string): ReactNode {
  const lines = text.split('\n');
  return lines.map((line, idx) => (
    <span key={idx}>
      {idx > 0 ? <br /> : null}
      {renderTextWithMentionBadges(line)}
    </span>
  ));
}

/** UUID 멘션 토큰을 이름으로 풀고, 줄바꿈·@하이라이트까지 적용합니다. */
export function renderBlockTextWithResolvedMentions(
  text: string,
  userById: Map<string, { displayLabel: string }>,
): ReactNode {
  const resolved = resolveMentionUuidTokensInText(text, userById);
  return renderBlockTextWithMentions(resolved);
}
