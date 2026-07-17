import { ConflictException } from '@nestjs/common';

export type MailDeliverySnapshot = {
  company: { isBlocked: boolean };
  contact?: { deletedAt?: Date | null; isUnsubscribed: boolean } | null;
  legacyMatchedContact?: { deletedAt?: Date | null; isUnsubscribed: boolean } | null;
};

/**
 * Delivery must stop when the company or the resolved recipient is unavailable.
 * Legacy emails without contactId are guarded by a same-company, same-address match.
 */
export function assertMailDeliveryAllowed(snapshot: MailDeliverySnapshot) {
  if (snapshot.company.isBlocked) {
    throw new ConflictException('この企業は送信禁止のため、メールの確認・承認・送信を進められません。');
  }

  const contact = snapshot.contact || snapshot.legacyMatchedContact;
  if (contact?.deletedAt) {
    throw new ConflictException('送信先の連絡先は無効化されているため、メールの確認・承認・送信を進められません。');
  }
  if (contact?.isUnsubscribed) {
    throw new ConflictException('送信先の連絡先は配信停止のため、メールの確認・承認・送信を進められません。');
  }
}
