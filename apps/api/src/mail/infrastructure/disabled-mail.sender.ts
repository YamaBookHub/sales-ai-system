import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { MailSender, MailSendRequest, MailSendResult } from '../domain/mail-sender';

@Injectable()
export class DisabledMailSender implements MailSender {
  async send(_request: MailSendRequest): Promise<MailSendResult> {
    throw new ServiceUnavailableException('実送信providerが未設定です。Gmail等のproviderを設定してから送信してください。');
  }
}
