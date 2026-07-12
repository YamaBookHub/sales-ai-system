export const MAIL_SENDER = Symbol('MAIL_SENDER');

export type MailSendRequest = {
  idempotencyKey: string;
  toEmail?: string | null;
  sendMethod?: string | null;
  contactFormUrl?: string | null;
  siteMessageUrl?: string | null;
  subject: string;
  body: string;
};

export type MailSendResult = {
  provider: string;
  messageId?: string;
  threadId?: string;
  sentAt: Date;
};

export interface MailSender {
  send(request: MailSendRequest): Promise<MailSendResult>;
}
