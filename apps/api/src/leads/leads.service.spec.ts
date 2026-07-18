import { BadRequestException, ConflictException } from '@nestjs/common';
import { LeadsService } from './leads.service';

describe('LeadsService detail editing', () => {
  const existingLead = {
    id: 'lead-1',
    companyId: 'company-1',
    projectId: 'project-1',
    company: { id: 'company-1', name: '旧会社名' },
    project: {
      id: 'project-1',
      title: '旧案件名',
      url: 'https://camp-fire.jp/projects/123/view',
      platform: { type: 'campfire' }
    }
  };

  function setup(lead: any = existingLead) {
    const tx = {
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
      company: { update: jest.fn().mockResolvedValue({ id: 'company-1' }) },
      crowdfundingPlatform: { upsert: jest.fn().mockResolvedValue({ id: 'platform-1' }) },
      crowdfundingProject: { update: jest.fn().mockResolvedValue({ id: 'project-1' }) },
      salesLead: {
        findUnique: jest.fn().mockResolvedValue(lead),
        update: jest.fn().mockResolvedValue({
          ...lead,
          brandAnalysisMemo: '人が入力した分析メモ',
          snsAnalysisMemo: '人が入力したSNSメモ'
        })
      }
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx))
    };
    return { service: new LeadsService(prisma as any, {} as any), prisma, tx };
  }

  it('updates company, project, and lead fields in one transaction without changing scrapedAt', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-16T00:00:00.000Z'));
    const { service, prisma, tx } = setup();

    const result = await service.update('lead-1', {
      companyName: ' 新会社名 ',
      companyWebsiteUrl: 'https://company.example.com',
      companyLocation: '東京',
      companySourceProjectCount: 4,
      projectSource: 'campfire',
      projectTitle: '新案件名',
      projectUrl: 'https://camp-fire.jp/projects/456/view?ref=test',
      projectAmount: 0,
      projectSupporterCount: 12,
      projectTargetAmount: 0,
      projectEndDate: '2026-07-20T00:00:00.000Z',
      projectLocation: '神奈川',
      nextActionAt: '2026-07-17T01:00:00.000Z',
      nextFollowUpAt: '2026-07-19T02:00:00.000Z',
      leadReason: '手動確認済み',
      brandAnalysisMemo: '人が入力した分析メモ',
      snsAnalysisMemo: '人が入力したSNSメモ'
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.company.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ name: '新会社名', normalizedName: '新会社名', location: '東京', sourceProjectCount: 4 })
    }));
    expect(tx.crowdfundingProject.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        title: '新案件名',
        url: 'https://camp-fire.jp/projects/456/view?ref=test',
        amount: 0,
        supporterCount: 12,
        targetAmount: 0,
        daysLeft: 4,
        location: '神奈川'
      })
    }));
    expect(tx.crowdfundingProject.update.mock.calls[0][0].data).not.toHaveProperty('scrapedAt');
    expect(tx.salesLead.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        reason: '手動確認済み',
        nextActionAt: new Date('2026-07-17T01:00:00.000Z'),
        nextFollowUpAt: new Date('2026-07-19T02:00:00.000Z'),
        brandAnalysisMemo: '人が入力した分析メモ'
      })
    }));
    expect(result.brandAnalysisMemo).toBe('人が入力した分析メモ');
    expect(tx.$executeRawUnsafe).toHaveBeenNthCalledWith(
      1,
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      'lead-detail:lead-1'
    );
    jest.useRealTimers();
  });

  it('uses explicit null to clear optional values while preserving numeric zero', async () => {
    const { service, tx } = setup();

    await service.update('lead-1', {
      companyWebsiteUrl: null,
      companySourceTotalAmount: null,
      projectTargetAmount: null,
      projectEndDate: null,
      projectCategory: null,
      contactEmail: null,
      ownerMemo: null,
      nextActionAt: null,
      nextFollowUpAt: null
    });

    expect(tx.company.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ websiteUrl: null, sourceTotalAmount: null })
    }));
    expect(tx.crowdfundingProject.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ targetAmount: null, endDate: null, daysLeft: null, category: null })
    }));
    expect(tx.salesLead.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ contactEmail: null, ownerMemo: null, nextActionAt: null, nextFollowUpAt: null })
    }));
  });

  it('rejects project edits when the lead has no linked project', async () => {
    const { service, prisma, tx } = setup({
      ...existingLead,
      projectId: null,
      project: null
    });

    await expect(service.update('lead-1', { projectTitle: '保存されない案件名' })).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.company.update).not.toHaveBeenCalled();
    expect(tx.crowdfundingProject.update).not.toHaveBeenCalled();
    expect(tx.salesLead.update).not.toHaveBeenCalled();
  });

  it('rejects a project source that does not match the project URL', async () => {
    const { service, prisma, tx } = setup();

    await expect(service.update('lead-1', {
      projectSource: 'makuake',
      projectUrl: 'https://camp-fire.jp/projects/456/view'
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.crowdfundingProject.update).not.toHaveBeenCalled();
    expect(tx.salesLead.update).not.toHaveBeenCalled();
  });

  it('rebinds an other-source platform when only its query-based URL origin changes', async () => {
    const otherLead = {
      ...existingLead,
      project: {
        ...existingLead.project,
        url: 'https://old.example.com/project?id=123',
        platform: { type: 'other' }
      }
    };
    const { service, tx } = setup(otherLead);

    await service.update('lead-1', {
      projectUrl: 'https://new.example.com/project?id=123'
    });

    expect(tx.crowdfundingPlatform.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { type_baseUrl: { type: 'other', baseUrl: 'https://new.example.com' } }
    }));
    expect(tx.crowdfundingProject.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ url: 'https://new.example.com/project?id=123', platformId: 'platform-1' })
    }));
  });

  it('returns human-edited analysis memos without hiding them', async () => {
    const lead = {
      ...existingLead,
      brandAnalysisMemo: '米びつの鮮度について人が確認したメモ',
      snsAnalysisMemo: '人が修正したSNS案',
      scores: [],
      tasks: [],
      _count: { tasks: 0 }
    };
    const prisma = { salesLead: { findUnique: jest.fn().mockResolvedValue(lead) } };
    const service = new LeadsService(prisma as any, {} as any);

    await expect(service.get('lead-1')).resolves.toMatchObject({
      brandAnalysisMemo: lead.brandAnalysisMemo,
      snsAnalysisMemo: lead.snsAnalysisMemo
    });
    expect(prisma.salesLead.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      include: expect.objectContaining({
        company: expect.objectContaining({ include: expect.objectContaining({ contacts: expect.any(Object) }) }),
        mails: expect.objectContaining({ take: 1 })
      })
    }));
  });

  it('does not write the lead after a project update fails', async () => {
    const { service, tx } = setup();
    tx.crowdfundingProject.update.mockRejectedValue(new Error('project update failed'));

    await expect(service.update('lead-1', { projectTitle: '失敗する更新', ownerMemo: '保存しない' })).rejects.toThrow('project update failed');
    expect(tx.salesLead.update).not.toHaveBeenCalled();
  });
});
