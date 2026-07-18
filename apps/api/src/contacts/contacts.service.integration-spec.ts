import { PrismaClient } from '@prisma/client';
import { ContactsService } from './contacts.service';

const testDatabaseUrl = requireTestDatabaseUrl();

describe('ContactsService integration', () => {
  let prisma: PrismaClient;
  let service: ContactsService;
  let companyId: string;

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl } } });
    await prisma.$connect();
    const company = await prisma.company.create({
      data: { name: `連絡先テスト ${Date.now()}` }
    });
    companyId = company.id;
    service = new ContactsService(prisma as any);
  });

  afterAll(async () => {
    if (companyId) {
      await prisma.contactPerson.deleteMany({ where: { companyId } });
      await prisma.company.delete({ where: { id: companyId } });
    }
    await prisma.$disconnect();
  });

  it('keeps one primary contact under concurrent creates and preserves unsubscribe/archive state', async () => {
    const [first, second] = await Promise.all([
      service.create(companyId, { name: '第一担当', email: 'first@example.com', isPrimary: true }),
      service.create(companyId, { name: '第二担当', email: 'second@example.com', isPrimary: true })
    ]);

    let contacts = await service.listByCompany(companyId);
    expect(contacts).toHaveLength(2);
    expect(contacts.filter((contact) => contact.isPrimary)).toHaveLength(1);

    const primary = contacts.find((contact) => contact.isPrimary)!;
    await service.unsubscribe(primary.id);
    contacts = await service.listByCompany(companyId);
    expect(contacts.find((contact) => contact.id === primary.id)).toMatchObject({
      isPrimary: false,
      isUnsubscribed: true
    });

    const archiveId = primary.id === first.id ? second.id : first.id;
    await service.archive(archiveId);
    contacts = await service.listByCompany(companyId);
    expect(contacts.map((contact) => contact.id)).not.toContain(archiveId);
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
