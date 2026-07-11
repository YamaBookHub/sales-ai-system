import { MailService } from './mail.service';

describe('MailService templates', () => {
  const createService = () => {
    const prisma = {
      mailTemplate: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockImplementation(({ create }) => Promise.resolve({ id: 'template_1', ...create }))
      }
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
      {} as any
    );

    return { service, prisma };
  };

  it('saves a template by key so imports can update existing templates', async () => {
    const { service, prisma } = createService();

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

    expect(prisma.mailTemplate.upsert).toHaveBeenCalledWith({
      where: { key: 'campfire-site-message' },
      update: expect.objectContaining({ body: '本文' }),
      create: expect.objectContaining({ body: '本文' })
    });
  });

  it('imports multiple templates through the same save path', async () => {
    const { service, prisma } = createService();

    await expect(service.importTemplates({
      templates: [
        { key: 'email-normal', name: 'メール標準', channel: 'email', subject: '件名', body: '本文' },
        { key: 'site-message-short', name: 'サイトDM短文', channel: 'site_message', body: '本文' }
      ]
    })).resolves.toMatchObject({
      imported: 2
    });

    expect(prisma.mailTemplate.upsert).toHaveBeenCalledTimes(2);
  });
});
