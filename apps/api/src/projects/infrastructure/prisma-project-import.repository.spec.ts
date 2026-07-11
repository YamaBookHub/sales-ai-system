import { NormalizedImportedProject } from '../domain/project-source-provider';
import { PrismaProjectImportRepository } from './prisma-project-import.repository';

describe('PrismaProjectImportRepository', () => {
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

    const urls = await repository.existingProjectUrls('https://camp-fire.jp');

    expect(prisma.crowdfundingProject.findMany).toHaveBeenCalledWith({
      where: { platform: { baseUrl: 'https://camp-fire.jp' } },
      select: { url: true }
    });
    expect(urls.has('https://camp-fire.jp/projects/test/view')).toBe(true);
    expect(urls.has('https://camp-fire.jp/projects/other/view')).toBe(true);
  });

  it('resolves operator email to an active user', async () => {
    const prisma = {
      user: {
        upsert: jest.fn().mockResolvedValue({ id: 'user-1' })
      }
    };
    const repository = new PrismaProjectImportRepository(prisma as any);

    await expect(repository.resolveActorUserId({ operatorEmail: ' USER@example.COM ', operatorName: 'User' })).resolves.toBe('user-1');
    expect(prisma.user.upsert).toHaveBeenCalledWith({
      where: { email: 'user@example.com' },
      update: { isActive: true },
      create: { email: 'user@example.com', name: 'User', role: 'operator' }
    });
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
      auditLog: {
        create: jest.fn()
      }
    };
    const prisma = {
      $transaction: jest.fn(async (callback) => callback(tx))
    };
    const repository = new PrismaProjectImportRepository(prisma as any);

    const result = await repository.persistImportedProject(imported, { bulk: true, userId: 'user-1' });

    expect(result.lead.id).toBe('lead-1');
    expect(tx.company.update).toHaveBeenCalledWith({
      where: { id: 'company-1' },
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
        action: 'projects.bulk_import.item',
        userId: 'user-1',
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

    await repository.recordBulkImportAudit('user-1', {
      source: 'campfire',
      total: 3,
      imported: 2,
      failed: 1,
      analyzed: 2,
      analysisFailed: 0
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        action: 'projects.bulk_import',
        userId: 'user-1',
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
