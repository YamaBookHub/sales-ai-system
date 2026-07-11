import { Provider } from '@nestjs/common';
import { MAIL_SENDER } from '../domain/mail-sender';
import { DisabledMailSender } from './disabled-mail.sender';
import { readGmailMailSenderConfig } from './gmail-mail-sender.config';
import { GmailMailSender } from './gmail-mail.sender';

export type MailSenderProviderName = 'disabled' | 'gmail';

export type MailSenderConfig = {
  enabled: boolean;
  provider: MailSenderProviderName;
};

export function readMailSenderConfig(env: NodeJS.ProcessEnv = process.env): MailSenderConfig {
  const enabled = String(env.MAIL_SEND_ENABLED || '').toLowerCase() === 'true';
  const provider = normalizeMailSenderProvider(env.MAIL_SENDER_PROVIDER || env.MAIL_PROVIDER);

  return {
    enabled,
    provider: enabled ? provider : 'disabled'
  };
}

export function mailSenderProvider(): Provider {
  const config = readMailSenderConfig();

  if (config.provider === 'gmail') {
    const gmailConfig = readGmailMailSenderConfig();
    if (!gmailConfig.ok) {
      return { provide: MAIL_SENDER, useClass: DisabledMailSender };
    }
    return { provide: MAIL_SENDER, useClass: GmailMailSender };
  }

  return { provide: MAIL_SENDER, useClass: DisabledMailSender };
}

function normalizeMailSenderProvider(value?: string): MailSenderProviderName {
  const normalized = String(value || 'disabled').trim().toLowerCase();
  if (normalized === 'gmail') return 'gmail';
  return 'disabled';
}
