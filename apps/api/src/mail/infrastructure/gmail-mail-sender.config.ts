export type GmailMailSenderConfig = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  fromEmail: string;
  appBaseUrl: string;
  legalSenderName: string;
  legalPostalAddress: string;
  legalContactEmail: string;
  organizationId: string;
};

export type GmailMailSenderConfigResult =
  | { ok: true; config: GmailMailSenderConfig }
  | { ok: false; missing: Array<keyof GmailMailSenderConfig> };

export function readGmailMailSenderConfig(env: NodeJS.ProcessEnv = process.env): GmailMailSenderConfigResult {
  const config: GmailMailSenderConfig = {
    clientId: readEnv(env, 'GMAIL_CLIENT_ID'),
    clientSecret: readEnv(env, 'GMAIL_CLIENT_SECRET'),
    refreshToken: readEnv(env, 'GMAIL_REFRESH_TOKEN'),
    fromEmail: readEnv(env, 'GMAIL_FROM_EMAIL'),
    appBaseUrl: readEnv(env, 'APP_BASE_URL'),
    legalSenderName: readEnv(env, 'MAIL_LEGAL_SENDER_NAME') || readEnv(env, 'LEGAL_OPERATOR_NAME'),
    legalPostalAddress: readEnv(env, 'MAIL_LEGAL_POSTAL_ADDRESS') || readEnv(env, 'LEGAL_POSTAL_ADDRESS'),
    legalContactEmail: readEnv(env, 'MAIL_LEGAL_CONTACT_EMAIL') || readEnv(env, 'LEGAL_CONTACT_EMAIL'),
    organizationId: readEnv(env, 'MAIL_SENDER_ORGANIZATION_ID')
  };
  const missing = (Object.entries(config) as Array<[keyof GmailMailSenderConfig, string]>)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length) {
    return { ok: false, missing };
  }

  return { ok: true, config };
}

function readEnv(env: NodeJS.ProcessEnv, key: string) {
  return String(env[key] || '').trim();
}
