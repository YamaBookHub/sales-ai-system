import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { MailSender, MailSendRequest, MailSendResult } from '../domain/mail-sender';
import { GmailMailSenderConfig, readGmailMailSenderConfig } from './gmail-mail-sender.config';

type GmailTokenResponse = {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
  error?: string;
  error_description?: string;
};

type GmailSendResponse = {
  id?: string;
  threadId?: string;
};

type HttpPost = (url: string, init: RequestInit) => Promise<Response>;

@Injectable()
export class GmailMailSender implements MailSender {
  constructor(
    private readonly config: GmailMailSenderConfig = requireGmailMailSenderConfig(),
    private readonly httpPost: HttpPost = fetch
  ) {}

  validate(request: MailSendRequest) {
    if (!isEmailSendMethod(request.sendMethod)) {
      throw new BadRequestException('現在の実送信providerはメールのみ対応しています。サイト内メッセージや問い合わせフォームは専用providerを設定してください。');
    }
  }

  async send(request: MailSendRequest): Promise<MailSendResult> {
    this.validate(request);
    if (!request.toEmail) {
      throw new BadRequestException('送信先メールアドレスが未設定です。');
    }

    const accessToken = await this.fetchAccessToken();
    const raw = buildRawGmailMessage({
      fromEmail: this.config.fromEmail,
      toEmail: request.toEmail,
      subject: request.subject,
      body: request.body,
      idempotencyKey: request.idempotencyKey
    });
    const response = await this.httpPost('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ raw })
    });

    if (!response.ok) {
      throw new ServiceUnavailableException(`Gmail送信に失敗しました: ${await responseText(response)}`);
    }

    const data = (await response.json()) as GmailSendResponse;
    return {
      provider: 'gmail',
      messageId: data.id,
      threadId: data.threadId,
      sentAt: new Date()
    };
  }

  private async fetchAccessToken() {
    const response = await this.httpPost('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: this.config.refreshToken,
        grant_type: 'refresh_token'
      }).toString()
    });
    const data = (await response.json()) as GmailTokenResponse;

    if (!response.ok || !data.access_token) {
      throw new ServiceUnavailableException(`Gmail OAuth認証に失敗しました: ${data.error_description || data.error || response.statusText}`);
    }

    return data.access_token;
  }
}

export function isEmailSendMethod(value?: string | null) {
  if (!value) return true;
  return ['email', 'メール'].includes(value.trim().toLowerCase());
}

export function buildRawGmailMessage(input: {
  fromEmail: string;
  toEmail: string;
  subject: string;
  body: string;
  idempotencyKey: string;
}) {
  const message = [
    `From: ${input.fromEmail}`,
    `To: ${input.toEmail}`,
    `Subject: ${encodeHeader(input.subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    `X-Idempotency-Key: ${input.idempotencyKey}`,
    '',
    input.body
  ].join('\r\n');

  return Buffer.from(message, 'utf8').toString('base64url');
}

function requireGmailMailSenderConfig() {
  const result = readGmailMailSenderConfig();
  if (!result.ok) {
    throw new ServiceUnavailableException(`Gmail送信設定が不足しています: ${result.missing.join(', ')}`);
  }
  return result.config;
}

function encodeHeader(value: string) {
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

async function responseText(response: Response) {
  try {
    return await response.text();
  } catch {
    return response.statusText;
  }
}
