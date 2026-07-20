import { ClassifyReplyUseCase } from './classify-reply.usecase';

describe('ClassifyReplyUseCase', () => {
  it('stores the authenticated session in its transactional audit without reply text', async () => {
    const tx = {
      emailReply: { update: jest.fn().mockResolvedValue({ id: 'reply_1' }) },
      salesLead: { update: jest.fn().mockResolvedValue({ id: 'lead_1' }) },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit_1' }) }
    };
    const prisma = {
      emailReply: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'reply_1',
          body: '商談を希望します。',
          bodyText: null,
          email: { leadId: 'lead_1' }
        })
      },
      $transaction: jest.fn((callback) => callback(tx))
    };

    await new ClassifyReplyUseCase(prisma as any).execute('reply_1', { userId: 'user_1', sessionId: 'session_1', organizationId: 'org_1' });

    expect(tx.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      userId: 'user_1',
      sessionId: 'session_1',
      organizationId: 'org_1',
      action: 'reply.classify',
      entityId: 'reply_1'
    }) });
    expect(JSON.stringify(tx.auditLog.create.mock.calls[0][0])).not.toContain('商談を希望します。');
  });
});
