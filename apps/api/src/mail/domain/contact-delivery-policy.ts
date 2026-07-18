import { ConflictException } from '@nestjs/common';

export type MailDeliverySnapshot = {
  company: { isBlocked: boolean };
  contact?: { deletedAt?: Date | null; isUnsubscribed: boolean; email?: string | null } | null;
  legacyMatchedContact?: { deletedAt?: Date | null; isUnsubscribed: boolean } | null;
  mailToEmail?: string | null;
  registeredContactCount?: number;
  activeContactCount?: number;
  destination?: MailDeliveryDestination;
  priorDeliveries?: PriorDeliverySnapshot[];
};

export type MailDeliveryDestination = {
  sendMethod?: string | null;
  email?: string | null;
  inquiryUrl?: string | null;
  siteMessageUrl?: string | null;
};

export type PriorDeliverySnapshot = {
  status: 'draft' | 'in_review' | 'approved' | 'queued' | 'sending' | 'sent';
  destination: MailDeliveryDestination;
};

export type ResolvedDeliveryDestination = {
  type: 'email' | 'contact_form' | 'site_message';
  value: string;
  key: string;
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

  const destinationKeys = buildDeliveryDestinationKeys(snapshot.destination);
  const duplicate = (snapshot.priorDeliveries || []).find((delivery) => {
    const priorKeys = new Set(buildDeliveryDestinationKeys(delivery.destination));
    return destinationKeys.some((key) => priorKeys.has(key));
  });
  if (duplicate) {
    const action = duplicate.status === 'sent'
      ? 'すでに送信済みです'
      : ['queued', 'sending'].includes(duplicate.status)
        ? '送信待ちまたは送信処理中です'
        : '下書き作成または確認が進行中です';
    throw new ConflictException(`同じ送信先への別の連絡が${action}。重複接触を避けるため、この操作は進められません。`);
  }
}

export function buildDeliveryDestinationKeys(destination?: MailDeliveryDestination) {
  if (!destination) return [];

  const sendMethod = normalizeSendMethod(destination.sendMethod);
  const email = normalizeEmail(destination.email);
  const inquiryUrl = normalizeContactUrl(destination.inquiryUrl);
  const siteMessageUrl = normalizeContactUrl(destination.siteMessageUrl);

  if (sendMethod === 'email') return email ? [`email:${email}`] : [];
  if (sendMethod === 'contact_form') return inquiryUrl ? [`contact_form:${inquiryUrl}`] : [];
  if (sendMethod === 'site_message') return siteMessageUrl ? [`site_message:${siteMessageUrl}`] : [];

  return [
    email ? `email:${email}` : null,
    inquiryUrl ? `contact_form:${inquiryUrl}` : null,
    siteMessageUrl ? `site_message:${siteMessageUrl}` : null
  ].filter((value): value is string => Boolean(value));
}

export function resolvePrimaryDeliveryDestination(
  destination?: MailDeliveryDestination
): ResolvedDeliveryDestination | null {
  if (!destination) return null;
  const keys = buildDeliveryDestinationKeys(destination);
  const key = keys[0];
  if (!key) return null;
  const separator = key.indexOf(':');
  const type = key.slice(0, separator) as ResolvedDeliveryDestination['type'];
  const value = key.slice(separator + 1);
  return { type, value, key };
}

export function normalizeEmail(value?: string | null) {
  return String(value || '').trim().toLowerCase();
}

export function normalizeContactUrl(value?: string | null) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';

  try {
    const url = new URL(trimmed);
    url.hash = '';
    url.hostname = url.hostname.toLowerCase();
    url.pathname = url.pathname.replace(/\/+$/, '') || '/';
    return url.toString().replace(/\/$/, '');
  } catch {
    return trimmed.replace(/\/+$/, '').toLowerCase();
  }
}

function normalizeSendMethod(value?: string | null) {
  const method = String(value || '').trim().toLowerCase();
  if (['email', 'mail', 'メール'].includes(method)) return 'email';
  if (['contact_form', 'form', '問い合わせフォーム'].includes(method)) return 'contact_form';
  if (['site_message', 'message', 'サイト内メッセージ'].includes(method)) return 'site_message';
  return '';
}
