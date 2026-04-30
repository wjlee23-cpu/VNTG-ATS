export type RenderThemedEmailInput = {
  subject: string;
  body: string;
  organizationName?: string | null;
};

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * 사용자가 입력한 본문을 "메일 발송 가능한 HTML"로 정규화합니다.
 * - HTML 태그가 보이면 그대로 사용
 * - 아니면 텍스트로 보고 escape 후 <br>로 줄바꿈 처리
 */
export function normalizeEmailBodyToHtml(body: string) {
  const raw = body ?? '';
  const looksLikeHtml = /<([a-z][\w-]*)(\s[^>]*)?>/i.test(raw);
  if (looksLikeHtml) {
    // 관리자가 전체 HTML 문서(doctype/html/head/body 포함)를 그대로 붙여넣는 경우가 있습니다.
    // sanitize 단계에서 head/title 같은 태그는 제거되지만 "title 텍스트"는 본문에 남아
    // 제목이 2번 보이는 현상이 생길 수 있어, 여기서 body 내부만 추출합니다.
    const bodyMatch = raw.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch?.[1]) return bodyMatch[1].trim();

    // body 태그가 없고 html/head만 있는 경우를 방어적으로 제거합니다.
    const withoutHead = raw.replace(/<head\b[^>]*>[\s\S]*?<\/head>/i, '');
    return withoutHead.trim();
  }
  return escapeHtml(raw).replace(/\n/g, '<br>');
}

export type RenderThemedEmailFromHtmlInput = {
  subject: string;
  bodyHtml: string;
  organizationName?: string | null;
};

/**
 * 공통 이메일 레이아웃(인라인 스타일 기반)으로 감싼 HTML을 생성합니다.
 * - Gmail/Outlook/네이버메일 등 호환을 위해 class/style tag 의존도를 최소화합니다.
 */
export function renderThemedEmailHtml(input: RenderThemedEmailInput) {
  const orgName = (input.organizationName || 'VNTG ATS').trim();
  const subject = (input.subject || '').trim();
  const bodyHtml = normalizeEmailBodyToHtml(input.body || '');
  return renderThemedEmailHtmlFromHtml({
    subject,
    bodyHtml,
    organizationName: orgName,
  });
}

/**
 * 이미 HTML로 정규화된 본문을 공통 레이아웃으로 감쌉니다.
 * - sanitize 이후의 HTML을 넣기 위한 용도
 */
export function renderThemedEmailHtmlFromHtml(input: RenderThemedEmailFromHtmlInput) {
  const orgName = (input.organizationName || 'VNTG ATS').trim();
  const subject = (input.subject || '').trim();
  const bodyHtml = input.bodyHtml || '';

  // 이메일 클라이언트 호환성을 위해 table 레이아웃 사용
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#F7F7F8;font-family:Inter, Arial, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;color:#171717;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#F7F7F8;">
      <tr>
        <td align="center" style="padding:48px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background-color:#FFFFFF;border:1px solid #E5E5E5;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.04);">
            <tr>
              <td style="padding:36px 40px 8px 40px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td width="56" valign="middle">
                      <div style="width:56px;height:56px;background:#171717;border-radius:16px;display:block;text-align:center;line-height:56px;font-size:24px;font-weight:800;letter-spacing:-0.02em;color:#FFFFFF;box-shadow:0 2px 10px rgba(0,0,0,0.08);">
                        V
                      </div>
                    </td>
                    <td valign="middle" style="padding-left:14px;">
                      <div style="font-size:12px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#A3A3A3;margin:0;">
                        ${escapeHtml(orgName)}
                      </div>
                      <div style="font-size:18px;font-weight:800;letter-spacing:-0.02em;color:#171717;margin:6px 0 0 0;">
                        ${escapeHtml(subject || '안내드립니다')}
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 40px 28px 40px;">
                <div style="height:1px;background:#F5F5F5;width:100%;"></div>
              </td>
            </tr>
            <tr>
              <td style="padding:0 40px 8px 40px;">
                <div style="font-size:14px;line-height:1.7;color:#525252;">
                  ${bodyHtml}
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 40px 0 40px;">
                <div style="height:1px;background:#F5F5F5;width:100%;"></div>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 40px 32px 40px;">
                <div style="font-size:12px;font-weight:600;color:#A3A3A3;">
                  © ${new Date().getFullYear()} ${escapeHtml(orgName)}
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

