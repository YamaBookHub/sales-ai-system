import { AnalyzeLeadUseCase } from './analyze-lead.usecase';

describe('AnalyzeLeadUseCase', () => {
  it('passes material engagement into the analysis input and output', async () => {
    const prisma = {
      salesLead: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'lead_1',
          reason: '資料を確認',
          company: { name: 'テスト株式会社' },
          project: { title: 'テスト商品', platform: { name: 'CAMPFIRE', type: 'campfire' }, description: '商品説明' }
        })
      },
      trackedLink: {
        findMany: jest.fn().mockResolvedValue([
          {
            clicks: [
              { clickedAt: new Date('2026-07-12T04:00:00.000Z') },
              { clickedAt: new Date('2026-07-12T03:00:00.000Z') },
              { clickedAt: new Date('2026-07-12T02:00:00.000Z') }
            ]
          }
        ])
      },
      aiGeneration: {
        create: jest.fn().mockResolvedValue({ id: 'generation_1' })
      }
    };
    const useCase = new AnalyzeLeadUseCase(prisma as any);

    const result = await useCase.execute('lead_1');

    expect(prisma.trackedLink.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { email: { leadId: 'lead_1' }, label: 'company_material' }
    }));
    expect(result.output.materialEngagement).toMatchObject({
      materialViewed: true,
      materialClickCount: 3,
      appointmentAngle: 'hot'
    });
    expect(prisma.aiGeneration.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        inputJson: expect.objectContaining({
          materialEngagement: expect.objectContaining({ materialClickCount: 3 })
        })
      })
    }));
  });
});
