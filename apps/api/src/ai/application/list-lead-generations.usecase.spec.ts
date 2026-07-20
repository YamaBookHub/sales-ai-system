import { NotFoundException } from '@nestjs/common';
import { ListLeadGenerationsUseCase } from './list-lead-generations.usecase';

describe('ListLeadGenerationsUseCase organization scope', () => {
  it('lists only generations from the requested organization', async () => {
    const prisma = {
      salesLead: { findFirst: jest.fn().mockResolvedValue({ id: 'lead_1' }) },
      aiGeneration: { findMany: jest.fn().mockResolvedValue([{ id: 'generation_1' }]) }
    };

    await expect(new ListLeadGenerationsUseCase(prisma as any).execute('lead_1', 'org_1')).resolves.toEqual({
      items: [{ id: 'generation_1' }],
      total: 1
    });
    expect(prisma.salesLead.findFirst).toHaveBeenCalledWith({ where: { id: 'lead_1', organizationId: 'org_1' }, select: { id: true } });
    expect(prisma.aiGeneration.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId: 'org_1', leadId: 'lead_1' }
    }));
  });

  it('returns not found without listing generations across organizations', async () => {
    const prisma = {
      salesLead: { findFirst: jest.fn().mockResolvedValue(null) },
      aiGeneration: { findMany: jest.fn() }
    };

    await expect(new ListLeadGenerationsUseCase(prisma as any).execute('lead_other', 'org_1')).rejects.toThrow(NotFoundException);
    expect(prisma.aiGeneration.findMany).not.toHaveBeenCalled();
  });
});
