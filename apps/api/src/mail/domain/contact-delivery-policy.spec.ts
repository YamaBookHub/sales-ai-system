import { ConflictException } from '@nestjs/common';
import { assertMailDeliveryAllowed } from './contact-delivery-policy';

describe('assertMailDeliveryAllowed', () => {
  const allowed = { company: { isBlocked: false }, contact: null };

  it('allows a company with no resolved contact', () => {
    expect(() => assertMailDeliveryAllowed(allowed)).not.toThrow();
  });

  it.each([
    ['blocked company', { company: { isBlocked: true }, contact: null }],
    ['unsubscribed contact', { company: { isBlocked: false }, contact: { isUnsubscribed: true, deletedAt: null } }],
    ['deleted contact', { company: { isBlocked: false }, contact: { isUnsubscribed: false, deletedAt: new Date() } }],
    ['legacy unsubscribed contact', { company: { isBlocked: false }, contact: null, legacyMatchedContact: { isUnsubscribed: true, deletedAt: null } }],
    ['stale contact email', {
      company: { isBlocked: false },
      contact: { isUnsubscribed: false, deletedAt: null, email: 'new@example.com' },
      mailToEmail: 'old@example.com'
    }],
    ['company whose registered contacts are all stopped', {
      company: { isBlocked: false },
      contact: null,
      registeredContactCount: 2,
      activeContactCount: 0
    }]
  ])('rejects a %s', (_label, snapshot) => {
    expect(() => assertMailDeliveryAllowed(snapshot)).toThrow(ConflictException);
  });
  it('allows legacy operation when the company has no registered contacts', () => {
    expect(() => assertMailDeliveryAllowed({
      company: { isBlocked: false },
      contact: null,
      registeredContactCount: 0,
      activeContactCount: 0
    })).not.toThrow();
  });

  it('allows case and surrounding-space differences in a current contact email', () => {
    expect(() => assertMailDeliveryAllowed({
      company: { isBlocked: false },
      contact: { isUnsubscribed: false, deletedAt: null, email: ' Contact@Example.COM ' },
      mailToEmail: 'contact@example.com'
    })).not.toThrow();
  });
});
