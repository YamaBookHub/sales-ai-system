import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContactDto, UpdateContactDto } from './contacts.dto';
import { AuditActor } from '../audit/audit-actor';

type ContactTransaction = Prisma.TransactionClient;

const activeContactWhere = { deletedAt: null };

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  async listByCompany(companyId: string, organizationId: string) {
    await this.getActiveCompany(this.prisma, companyId, organizationId);
    return this.prisma.contactPerson.findMany({
      where: { organizationId, companyId, ...activeContactWhere },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }]
    });
  }

  async create(companyId: string, dto: CreateContactDto, actor: AuditActor) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockCompanyContacts(tx, actor.organizationId, companyId);
      await this.getActiveCompany(tx, companyId, actor.organizationId);

      if (dto.isPrimary === true) {
        await this.clearOtherPrimaryContacts(tx, actor.organizationId, companyId);
      }

      const data: Prisma.ContactPersonUncheckedCreateInput = {
        organizationId: actor.organizationId,
        companyId,
        ...contactFields(dto),
        isPrimary: dto.isPrimary === true,
        isUnsubscribed: false,
        unsubscribedAt: null
      };

      const contact = await tx.contactPerson.create({ data });
      await recordContactAudit(tx, actor, 'contact.created', contact.id, null, {
        companyId: contact.companyId,
        isPrimary: contact.isPrimary,
        isUnsubscribed: contact.isUnsubscribed
      });
      return contact;
    });
  }

  async update(id: string, dto: UpdateContactDto, actor: AuditActor) {
    return this.prisma.$transaction(async (tx) => {
      const snapshot = await this.getActiveContact(tx, id, actor.organizationId);
      await this.lockCompanyContacts(tx, actor.organizationId, snapshot.companyId);
      const contact = await this.getActiveContact(tx, id, actor.organizationId);
      const nextIsUnsubscribed = hasOwn(dto, 'isUnsubscribed')
        ? dto.isUnsubscribed === true
        : contact.isUnsubscribed;
      const makePrimary = dto.isPrimary === true && !nextIsUnsubscribed;

      if (makePrimary) {
        await this.clearOtherPrimaryContacts(tx, actor.organizationId, contact.companyId, id);
      }

      const data: Prisma.ContactPersonUpdateInput = {
        ...contactFields(dto)
      };

      if (hasOwn(dto, 'isPrimary')) {
        data.isPrimary = makePrimary;
      }

      if (hasOwn(dto, 'isUnsubscribed')) {
        data.isUnsubscribed = nextIsUnsubscribed;
        data.unsubscribedAt = nextIsUnsubscribed ? new Date() : null;
        if (nextIsUnsubscribed) data.isPrimary = false;
      }

      const updated = await tx.contactPerson.update({
        where: { organizationId_id: { organizationId: actor.organizationId, id } },
        data
      });
      await recordContactAudit(tx, actor, 'contact.updated', id, contactAuditSnapshot(contact), {
        ...contactAuditSnapshot(updated),
        changedFields: Object.keys(data).sort()
      });
      return updated;
    });
  }

  async archive(id: string, actor: AuditActor) {
    return this.prisma.$transaction(async (tx) => {
      const snapshot = await this.getActiveContact(tx, id, actor.organizationId);
      await this.lockCompanyContacts(tx, actor.organizationId, snapshot.companyId);
      await this.getActiveContact(tx, id, actor.organizationId);
      const archived = await tx.contactPerson.update({
        where: { organizationId_id: { organizationId: actor.organizationId, id } },
        data: { deletedAt: new Date(), isPrimary: false }
      });
      await recordContactAudit(tx, actor, 'contact.archived', id, contactAuditSnapshot(snapshot), {
        ...contactAuditSnapshot(archived),
        isArchived: true,
        changedFields: ['deletedAt', 'isPrimary']
      });
      return archived;
    });
  }

  async unsubscribe(id: string, actor: AuditActor) {
    return this.prisma.$transaction(async (tx) => {
      const snapshot = await this.getActiveContact(tx, id, actor.organizationId);
      await this.lockCompanyContacts(tx, actor.organizationId, snapshot.companyId);
      await this.getActiveContact(tx, id, actor.organizationId);
      const contact = await tx.contactPerson.update({
        where: { organizationId_id: { organizationId: actor.organizationId, id } },
        data: {
          isUnsubscribed: true,
          unsubscribedAt: new Date(),
          isPrimary: false
        }
      });
      await recordContactAudit(tx, actor, 'contact.unsubscribed', id, contactAuditSnapshot(snapshot), {
        ...contactAuditSnapshot(contact),
        changedFields: ['isPrimary', 'isUnsubscribed', 'unsubscribedAt']
      });
      return contact;
    });
  }

  private async getActiveCompany(
    client: Pick<PrismaService, 'company'> | ContactTransaction,
    companyId: string,
    organizationId: string
  ) {
    const company = await client.company.findFirst({ where: { id: companyId, organizationId, deletedAt: null } });
    if (!company) throw new NotFoundException('企業が見つかりません。');
    return company;
  }

  private async getActiveContact(client: ContactTransaction, id: string, organizationId: string) {
    const contact = await client.contactPerson.findFirst({ where: { id, organizationId, ...activeContactWhere } });
    if (!contact) throw new NotFoundException('連絡先が見つかりません。');
    return contact;
  }

  private lockCompanyContacts(client: ContactTransaction, organizationId: string, companyId: string) {
    return client.$executeRawUnsafe(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      `company-contacts:${organizationId}:${companyId}`
    );
  }

  private clearOtherPrimaryContacts(client: ContactTransaction, organizationId: string, companyId: string, exceptId?: string) {
    return client.contactPerson.updateMany({
      where: {
        organizationId,
        companyId,
        ...activeContactWhere,
        isPrimary: true,
        ...(exceptId ? { id: { not: exceptId } } : {})
      },
      data: { isPrimary: false }
    });
  }
}

function contactAuditSnapshot(contact: {
  companyId: string;
  isPrimary: boolean;
  isUnsubscribed: boolean;
  deletedAt?: Date | null;
}) {
  return {
    companyId: contact.companyId,
    isPrimary: contact.isPrimary,
    isUnsubscribed: contact.isUnsubscribed,
    isArchived: Boolean(contact.deletedAt)
  };
}

async function recordContactAudit(
  tx: ContactTransaction,
  actor: AuditActor | undefined,
  action: string,
  contactId: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown>
) {
  if (!actor) return;
  await tx.auditLog.create({
    data: {
      ...actor,
      action,
      entityType: 'ContactPerson',
      entityId: contactId,
      before: before ? (before as Prisma.InputJsonObject) : Prisma.DbNull,
      after: after as Prisma.InputJsonObject
    }
  });
}

function hasOwn(input: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(input, key);
}

type ContactFieldInput = Pick<Prisma.ContactPersonUncheckedCreateInput, 'name' | 'email' | 'inquiryUrl' | 'roleTitle'>;

function contactFields(dto: CreateContactDto | UpdateContactDto): ContactFieldInput {
  const data: ContactFieldInput = {};

  for (const key of ['name', 'email', 'inquiryUrl', 'roleTitle'] as const) {
    if (!hasOwn(dto, key)) continue;
    const value = dto[key];
    if (typeof value === 'string' && value.trim().length === 0 && key === 'name') {
      throw new BadRequestException('Contact name must not be blank.');
    }
    data[key] = typeof value === 'string' ? value.trim() : null;
  }

  return data;
}
