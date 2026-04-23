import type { ReactNode } from 'react';

const MENTION_SPLIT = /(@[\w가-힣.-]+)/g;

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
