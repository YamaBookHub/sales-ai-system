import { ConflictException, NotFoundException } from '@nestjs/common';
import { MailService } from './mail.service';

describe('MailService draft creation', () => {
  const lead = {
    id: 'lead_1',
    companyId: 'company_1',
    project: { platform: { name: 'CAMPFIRE' } }
  };

  const createService = () => {
    const tx = {
      outreachEmail: {
        create: jest.fn().mockResolvedValue({ id: 'mail_manual', leadId: lead.id, body: '手動で作成した本文', status: 'draft' })
      },
      salesLead: {
        update: jest.fn().mockResolvedValue({ id: lead.id, status: 'drafted' })
      }
    };
    const prisma = {
      salesLead: {
        findUnique: jest.fn().mockResolvedValue(lead)
      },
      outreachEmail: {
        findFirst: jest.fn().mockResolvedValue(null)
      },
      $transaction: jest.fn((callback) => callback(tx))
    };
    const generatedEmail = { id: 'mail_generated', leadId: lead.id, body: '案件固有の生成本文', status: 'draft' };
    const generateMailDraft = {
      execute: jest.fn().mockResolvedValue({ email: generatedEmail })
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
      generateMailDraft as any
    );

    return { service, prisma, tx, generateMailDraft, generatedEmail };
  };

  it('keeps the manual draft path and never saves the legacy TODO body', async () => {
    const { service, tx, generateMailDraft } = createService();

    await expect(service.createDraft({ leadId: lead.id, templateKey: 'normal', manualInstruction: '手動で作成した本文' })).resolves.toMatchObject({
      id: 'mail_manual',
      status: 'draft'
    });

    expect(generateMailDraft.execute).not.toHaveBeenCalled();
    expect(tx.outreachEmail.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          body: '手動で作成した本文',
          status: 'draft'
        })
      })
    );
    expect(tx.outreachEmail.create.mock.calls[0][0].data.body).not.toBe('TODO: AI-generated draft body will be inserted here.');
  });

  it('returns only the generated OutreachEmail when manual instruction is omitted', async () => {
    const { service, prisma, generateMailDraft, generatedEmail } = createService();

    await expect(service.createDraft({ leadId: lead.id, templateKey: 'normal' })).resolves.toBe(generatedEmail);

    expect(generateMailDraft.execute).toHaveBeenCalledWith(lead.id, { templateKey: 'normal' });
    expect(prisma.salesLead.findUnique).not.toHaveBeenCalled();
  });

  it('uses the generated draft path for an empty manual instruction', async () => {
    const { service, generateMailDraft } = createService();

    await service.createDraft({ leadId: lead.id, templateKey: 'normal', manualInstruction: '' });

    expect(generateMailDraft.execute).toHaveBeenCalledWith(lead.id, { templateKey: 'normal' });
  });

  it('uses the generated draft path for a whitespace-only manual instruction', async () => {
    const { service, generateMailDraft } = createService();

    await service.createDraft({ leadId: lead.id, templateKey: 'normal', manualInstruction: '  \n  ' });

    expect(generateMailDraft.execute).toHaveBeenCalledWith(lead.id, { templateKey: 'normal' });
  });

  it('keeps the lead not found behavior for manual drafts', async () => {
    const { service, prisma, generateMailDraft } = createService();
    prisma.salesLead.findUnique.mockResolvedValue(null);

    await expect(service.createDraft({ leadId: lead.id, templateKey: 'normal', manualInstruction: '手動本文' })).rejects.toThrow(NotFoundException);

    expect(generateMailDraft.execute).not.toHaveBeenCalled();
  });

  it('keeps the existing mail conflict behavior for manual drafts', async () => {
    const { service, prisma, generateMailDraft } = createService();
    prisma.outreachEmail.findFirst.mockResolvedValue({ id: 'mail_existing' });

    await expect(service.createDraft({ leadId: lead.id, templateKey: 'normal', manualInstruction: '手動本文' })).rejects.toThrow(ConflictException);

    expect(generateMailDraft.execute).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
