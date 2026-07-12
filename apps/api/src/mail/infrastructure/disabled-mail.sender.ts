import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { MailSender, MailSendRequest, MailSendResult } from '../domain/mail-sender';

@Injectable()
export class DisabledMailSender implements MailSender {
  validate(_request: MailSendRequest): never {
    throw new ServiceUnavailableException('実送信providerが未設定です。Gmail等のproviderを設定してから送信してください。');
  }

  async send(_request: MailSendRequest): Promise<MailSendResult> {
    this.validate(_request);
  }
}
