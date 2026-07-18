import { MailService } from './mail.service';

describe('MailService reply recording', () => {
  it('marks the linked contact unsubscribed for an unsubscribe reply', async () => {
    const email = { id: 'mail_1', leadId: 'lead_1', contactId: 'contact_1' };
    const tx = {
      emailReply: { create: jest.fn().mockResolvedValue({ id: 'reply_1' }) },
      emailEvent: { create: jest.fn().mockResolvedValue({ id: 'event_1' }) },
      contactPerson: { update: jest.fn().mockResolvedValue({ id: 'contact_1' }) },
      salesLead: { update: jest.fn().mockResolvedValue({ id: 'lead_1' }) }
    };
    const prisma = {
      outreachEmail: { findUnique: jest.fn().mockResolvedValue(email) },
      $transaction: jest.fn((callback) => callback(tx))
    };
    const service = new MailService(prisma as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any);

    await service.recordReply(email.id, {
      fromEmail: 'contact@example.com',
      body: '今後の配信を停止してください。'
    });

    expect(tx.contactPerson.update).toHaveBeenCalledWith({
      where: { id: 'contact_1' },
      data: { isUnsubscribed: true, unsubscribedAt: expect.any(Date), isPrimary: false }
    });
  });
});
