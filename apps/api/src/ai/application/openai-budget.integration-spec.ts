import { PrismaClient } from '@prisma/client';
import { OpenAiBudgetService } from './openai-budget.service';

const testDatabaseUrl = requireTestDatabaseUrl();

describe('OpenAI budget guard integration', () => {
  let prisma: PrismaClient;
  let organizationId: string;
  const originalEnv = { ...process.env };
  const testModel = `openai-budget-test-${Date.now()}`;

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl } } });
    await prisma.$connect();
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const organization = await prisma.organization.create({
      data: { slug: `openai-budget-integration-${suffix}`, name: 'OpenAI budget integration' }
    });
    organizationId = organization.id;
  });

  afterAll(async () => {
    try {
      if (organizationId) {
        await prisma.aiUsageLedger.deleteMany({ where: { organizationId, model: testModel } });
        await prisma.organization.delete({ where: { id: organizationId } });
      }
    } finally {
      await prisma.$disconnect();
      process.env = { ...originalEnv };
    }
  });

  it('allows only one caller to reserve the final budget slot', async () => {
    process.env.OPENAI_MONTHLY_BUDGET_USD = '0.01';
    process.env.OPENAI_ESTIMATED_COST_PER_REQUEST_USD = '0.01';
    delete process.env.OPENAI_INPUT_COST_PER_1M;
    delete process.env.OPENAI_OUTPUT_COST_PER_1M;
    const service = new OpenAiBudgetService(prisma as any);
    const run = () => service.execute(
      { organizationId, model: testModel, operation: 'concurrency_test', requestInput: {}, maxOutputTokens: 100 },
      async () => ({ usage: { costUsd: 0.01 } })
    );

    const results = await Promise.allSettled([run(), run()]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(await prisma.aiUsageLedger.count({
      where: { organizationId, model: testModel, status: 'completed' }
    })).toBe(1);
  });
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
