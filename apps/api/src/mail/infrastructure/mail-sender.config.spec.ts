import { MAIL_SENDER } from '../domain/mail-sender';
import { ServiceUnavailableException } from '@nestjs/common';
import { DisabledMailSender } from './disabled-mail.sender';
import { GmailMailSender } from './gmail-mail.sender';
import { mailSenderProvider, readMailSenderConfig } from './mail-sender.config';

describe('mail-sender.config', () => {
  it('keeps sender disabled unless MAIL_SEND_ENABLED is true', () => {
    expect(readMailSenderConfig({ MAIL_SENDER_PROVIDER: 'gmail' })).toEqual({
      enabled: false,
      provider: 'disabled'
    });
  });

  it('accepts gmail provider only when sending is explicitly enabled', () => {
    expect(readMailSenderConfig({ MAIL_SEND_ENABLED: 'true', MAIL_SENDER_PROVIDER: 'gmail' })).toEqual({
      enabled: true,
      provider: 'gmail'
    });
  });

  it('falls back to disabled for unknown providers', () => {
    expect(readMailSenderConfig({ MAIL_SEND_ENABLED: 'true', MAIL_SENDER_PROVIDER: 'smtp' })).toEqual({
      enabled: true,
      provider: 'disabled'
    });
  });

  it('fails startup instead of silently disabling an explicitly enabled sender', () => {
    const originalEnv = process.env;
    process.env = {
      MAIL_SEND_ENABLED: 'true',
      MAIL_SENDER_PROVIDER: 'gmail'
    };
    expect(() => mailSenderProvider()).toThrow('requires complete Gmail and legal sender settings');
    process.env = originalEnv;
  });

  it('binds disabled provider to DisabledMailSender by default', () => {
    const provider = mailSenderProvider();

    expect(provider).toEqual({
      provide: MAIL_SENDER,
      useClass: DisabledMailSender
    });
  });

  it('preflights disabled provider before a mail is claimed for sending', () => {
    const sender = new DisabledMailSender();

    expect(() => sender.validate({
      idempotencyKey: 'mail:mail_1:retry:0',
      organizationId: 'org_1',
      toEmail: 'to@example.com',
      subject: '件名',
      body: '本文'
    })).toThrow(ServiceUnavailableException);
  });

  it('binds gmail provider when sending is enabled and credentials are complete', () => {
    const originalEnv = process.env;
    process.env = {
      MAIL_SEND_ENABLED: 'true',
      MAIL_SENDER_PROVIDER: 'gmail',
      GMAIL_CLIENT_ID: 'client',
      GMAIL_CLIENT_SECRET: 'secret',
      GMAIL_REFRESH_TOKEN: 'refresh',
      GMAIL_FROM_EMAIL: 'sales@example.com',
      MAIL_SENDER_ORGANIZATION_ID: '00000000-0000-4000-8000-000000000007',
      APP_BASE_URL: 'https://sales.example.com',
      MAIL_LEGAL_SENDER_NAME: '販売会社',
      MAIL_LEGAL_POSTAL_ADDRESS: '東京都千代田区1-1',
      MAIL_LEGAL_CONTACT_EMAIL: 'privacy@example.com'
    };

    expect(mailSenderProvider()).toEqual({
      provide: MAIL_SENDER,
      useClass: GmailMailSender
    });
    process.env = originalEnv;
  });
});
