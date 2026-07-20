import { MailService } from './mail.service';
import { NotFoundException } from '@nestjs/common';

describe('MailService reply recording', () => {
  const actor = { userId: 'user_1', sessionId: 'session_1', organizationId: 'org_1' };
  it('delegates reply recording to the transactional use case', async () => {
    const result = { reply: { id: 'reply_1' }, classification: { category: 'unsubscribe' }, task: null };
    const recordMailReply = { execute: jest.fn().mockResolvedValue(result) };
    const service = new MailService({} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, recordMailReply as any);

    await expect(service.recordReply('mail_1', {
      fromEmail: 'contact@example.com',
      body: '今後の配信を停止してください。'
    }, actor)).resolves.toBe(result);

    expect(recordMailReply.execute).toHaveBeenCalledWith('mail_1', {
      fromEmail: 'contact@example.com',
      body: '今後の配信を停止してください。'
    }, actor);
  });

  it('returns not found when the requested thread is outside the organization', async () => {
    const prisma = {
      outreachEmail: { findMany: jest.fn().mockResolvedValue([]) },
      emailReply: { findMany: jest.fn() }
    };
    const service = new MailService(prisma as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any);

    await expect(service.getThread('thread_other_org', 'org_1')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.outreachEmail.findMany).toHaveBeenCalledWith({
      where: { organizationId: 'org_1', gmailThreadId: 'thread_other_org' }
    });
    expect(prisma.emailReply.findMany).not.toHaveBeenCalled();
  });
});
