import { MailService } from './mail.service';

describe('MailService reply recording', () => {
  it('delegates reply recording to the transactional use case', async () => {
    const result = { reply: { id: 'reply_1' }, classification: { category: 'unsubscribe' }, task: null };
    const recordMailReply = { execute: jest.fn().mockResolvedValue(result) };
    const service = new MailService({} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, recordMailReply as any);

    await expect(service.recordReply('mail_1', {
      fromEmail: 'contact@example.com',
      body: '今後の配信を停止してください。'
    })).resolves.toBe(result);

    expect(recordMailReply.execute).toHaveBeenCalledWith('mail_1', {
      fromEmail: 'contact@example.com',
      body: '今後の配信を停止してください。'
    });
  });
});
