import sanitizeHtml from 'sanitize-html';

/**
 * 이메일 본문/템플릿은 사용자가 입력할 수 있으므로 XSS 방지가 필요합니다.
 * - 스크립트/이벤트 핸들러 등을 제거하고, 이메일에서 자주 쓰는 태그/속성만 허용합니다.
 * - 공통 레이아웃은 인라인 스타일을 쓰므로 `style` 속성은 허용하되, 위험한 태그는 차단합니다.
 */
export function sanitizeEmailHtml(dirtyHtml: string) {
  return sanitizeHtml(dirtyHtml || '', {
    allowedTags: [
      'a',
      'abbr',
      'b',
      'blockquote',
      'br',
      'code',
      'div',
      'em',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'hr',
      'i',
      'img',
      'li',
      'ol',
      'p',
      'pre',
      'span',
      'strong',
      'table',
      'tbody',
      'td',
      'tfoot',
      'th',
      'thead',
      'tr',
      'u',
      'ul',
    ],
    allowedAttributes: {
      a: ['href', 'name', 'target', 'rel', 'title'],
      img: ['src', 'alt', 'title', 'width', 'height'],
      table: ['width', 'cellpadding', 'cellspacing', 'border', 'align'],
      td: ['colspan', 'rowspan', 'align', 'valign', 'width'],
      th: ['colspan', 'rowspan', 'align', 'valign', 'width'],
      '*': ['style'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowProtocolRelative: false,
    // data:는 이메일에서 악용 여지가 커서 기본 차단 (이미지 업로드 기능을 붙일 때 별도 처리)
    allowedSchemesByTag: {
      img: ['http', 'https'],
    },
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }, true),
    },
    // class는 메일 클라이언트에서 무시될 가능성이 높고, 스타일 주입 통로가 되기도 해서 허용하지 않습니다.
    allowedClasses: {},
  });
}

