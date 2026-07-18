import { ConflictException } from '@nestjs/common';

export type MailDeliverySnapshot = {
  company: { isBlocked: boolean };
  contact?: { deletedAt?: Date | null; isUnsubscribed: boolean; email?: string | null } | null;
  legacyMatchedContact?: { deletedAt?: Date | null; isUnsubscribed: boolean } | null;
  mailToEmail?: string | null;
  registeredContactCount?: number;
  activeContactCount?: number;
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
  if (
    snapshot.contact
    && snapshot.mailToEmail
    && normalizeEmail(snapshot.contact.email) !== normalizeEmail(snapshot.mailToEmail)
  ) {
    throw new ConflictException('送信先メールアドレスが連絡先の最新情報と一致しません。宛先を確認して下書きを更新してください。');
  }

  if (!contact && (snapshot.registeredContactCount ?? 0) > 0 && (snapshot.activeContactCount ?? 0) === 0) {
    throw new ConflictException('この企業の登録済み連絡先はすべて配信停止のため、メールの確認・承認・送信を進められません。');
  }
}

function normalizeEmail(value?: string | null) {
  return String(value || '').trim().toLowerCase();
}
