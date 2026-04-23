/** 멘션 토큰: 저장 형식 @[사용자UUID] (표시 시 이름으로 치환) */
export const MENTION_USER_ID_TOKEN_RE =
  /@\[([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]/gi;

/** 본문에서 멘션된 사용자 UUID 목록을 추출합니다. */
export function parseMentionUserIdsFromText(text: string): string[] {
  const ids = new Set<string>();
  const re = new RegExp(MENTION_USER_ID_TOKEN_RE.source, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m[1]) ids.add(m[1].toLowerCase());
  }
  return [...ids];
}

/** 멘션 삽입용 토큰 문자열 */
export function mentionTokenForUserId(userId: string): string {
  return `@[${userId}]`;
}
