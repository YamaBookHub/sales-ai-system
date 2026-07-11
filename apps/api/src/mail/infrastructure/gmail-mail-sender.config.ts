export type GmailMailSenderConfig = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  fromEmail: string;
};

export type GmailMailSenderConfigResult =
  | { ok: true; config: GmailMailSenderConfig }
  | { ok: false; missing: Array<keyof GmailMailSenderConfig> };

export function readGmailMailSenderConfig(env: NodeJS.ProcessEnv = process.env): GmailMailSenderConfigResult {
  const config: GmailMailSenderConfig = {
    clientId: readEnv(env, 'GMAIL_CLIENT_ID'),
    clientSecret: readEnv(env, 'GMAIL_CLIENT_SECRET'),
    refreshToken: readEnv(env, 'GMAIL_REFRESH_TOKEN'),
    fromEmail: readEnv(env, 'GMAIL_FROM_EMAIL')
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
