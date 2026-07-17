type ContactPersonReader = {
  contactPerson: {
    findFirst(args: unknown): Promise<MailRecipientContact | null>;
  };
};

export type MailRecipientContact = {
  id: string;
  email: string | null;
};

/** Select the primary active email contact, falling back to the oldest active email contact. */
export function resolveMailRecipient(reader: ContactPersonReader, companyId: string) {
  return reader.contactPerson.findFirst({
    where: {
      companyId,
      deletedAt: null,
      isUnsubscribed: false,
      email: { not: null }
    },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    select: { id: true, email: true }
  }) as Promise<MailRecipientContact | null>;
}
