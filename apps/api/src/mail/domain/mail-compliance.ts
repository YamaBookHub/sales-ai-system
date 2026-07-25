export type MailComplianceInput = {
  body: string;
  senderName: string;
  postalAddress: string;
  contactEmail: string;
  unsubscribeUrl: string;
};

const FOOTER_MARKER = '--- 配信・送信者情報 ---';

export function appendMailComplianceFooter(input: MailComplianceInput) {
  const body = input.body.trimEnd();
  if (body.includes(FOOTER_MARKER)) return body;
  return [
    body,
    '',
    FOOTER_MARKER,
    `送信者: ${input.senderName}`,
    `所在地: ${input.postalAddress}`,
    `お問い合わせ: ${input.contactEmail}`,
    `配信停止: ${input.unsubscribeUrl}`
  ].join('\n');
}

export function buildUnsubscribeUrl(appBaseUrl: string, token: string) {
  const base = new URL(appBaseUrl);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) {
    throw new Error('APP_BASE_URL must be a public HTTP(S) origin.');
  }
  return new URL(`/unsubscribe/${encodeURIComponent(token)}`, base).toString();
}
