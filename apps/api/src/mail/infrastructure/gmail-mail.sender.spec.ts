import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { buildRawGmailMessage, GmailMailSender } from './gmail-mail.sender';

describe('GmailMailSender', () => {
  const config = {
    clientId: 'client',
    clientSecret: 'secret',
    refreshToken: 'refresh',
    fromEmail: 'sales@example.com'
  };

  const createResponse = (ok: boolean, body: unknown, statusText = 'error', status?: number) => ({
    ok,
    status,
    statusText,
    json: jest.fn().mockResolvedValue(body),
    text: jest.fn().mockResolvedValue(typeof body === 'string' ? body : JSON.stringify(body))
  } as any);

  it('gets OAuth token and sends raw Gmail message', async () => {
    const httpPost = jest
      .fn()
      .mockResolvedValueOnce(createResponse(true, { access_token: 'access' }))
      .mockResolvedValueOnce(createResponse(true, { id: 'message_1', threadId: 'thread_1' }));
    const sender = new GmailMailSender(config, httpPost);

    await expect(sender.send({
      idempotencyKey: 'mail:mail_1:retry:0',
      toEmail: 'to@example.com',
      subject: '件名',
      body: '本文'
    })).resolves.toMatchObject({
      provider: 'gmail',
      messageId: 'message_1',
      threadId: 'thread_1'
    });

    expect(httpPost).toHaveBeenNthCalledWith(
      1,
      'https://oauth2.googleapis.com/token',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('grant_type=refresh_token')
      })
    );
    expect(httpPost).toHaveBeenNthCalledWith(
      2,
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer access' })
      })
    );
    expect(JSON.parse(httpPost.mock.calls[1][1].body).raw).toEqual(expect.any(String));
  });

  it('rejects missing recipient before OAuth request', async () => {
    const httpPost = jest.fn();
    const sender = new GmailMailSender(config, httpPost);

    await expect(sender.send({
      idempotencyKey: 'key',
      toEmail: null,
      subject: '件名',
      body: '本文'
    })).rejects.toThrow(BadRequestException);
    expect(httpPost).not.toHaveBeenCalled();
  });

  it('rejects non-email channels before calling Gmail', async () => {
    const httpPost = jest.fn();
    const sender = new GmailMailSender(config, httpPost);

    await expect(sender.send({
      idempotencyKey: 'key',
      sendMethod: 'site_message',
      toEmail: 'to@example.com',
      subject: '件名',
      body: '本文'
    })).rejects.toThrow(BadRequestException);
    expect(httpPost).not.toHaveBeenCalled();
  });

  it('rejects OAuth failure', async () => {
    const httpPost = jest.fn().mockResolvedValueOnce(createResponse(false, { error: 'invalid_grant' }));
    const sender = new GmailMailSender(config, httpPost);

    await expect(sender.send({
      idempotencyKey: 'key',
      toEmail: 'to@example.com',
      subject: '件名',
      body: '本文'
    })).rejects.toThrow(ServiceUnavailableException);
  });

  it('retries transient OAuth failures but does not retry the send request', async () => {
    const httpPost = jest
      .fn()
      .mockResolvedValueOnce(createResponse(false, { error: 'temporary' }, 'unavailable', 503))
      .mockResolvedValueOnce(createResponse(true, { access_token: 'access' }))
      .mockResolvedValueOnce(createResponse(true, { id: 'message_1', threadId: 'thread_1' }));
    const sleep = jest.fn().mockResolvedValue(undefined);
    const sender = new GmailMailSender(config, httpPost, sleep);

    await expect(sender.send({
      idempotencyKey: 'key',
      toEmail: 'to@example.com',
      subject: '件名',
      body: '本文'
    })).resolves.toMatchObject({ messageId: 'message_1' });

    expect(httpPost).toHaveBeenCalledTimes(3);
    expect(httpPost.mock.calls[0][0]).toBe('https://oauth2.googleapis.com/token');
    expect(httpPost.mock.calls[1][0]).toBe('https://oauth2.googleapis.com/token');
    expect(httpPost.mock.calls[2][0]).toBe('https://gmail.googleapis.com/gmail/v1/users/me/messages/send');
    expect(sleep).toHaveBeenCalledWith(250);
  });

  it('builds base64url encoded RFC822 message', () => {
    const raw = buildRawGmailMessage({
      fromEmail: 'sales@example.com',
      toEmail: 'to@example.com',
      subject: '件名',
      body: '本文',
      idempotencyKey: 'key'
    });
    const decoded = Buffer.from(raw, 'base64url').toString('utf8');

    expect(decoded).toContain('From: sales@example.com');
    expect(decoded).toContain('To: to@example.com');
    expect(decoded).toContain('X-Idempotency-Key: key');
    expect(decoded).toContain('本文');
  });
});
