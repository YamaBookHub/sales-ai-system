import { PrismaClient } from '@prisma/client';
import { AnalyzeLeadUseCase } from './analyze-lead.usecase';
import { GenerateMailDraftUseCase } from './generate-mail-draft.usecase';
import { LeadAnalysisUseCase } from './lead-analysis.usecase';

const testDatabaseUrl = requireTestDatabaseUrl();

describe('structured lead analysis integration', () => {
  let prisma: PrismaClient;
  const companyIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl } } });
    await prisma.$connect();
  });

  afterAll(async () => {
    if (companyIds.length) {
      await prisma.emailEvent.deleteMany({ where: { email: { companyId: { in: companyIds } } } });
      await prisma.aiGeneration.deleteMany({ where: { lead: { companyId: { in: companyIds } } } });
      await prisma.outreachEmail.deleteMany({ where: { companyId: { in: companyIds } } });
      await prisma.contactPerson.deleteMany({ where: { companyId: { in: companyIds } } });
      await prisma.salesLead.deleteMany({ where: { companyId: { in: companyIds } } });
      await prisma.crowdfundingProject.deleteMany({ where: { companyId: { in: companyIds } } });
      await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
    }
    await prisma.$disconnect();
  });

  it('analyzes, confirms, and pins the exact revision to a generated draft', async () => {
    const fixture = await createFixture('end-to-end');
    const analysisUseCase = new LeadAnalysisUseCase(prisma as any);
    const analyzed = await new AnalyzeLeadUseCase(prisma as any).execute(fixture.leadId);
    const view = await analysisUseCase.get(fixture.leadId);

    expect(view.proposal).toMatchObject({ id: analyzed.analysisRevisionId, version: 1, status: 'draft' });
    expect(view.canGenerateMail).toBe(false);

    const confirmedView = await analysisUseCase.confirm(fixture.leadId, {
      expectedVersion: view.proposal!.version,
      expectedSourceFingerprint: view.sourceFingerprint,
      appeal: '真空保存で食品の鮮度を保ちやすい点',
      targetUser: '食品の保存状態と収納性を重視する方',
      videoIdea: '真空になる様子と収納前後を短尺動画で比較する'
    });
    const confirmed = confirmedView.confirmed!;

    expect(confirmedView.canGenerateMail).toBe(true);
    expect(confirmed).toMatchObject({ version: 2, status: 'confirmed', humanEdited: true });

    const generated = await new GenerateMailDraftUseCase(prisma as any).execute(fixture.leadId, {
      templateKey: 'normal',
      analysisRevisionId: confirmed.id
    });
    const storedMail = await prisma.outreachEmail.findUniqueOrThrow({ where: { id: generated.email.id } });

    expect(storedMail.analysisRevisionId).toBe(confirmed.id);
    expect(storedMail.status).toBe('draft');
    expect(storedMail.body).toContain('真空保存で食品の鮮度を保ちやすい点');
    expect(storedMail.body).toContain('食品の保存状態と収納性を重視する方');
    expect(storedMail.body).toContain('真空になる様子と収納前後を短尺動画で比較する');
  });

  it('rejects stale project data without creating mail or advancing the lead', async () => {
    const fixture = await createFixture('stale');
    const analysisUseCase = new LeadAnalysisUseCase(prisma as any);
    await new AnalyzeLeadUseCase(prisma as any).execute(fixture.leadId);
    const draft = await analysisUseCase.get(fixture.leadId);
    const confirmedView = await analysisUseCase.confirm(fixture.leadId, {
      expectedVersion: draft.proposal!.version,
      expectedSourceFingerprint: draft.sourceFingerprint,
      appeal: '扱いやすい保存用品である点',
      targetUser: '食品保存を見直したい方',
      videoIdea: '保存手順を短尺動画で見せる'
    });
    await prisma.crowdfundingProject.update({
      where: { id: fixture.projectId },
      data: { description: '案件情報が更新された後の説明' }
    });

    await expect(new GenerateMailDraftUseCase(prisma as any).execute(fixture.leadId, {
      templateKey: 'normal',
      analysisRevisionId: confirmedView.confirmed!.id
    })).rejects.toThrow('確認済みの最新分析');

    expect(await prisma.outreachEmail.count({ where: { leadId: fixture.leadId } })).toBe(0);
    expect((await prisma.salesLead.findUniqueOrThrow({ where: { id: fixture.leadId } })).status).toBe('qualified');
  });

  it('allows only one append when two editors save the same version concurrently', async () => {
    const fixture = await createFixture('concurrent');
    const analysisUseCase = new LeadAnalysisUseCase(prisma as any);
    await new AnalyzeLeadUseCase(prisma as any).execute(fixture.leadId);
    const view = await analysisUseCase.get(fixture.leadId);
    const request = {
      expectedVersion: view.proposal!.version,
      expectedSourceFingerprint: view.sourceFingerprint,
      appeal: '同時編集を確認する魅力',
      targetUser: '同時編集を確認する対象者',
      videoIdea: '同時編集を確認する動画案'
    };

    const results = await Promise.allSettled([
      analysisUseCase.save(fixture.leadId, request),
      analysisUseCase.save(fixture.leadId, request)
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(await prisma.leadAnalysisRevision.count({ where: { leadId: fixture.leadId } })).toBe(2);
  });

  async function createFixture(label: string) {
    const suffix = `${label}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const platform = await prisma.crowdfundingPlatform.upsert({
      where: { type_baseUrl: { type: 'campfire', baseUrl: 'https://camp-fire.jp' } },
      update: { isActive: true },
      create: { type: 'campfire', name: 'CAMPFIRE', baseUrl: 'https://camp-fire.jp' }
    });
    const company = await prisma.company.create({ data: { name: `分析テスト ${suffix}` } });
    companyIds.push(company.id);
    await prisma.contactPerson.create({
      data: { companyId: company.id, email: `${suffix}@example.com`, isPrimary: true }
    });
    const project = await prisma.crowdfundingProject.create({
      data: {
        platformId: platform.id,
        companyId: company.id,
        title: `真空保存用品 ${suffix}`,
        url: `https://camp-fire.jp/projects/${suffix}/view`,
        status: 'active',
        category: 'キッチン',
        description: '食品を真空で分けて保存できる用品です。'
      }
    });
    const lead = await prisma.salesLead.create({
      data: { companyId: company.id, projectId: project.id, status: 'qualified', sendMethod: 'email' }
    });
    return { companyId: company.id, projectId: project.id, leadId: lead.id };
  }
});

function requireTestDatabaseUrl() {
  const value = process.env.TEST_DATABASE_URL;
  if (!value) throw new Error('TEST_DATABASE_URL is required. Run this suite with npm run test:integration.');
  const database = new URL(value).pathname.replace(/^\//, '');
  if (!/(^|[_-])test($|[_-])/i.test(database)) {
    throw new Error(`Refusing integration test against non-test database: ${database || '(empty)'}`);
  }
  return value;
}
