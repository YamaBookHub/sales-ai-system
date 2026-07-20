import { NormalizedImportedProject } from '../domain/project-source-provider';
import { PrismaProjectImportRepository } from './prisma-project-import.repository';

describe('PrismaProjectImportRepository', () => {
  const organizationId = 'organization-1';
  const imported: NormalizedImportedProject = {
    source: 'campfire',
    platform: {
      type: 'campfire',
      name: 'CAMPFIRE',
      baseUrl: 'https://camp-fire.jp'
    },
    company: {
      name: 'テスト食品株式会社',
      websiteUrl: 'https://brand.example.com',
      inquiryUrl: 'https://brand.example.com/contact',
      location: '東京',
      sourceTotalAmount: 1000000,
      sourceProjectCount: 2,
      sourceSupporterCount: 120,
      memo: 'imported memo'
    },
    project: {
      title: '職人仕込みのスモークサーモン',
      url: 'https://camp-fire.jp/projects/test/view',
      status: 'active',
      amount: 1200000,
      supporterCount: 120,
      daysLeft: 7,
      description: '伏流水で仕込んだスモークサーモンです。',
      category: '食品',
      location: '東京',
      thumbnailUrl: 'https://example.com/thumb.jpg',
      scrapedAt: new Date('2026-07-11T00:00:00.000Z')
    },
    lead: {
      source: 'campfire',
      reason: '食品カテゴリの注目案件',
      contactFormUrl: 'https://brand.example.com/contact',
      brandWebsiteUrl: 'https://brand.example.com',
      instagramUrl: 'https://instagram.com/example',
      contactMemo: 'フォームあり',
      brandAnalysisMemo: '食卓で楽しめる点が強み'
    },
    raw: { ok: true }
  };

  it('normalizes existing project URLs from Prisma results', async () => {
    const prisma = {
      crowdfundingProject: {
        findMany: jest.fn().mockResolvedValue([
          { url: 'https://camp-fire.jp/projects/test/view?utm=1#top' },
          { url: 'https://camp-fire.jp/projects/other/view/' }
        ])
      }
    };
    const repository = new PrismaProjectImportRepository(prisma as any);

    const urls = await repository.existingProjectUrls(organizationId, 'https://camp-fire.jp');

    expect(prisma.crowdfundingProject.findMany).toHaveBeenCalledWith({
      where: { organizationId, platform: { baseUrl: 'https://camp-fire.jp' } },
      select: { url: true }
    });
    expect(urls.has('https://camp-fire.jp/projects/test/view')).toBe(true);
    expect(urls.has('https://camp-fire.jp/projects/other/view')).toBe(true);
  });

  it('persists imported project while preserving existing lead contact fields', async () => {
    const tx = {
      $executeRawUnsafe: jest.fn(),
      crowdfundingPlatform: {
        upsert: jest.fn().mockResolvedValue({ id: 'platform-1', name: 'CAMPFIRE' })
      },
      company: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'company-1',
          websiteUrl: 'https://existing.example.com',
          inquiryUrl: null,
          location: null,
          sourceTotalAmount: null,
          sourceProjectCount: null,
          sourceSupporterCount: null,
          memo: ''
        }),
        update: jest.fn().mockResolvedValue({ id: 'company-1' }),
        create: jest.fn()
      },
      crowdfundingProject: {
        upsert: jest.fn().mockResolvedValue({ id: 'project-1' })
      },
      salesLead: {
        findMany: jest.fn().mockResolvedValue([{ id: 'lead-existing' }]),
        findFirst: jest.fn().mockResolvedValue({ id: 'lead-1', organizationId }),
        findUnique: jest.fn().mockResolvedValue({
          contactFormUrl: 'https://existing.example.com/contact',
          brandWebsiteUrl: 'https://existing.example.com',
          instagramUrl: null,
          tiktokUrl: null,
          xUrl: null,
          contactMemo: 'existing memo',
          brandAnalysisMemo: 'existing analysis'
        }),
        upsert: jest.fn().mockResolvedValue({ id: 'lead-1' })
      },
      opportunity: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'opportunity-1',
          leadId: 'lead-1',
          stage: 'uncontacted',
          probability: 0,
          version: 1
        })
      },
      opportunityStageHistory: {
        create: jest.fn().mockResolvedValue({ id: 'history-1' })
      },
      auditLog: {
        create: jest.fn()
      }
    };
    const prisma = {
      $transaction: jest.fn(async (callback) => callback(tx))
    };
    const repository = new PrismaProjectImportRepository(prisma as any);

    const actor = { userId: 'user-1', sessionId: 'session-1', organizationId };
    const result = await repository.persistImportedProject(organizationId, imported, { bulk: true, actor });

    expect(result.lead.id).toBe('lead-1');
    expect(tx.$executeRawUnsafe).toHaveBeenCalledTimes(4);
    expect(tx.$executeRawUnsafe).toHaveBeenNthCalledWith(1, 'SELECT pg_advisory_xact_lock(hashtext($1))', 'project-import:organization-1:company:テスト食品株式会社');
    expect(tx.$executeRawUnsafe).toHaveBeenNthCalledWith(2, 'SELECT pg_advisory_xact_lock(hashtext($1))', 'project-import:organization-1:project:https://camp-fire.jp/projects/test/view');
    expect(tx.$executeRawUnsafe).toHaveBeenNthCalledWith(3, 'SELECT pg_advisory_xact_lock(hashtext($1))', 'lead-analysis:organization-1:lead-existing');
    expect(tx.$executeRawUnsafe).toHaveBeenNthCalledWith(4, 'SELECT pg_advisory_xact_lock(hashtext($1))', 'opportunity:organization-1:lead-1');
    expect(tx.company.update).toHaveBeenCalledWith({
      where: { organizationId_id: { organizationId, id: 'company-1' } },
      data: expect.objectContaining({
        websiteUrl: 'https://existing.example.com',
        inquiryUrl: 'https://brand.example.com/contact'
      })
    });
    expect(tx.salesLead.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({
        contactFormUrl: 'https://existing.example.com/contact',
        brandWebsiteUrl: 'https://existing.example.com',
        contactMemo: 'existing memo',
        brandAnalysisMemo: 'existing analysis'
      })
    }));
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId,
        action: 'projects.bulk_import.item',
        userId: 'user-1',
        sessionId: 'session-1',
        entityType: 'SalesLead',
        entityId: 'lead-1'
      })
    });
  });

  it('records bulk import audit summary', async () => {
    const prisma = {
      auditLog: {
        create: jest.fn()
      }
    };
    const repository = new PrismaProjectImportRepository(prisma as any);

    await repository.recordBulkImportAudit(organizationId, { userId: 'user-1', sessionId: 'session-1', organizationId }, {
      source: 'campfire',
      total: 3,
      imported: 2,
      failed: 1,
      analyzed: 2,
      analysisFailed: 0
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        organizationId,
        action: 'projects.bulk_import',
        userId: 'user-1',
        sessionId: 'session-1',
        entityType: 'Project',
        after: {
          source: 'campfire',
          requested: 3,
          imported: 2,
          failed: 1,
          analyzed: 2,
          analysisFailed: 0
        }
      }
    });
  });
});
