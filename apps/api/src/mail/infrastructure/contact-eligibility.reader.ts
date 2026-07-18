import { NotFoundException } from '@nestjs/common';
import { EmailStatus, Prisma } from '@prisma/client';
import {
  assertMailDeliveryAllowed,
  buildDeliveryDestinationKeys,
  MailDeliveryDestination,
  MailDeliverySnapshot,
  PriorDeliverySnapshot,
  resolvePrimaryDeliveryDestination
} from '../domain/contact-delivery-policy';

const RESERVED_DELIVERY_STATUSES: EmailStatus[] = ['draft', 'in_review', 'approved', 'queued', 'sending', 'sent'];

type DeliveryReader = Prisma.TransactionClient | {
  company: Prisma.TransactionClient['company'];
  contactPerson: Prisma.TransactionClient['contactPerson'];
  outreachEmail: Prisma.TransactionClient['outreachEmail'];
  $executeRawUnsafe?: Prisma.TransactionClient['$executeRawUnsafe'];
};

type LeadDeliverySubject = {
  id: string;
  companyId: string;
  contactEmail?: string | null;
  contactFormUrl?: string | null;
  siteMessageUrl?: string | null;
  sendMethod?: string | null;
  company: { isBlocked: boolean; inquiryUrl?: string | null };
};

type RecipientContact = {
  id: string;
  email: string | null;
  inquiryUrl?: string | null;
  deletedAt?: Date | null;
  isUnsubscribed?: boolean;
};

export async function assertLeadContactEligible(
  reader: DeliveryReader,
  lead: LeadDeliverySubject,
  recipient: RecipientContact | null,
  options: { lock?: boolean } = {}
) {
  const destination = leadDestination(lead, recipient);
  if (options.lock) await lockDeliveryDestination(reader, lead.companyId, destination);

  const [registeredContactCount, activeContactCount, priorDeliveries] = await Promise.all([
    reader.contactPerson.count({ where: { companyId: lead.companyId, deletedAt: null } }),
    reader.contactPerson.count({
      where: { companyId: lead.companyId, deletedAt: null, isUnsubscribed: false }
    }),
    findPriorDeliveries(reader, lead.companyId, destination)
  ]);

  assertMailDeliveryAllowed({
    company: lead.company,
    contact: recipient
      ? {
        deletedAt: recipient.deletedAt ?? null,
        isUnsubscribed: recipient.isUnsubscribed ?? false,
        email: recipient.email
      }
      : null,
    mailToEmail: recipient?.email ?? null,
    registeredContactCount,
    activeContactCount,
    destination,
    priorDeliveries
  });

  return resolvePrimaryDeliveryDestination(destination);
}

export async function assertPersistedMailContactEligible(
  reader: DeliveryReader,
  id: string,
  options: { lock?: boolean } = {}
) {
  const email = await reader.outreachEmail.findUnique({
    where: { id },
    select: {
      id: true,
      companyId: true,
      contactId: true,
      toEmail: true,
      destinationType: true,
      destinationValue: true,
      destinationKey: true,
      company: { select: { isBlocked: true, inquiryUrl: true } },
      contact: {
        select: { deletedAt: true, isUnsubscribed: true, email: true, inquiryUrl: true }
      },
      lead: {
        select: {
          sendMethod: true,
          contactEmail: true,
          contactFormUrl: true,
          siteMessageUrl: true
        }
      }
    }
  });
  if (!email) throw new NotFoundException('Mail not found');

  const destination = mailDestination(email);
  if (options.lock) await lockDeliveryDestination(reader, email.companyId, destination);

  const legacyMatchedContact = !email.contactId && email.toEmail
    ? await reader.contactPerson.findFirst({
      where: {
        companyId: email.companyId,
        email: { equals: email.toEmail, mode: 'insensitive' },
        OR: [{ deletedAt: { not: null } }, { isUnsubscribed: true }]
      },
      select: { deletedAt: true, isUnsubscribed: true }
    })
    : null;

  const [registeredContactCount, activeContactCount, priorDeliveries] = !email.contactId
    ? await Promise.all([
      reader.contactPerson.count({ where: { companyId: email.companyId, deletedAt: null } }),
      reader.contactPerson.count({
        where: { companyId: email.companyId, deletedAt: null, isUnsubscribed: false }
      }),
      findPriorDeliveries(reader, email.companyId, destination, email.id)
    ])
    : [0, 0, await findPriorDeliveries(reader, email.companyId, destination, email.id)];

  const snapshot: MailDeliverySnapshot = {
    company: email.company,
    contact: email.contact,
    legacyMatchedContact,
    mailToEmail: email.toEmail,
    registeredContactCount,
    activeContactCount,
    destination,
    priorDeliveries
  };
  assertMailDeliveryAllowed(snapshot);
  return resolvePrimaryDeliveryDestination(destination);
}

async function findPriorDeliveries(
  reader: DeliveryReader,
  companyId: string,
  destination: MailDeliveryDestination,
  currentMailId?: string
): Promise<PriorDeliverySnapshot[]> {
  const keys = buildDeliveryDestinationKeys(destination);
  if (keys.length === 0) return [];

  const email = keys.find((key) => key.startsWith('email:'))?.slice('email:'.length);
  const rawUrls = [destination.inquiryUrl, destination.siteMessageUrl]
    .filter((value): value is string => Boolean(value));
  const or: Prisma.OutreachEmailWhereInput[] = [
    { companyId },
    { destinationKey: { in: keys } }
  ];
  if (email) {
    or.push(
      { toEmail: { equals: email, mode: 'insensitive' } },
      { contact: { is: { email: { equals: email, mode: 'insensitive' } } } },
      { lead: { is: { contactEmail: { equals: email, mode: 'insensitive' } } } }
    );
  }
  for (const url of rawUrls) {
    or.push(
      { contact: { is: { inquiryUrl: url } } },
      { lead: { is: { contactFormUrl: url } } },
      { lead: { is: { siteMessageUrl: url } } },
      { company: { is: { inquiryUrl: url } } }
    );
  }

  const records = await reader.outreachEmail.findMany({
    where: {
      ...(currentMailId ? { id: { not: currentMailId } } : {}),
      OR: [
        { status: { in: RESERVED_DELIVERY_STATUSES } },
        { sentAt: { not: null } }
      ],
      AND: [{ OR: or }]
    },
    select: {
      status: true,
      sentAt: true,
      toEmail: true,
      destinationType: true,
      destinationValue: true,
      destinationKey: true,
      contact: { select: { email: true, inquiryUrl: true } },
      company: { select: { inquiryUrl: true } },
      lead: {
        select: {
          sendMethod: true,
          contactEmail: true,
          contactFormUrl: true,
          siteMessageUrl: true
        }
      }
    }
  });

  return records.map((record) => ({
    status: (record.sentAt ? 'sent' : record.status) as PriorDeliverySnapshot['status'],
    destination: mailDestination(record)
  }));
}

async function lockDeliveryDestination(
  reader: DeliveryReader,
  companyId: string,
  destination: MailDeliveryDestination
) {
  if (!reader.$executeRawUnsafe) return;
  const keys = buildDeliveryDestinationKeys(destination);
  const lockKeys = (keys.length > 0 ? keys : [`company:${companyId}`]).sort();
  for (const key of lockKeys) {
    await reader.$executeRawUnsafe(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      `contact-eligibility:${key}`
    );
  }
}

function leadDestination(lead: LeadDeliverySubject, recipient: RecipientContact | null): MailDeliveryDestination {
  return {
    sendMethod: lead.sendMethod,
    email: recipient?.email || lead.contactEmail,
    inquiryUrl: recipient?.inquiryUrl || lead.contactFormUrl || lead.company.inquiryUrl,
    siteMessageUrl: lead.siteMessageUrl
  };
}

function mailDestination(mail: {
  toEmail?: string | null;
  destinationType?: string | null;
  destinationValue?: string | null;
  destinationKey?: string | null;
  contact?: { email?: string | null; inquiryUrl?: string | null } | null;
  company?: { inquiryUrl?: string | null } | null;
  lead?: {
    sendMethod?: string | null;
    contactEmail?: string | null;
    contactFormUrl?: string | null;
    siteMessageUrl?: string | null;
  } | null;
}): MailDeliveryDestination {
  if (mail.destinationType && mail.destinationValue) {
    return {
      sendMethod: mail.destinationType,
      email: mail.destinationType === 'email' ? mail.destinationValue : null,
      inquiryUrl: mail.destinationType === 'contact_form' ? mail.destinationValue : null,
      siteMessageUrl: mail.destinationType === 'site_message' ? mail.destinationValue : null
    };
  }
  return {
    sendMethod: mail.lead?.sendMethod,
    email: mail.toEmail || mail.contact?.email || mail.lead?.contactEmail,
    inquiryUrl: mail.contact?.inquiryUrl || mail.lead?.contactFormUrl || mail.company?.inquiryUrl,
    siteMessageUrl: mail.lead?.siteMessageUrl
  };
}
