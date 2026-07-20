import { MailService } from './mail.service';

describe('MailService audit logging', () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const organizationId = '00000000-0000-4000-8000-000000000007';
  const actor = { userId, sessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', organizationId };
  const mail = {
    id: '22222222-2222-4222-8222-222222222222',
    status: 'draft',
    leadId: '33333333-3333-4333-8333-333333333333',
    companyId: '44444444-4444-4444-8444-444444444444',
    contactId: '55555555-5555-4555-8555-555555555555',
    destinationType: 'email',
    destinationKey: 'email:secret@example.com',
    retryCount: 0,
    subject: '秘匿する件名',
    body: '秘匿する本文'
  };

  function createService() {
    const tx = {
      outreachEmail: {
        findFirst: jest.fn().mockResolvedValue(mail),
        update: jest.fn().mockResolvedValue({ ...mail, subject: '更新後の件名', body: '更新後の本文' })
      },
      emailEvent: { create: jest.fn().mockResolvedValue({ id: 'event_1' }) },
      mailChecklistItem: { upsert: jest.fn().mockResolvedValue({ id: 'item_1' }) },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit_1' }) }
    };
    const prisma = {
      outreachEmail: { findFirst: jest.fn().mockResolvedValue(mail) },
      mailChecklistItem: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([{ checked: true }]),
        createMany: jest.fn().mockResolvedValue({ count: 0 })
      },
      $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) => callback(tx))
    };
    const service = new MailService(
      prisma as any,
      {} as any, {} as any, {} as any, {} as any, {} as any, {} as any,
      {} as any, {} as any, {} as any, {} as any, {} as any
    );
    return { service, prisma, tx };
  }

  it('records only changed fields and hashes for a successful edit', async () => {
    const { service, tx } = createService();

    await service.update(mail.id, { subject: '更新後の件名', body: '更新後の本文' }, actor);

    expect(tx.outreachEmail.findFirst).toHaveBeenCalledWith({
      where: { id: mail.id, organizationId }
    });
    expect(tx.outreachEmail.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId_id: { organizationId, id: mail.id } }
    }));
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId,
        userId,
        sessionId: actor.sessionId,
        action: 'mail.edited',
        entityType: 'OutreachEmail',
        entityId: mail.id,
        after: expect.objectContaining({
          changedFields: ['subject', 'body'],
          contentHashes: expect.objectContaining({ subject: expect.any(String), body: expect.any(String) })
        })
      })
    });
    const serialized = JSON.stringify(tx.auditLog.create.mock.calls[0][0]);
    expect(serialized).not.toContain('秘匿する件名');
    expect(serialized).not.toContain('更新後の本文');
    expect(serialized).not.toContain('secret@example.com');
  });

  it('adds checklist audit data only after a successful checklist update', async () => {
    const { service, tx } = createService();

    await service.updateChecklist(mail.id, {
      items: [{ key: 'company_name', label: '会社名', checked: true }]
    }, actor);

    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId,
        userId,
        sessionId: actor.sessionId,
        action: 'mail.checklist_updated',
        after: expect.objectContaining({ changedKeys: ['company_name'], checkedCount: 1, complete: true })
      })
    });
  });

  it('does not write an audit record when editing fails before the update', async () => {
    const { service, tx } = createService();
    tx.outreachEmail.findFirst.mockResolvedValue(null);

    await expect(service.update(mail.id, { subject: '更新後の件名' }, actor)).rejects.toThrow('Mail not found');
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('audits a successful cancellation without retaining mail content', async () => {
    const { service, tx } = createService();

    await service.cancel(mail.id, actor);

    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId,
        userId,
        sessionId: actor.sessionId,
        action: 'mail.cancelled',
        entityId: mail.id
      })
    });
    expect(JSON.stringify(tx.auditLog.create.mock.calls[0][0])).not.toContain('秘匿する本文');
  });
});
