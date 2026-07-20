import { MailService } from './mail.service';

describe('MailService templates', () => {
  const createService = () => {
    const tx = {
      mailTemplate: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockImplementation(({ create }) => Promise.resolve({ id: 'template_1', ...create }))
      },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit_1' }) }
    };
    const prisma = {
      mailTemplate: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockImplementation(({ create }) => Promise.resolve({ id: 'template_1', ...create }))
      },
      $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) => callback(tx))
    };
    const service = new MailService(
      prisma as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );

    return { service, prisma, tx };
  };

  it('saves a template by key so imports can update existing templates', async () => {
    const { service, tx } = createService();

    await expect(service.saveTemplate({
      key: ' campfire-site-message ',
      name: ' CAMPFIREプロフィールDM ',
      channel: ' site_message ',
      subject: '',
      body: ' 本文 ',
      description: ' 説明 '
    })).resolves.toMatchObject({
      key: 'campfire-site-message',
      name: 'CAMPFIREプロフィールDM',
      channel: 'site_message',
      body: '本文',
      description: '説明',
      isActive: true
    });

    expect(tx.mailTemplate.upsert).toHaveBeenCalledWith({
      where: { key: 'campfire-site-message' },
      update: expect.objectContaining({ body: '本文' }),
      create: expect.objectContaining({ body: '本文' })
    });
  });

  it('imports multiple templates through the same save path', async () => {
    const { service, tx } = createService();
    const actor = {
      userId: '11111111-1111-4111-8111-111111111111',
      sessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    };

    await expect(service.importTemplates({
      templates: [
        { key: 'email-normal', name: 'メール標準', channel: 'email', subject: '件名', body: '本文' },
        { key: 'site-message-short', name: 'サイトDM短文', channel: 'site_message', body: '本文' }
      ]
    }, actor)).resolves.toMatchObject({
      imported: 2
    });

    expect(tx.mailTemplate.upsert).toHaveBeenCalledTimes(2);
    expect(tx.auditLog.create).toHaveBeenCalledTimes(2);
    expect(tx.auditLog.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        userId: actor.userId,
        sessionId: actor.sessionId,
        action: 'mail_template.imported'
      })
    });
  });

  it('writes a transactional template audit with the actor session and no template content', async () => {
    const { service, tx } = createService();
    const actor = {
      userId: '11111111-1111-4111-8111-111111111111',
      sessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    };

    await service.saveTemplate({
      key: 'normal-email',
      name: '営業メール',
      channel: 'email',
      subject: '外部に残してはいけない件名',
      body: '外部に残してはいけない本文',
      description: '外部に残してはいけない説明'
    }, actor);

    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: actor.userId,
        sessionId: actor.sessionId,
        action: 'mail_template.saved',
        entityType: 'MailTemplate',
        entityId: 'template_1'
      })
    });
    const serialized = JSON.stringify(tx.auditLog.create.mock.calls[0][0]);
    expect(serialized).not.toContain('外部に残してはいけない件名');
    expect(serialized).not.toContain('外部に残してはいけない本文');
    expect(serialized).not.toContain('外部に残してはいけない説明');
  });
});
