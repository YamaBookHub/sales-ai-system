import { NotFoundException } from '@nestjs/common';
import { ContactsService } from './contacts.service';

describe('ContactsService', () => {
  const organizationId = 'organization-1';
  const actor = { userId: 'user-1', sessionId: 'session-1', organizationId };
  const company = { id: 'company-1', name: '株式会社テスト', deletedAt: null };
  const activeContact = {
    id: 'contact-1',
    companyId: company.id,
    name: '山田 太郎',
    email: 'yamada@example.com',
    inquiryUrl: null,
    roleTitle: '営業部',
    isPrimary: true,
    isUnsubscribed: false,
    unsubscribedAt: null,
    deletedAt: null
  };

  function setup() {
    const tx = {
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
      company: { findFirst: jest.fn().mockResolvedValue(company) },
      contactPerson: {
        findFirst: jest.fn().mockResolvedValue(activeContact),
        findMany: jest.fn().mockResolvedValue([activeContact]),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'contact-2', ...data })),
        update: jest.fn().mockImplementation(({ where, data }) => Promise.resolve({ ...activeContact, ...data, id: where.id })),
        updateMany: jest.fn().mockResolvedValue({ count: 1 })
      },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) }
    };
    const prisma = {
      company: tx.company,
      contactPerson: tx.contactPerson,
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx))
    };
    return { service: new ContactsService(prisma as any), prisma, tx };
  }

  it('lists only active contacts after confirming the company exists', async () => {
    const { service, prisma } = setup();

    await expect(service.listByCompany(company.id, organizationId)).resolves.toEqual([activeContact]);
    expect(prisma.company.findFirst).toHaveBeenCalledWith({ where: { id: company.id, organizationId, deletedAt: null } });
    expect(prisma.contactPerson.findMany).toHaveBeenCalledWith({
      where: { organizationId, companyId: company.id, deletedAt: null },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }]
    });
  });

  it('creates a primary contact after clearing other active primary contacts in the same transaction', async () => {
    const { service, prisma, tx } = setup();

    await expect(service.create(company.id, {
      name: ' 鈴木 花子 ',
      email: 'hanako@example.com',
      isPrimary: true
    }, actor)).resolves.toMatchObject({ id: 'contact-2', name: '鈴木 花子', isPrimary: true });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.$executeRawUnsafe).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      'company-contacts:organization-1:company-1'
    );
    expect(tx.contactPerson.updateMany).toHaveBeenCalledWith({
      where: { organizationId, companyId: company.id, deletedAt: null, isPrimary: true },
      data: { isPrimary: false }
    });
    expect(tx.contactPerson.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId,
        companyId: company.id,
        name: '鈴木 花子',
        email: 'hanako@example.com',
        isPrimary: true,
        isUnsubscribed: false,
        unsubscribedAt: null
      })
    });
  });

  it('returns 404 when the target company is absent', async () => {
    const { service, tx } = setup();
    tx.company.findFirst.mockResolvedValue(null);

    await expect(service.create('missing-company', { name: '担当者' }, actor)).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.contactPerson.create).not.toHaveBeenCalled();
  });

  it('updates nullable fields and keeps the selected primary contact unique', async () => {
    const { service, tx } = setup();

    await service.update(activeContact.id, {
      name: null,
      email: null,
      inquiryUrl: 'https://example.com/inquiry',
      isPrimary: true
    }, actor);

    expect(tx.contactPerson.updateMany).toHaveBeenCalledWith({
      where: {
        organizationId,
        companyId: company.id,
        deletedAt: null,
        isPrimary: true,
        id: { not: activeContact.id }
      },
      data: { isPrimary: false }
    });
    expect(tx.contactPerson.update).toHaveBeenCalledWith({
      where: { organizationId_id: { organizationId, id: activeContact.id } },
      data: {
        name: null,
        email: null,
        inquiryUrl: 'https://example.com/inquiry',
        isPrimary: true
      }
    });
  });

  it('unsubscribes a contact and clears its primary flag', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-17T01:02:03.000Z'));
    const { service, tx } = setup();

    await service.unsubscribe(activeContact.id, actor);

    expect(tx.contactPerson.update).toHaveBeenCalledWith({
      where: { organizationId_id: { organizationId, id: activeContact.id } },
      data: {
        isUnsubscribed: true,
        unsubscribedAt: new Date('2026-07-17T01:02:03.000Z'),
        isPrimary: false
      }
    });
    jest.useRealTimers();
  });

  it('writes only safe contact state and the authenticated session to the audit log', async () => {
    const { service, tx } = setup();

    await service.update(activeContact.id, { email: 'changed@example.com', inquiryUrl: 'https://example.com/contact' }, {
      userId: 'user-1',
      sessionId: 'session-1',
      organizationId
    });

    const audit = tx.auditLog.create.mock.calls[0][0].data;
    expect(audit).toMatchObject({
      userId: 'user-1',
      sessionId: 'session-1',
      action: 'contact.updated',
      entityType: 'ContactPerson',
      entityId: activeContact.id
    });
    expect(audit.after).toEqual(expect.objectContaining({ changedFields: ['email', 'inquiryUrl'] }));
    expect(JSON.stringify(audit)).not.toContain('changed@example.com');
    expect(JSON.stringify(audit)).not.toContain('https://example.com/contact');
  });

  it('allows PATCH to restore delivery eligibility while keeping unsubscribe timestamps consistent', async () => {
    const { service, tx } = setup();
    tx.contactPerson.findFirst.mockResolvedValue({ ...activeContact, isUnsubscribed: true, unsubscribedAt: new Date() });

    await service.update(activeContact.id, { isUnsubscribed: false, isPrimary: true }, actor);

    expect(tx.contactPerson.updateMany).toHaveBeenCalled();
    expect(tx.contactPerson.update).toHaveBeenCalledWith({
      where: { organizationId_id: { organizationId, id: activeContact.id } },
      data: {
        isPrimary: true,
        isUnsubscribed: false,
        unsubscribedAt: null
      }
    });
  });

  it('archives an active contact and rejects later updates as not found', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-17T02:03:04.000Z'));
    const { service, tx } = setup();

    await service.archive(activeContact.id, actor);
    expect(tx.contactPerson.update).toHaveBeenCalledWith({
      where: { organizationId_id: { organizationId, id: activeContact.id } },
      data: { deletedAt: new Date('2026-07-17T02:03:04.000Z'), isPrimary: false }
    });

    tx.contactPerson.findFirst.mockResolvedValue(null);
    await expect(service.update(activeContact.id, { roleTitle: '更新不可' }, actor)).rejects.toBeInstanceOf(NotFoundException);
    jest.useRealTimers();
  });
});
