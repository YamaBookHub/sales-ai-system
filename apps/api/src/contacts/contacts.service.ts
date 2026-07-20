import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContactDto, UpdateContactDto } from './contacts.dto';

type ContactTransaction = Prisma.TransactionClient;

const activeContactWhere = { deletedAt: null };

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  async listByCompany(companyId: string) {
    await this.getActiveCompany(this.prisma, companyId);
    return this.prisma.contactPerson.findMany({
      where: { companyId, ...activeContactWhere },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }]
    });
  }

  async create(companyId: string, dto: CreateContactDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockCompanyContacts(tx, companyId);
      await this.getActiveCompany(tx, companyId);

      if (dto.isPrimary === true) {
        await this.clearOtherPrimaryContacts(tx, companyId);
      }

      const data: Prisma.ContactPersonUncheckedCreateInput = {
          companyId,
          ...contactFields(dto),
          isPrimary: dto.isPrimary === true,
          isUnsubscribed: false,
          unsubscribedAt: null
      };

      return tx.contactPerson.create({ data });
    });
  }

  async update(id: string, dto: UpdateContactDto) {
    return this.prisma.$transaction(async (tx) => {
      const snapshot = await this.getActiveContact(tx, id);
      await this.lockCompanyContacts(tx, snapshot.companyId);
      const contact = await this.getActiveContact(tx, id);
      const nextIsUnsubscribed = hasOwn(dto, 'isUnsubscribed')
        ? dto.isUnsubscribed === true
        : contact.isUnsubscribed;
      const makePrimary = dto.isPrimary === true && !nextIsUnsubscribed;

      if (makePrimary) {
        await this.clearOtherPrimaryContacts(tx, contact.companyId, id);
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

      return tx.contactPerson.update({ where: { id }, data });
    });
  }

  async archive(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const snapshot = await this.getActiveContact(tx, id);
      await this.lockCompanyContacts(tx, snapshot.companyId);
      await this.getActiveContact(tx, id);
      return tx.contactPerson.update({
        where: { id },
        data: { deletedAt: new Date(), isPrimary: false }
      });
    });
  }

  async unsubscribe(id: string, userId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const snapshot = await this.getActiveContact(tx, id);
      await this.lockCompanyContacts(tx, snapshot.companyId);
      await this.getActiveContact(tx, id);
      const contact = await tx.contactPerson.update({
        where: { id },
        data: {
          isUnsubscribed: true,
          unsubscribedAt: new Date(),
          isPrimary: false
        }
      });
      if (userId) {
        await tx.auditLog.create({
          data: {
            userId,
            action: 'contact.unsubscribed',
            entityType: 'ContactPerson',
            entityId: id,
            before: { isUnsubscribed: false },
            after: { isUnsubscribed: true, companyId: contact.companyId }
          }
        });
      }
      return contact;
    });
  }

  private async getActiveCompany(client: Pick<PrismaService, 'company'> | ContactTransaction, companyId: string) {
    const company = await client.company.findFirst({ where: { id: companyId, deletedAt: null } });
    if (!company) throw new NotFoundException('企業が見つかりません。');
    return company;
  }

  private async getActiveContact(client: ContactTransaction, id: string) {
    const contact = await client.contactPerson.findFirst({ where: { id, ...activeContactWhere } });
    if (!contact) throw new NotFoundException('連絡先が見つかりません。');
    return contact;
  }

  private lockCompanyContacts(client: ContactTransaction, companyId: string) {
    return client.$executeRawUnsafe(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      `company-contacts:${companyId}`
    );
  }

  private clearOtherPrimaryContacts(client: ContactTransaction, companyId: string, exceptId?: string) {
    return client.contactPerson.updateMany({
      where: {
        companyId,
        ...activeContactWhere,
        isPrimary: true,
        ...(exceptId ? { id: { not: exceptId } } : {})
      },
      data: { isPrimary: false }
    });
  }
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
