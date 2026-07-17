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
    ['legacy unsubscribed contact', { company: { isBlocked: false }, contact: null, legacyMatchedContact: { isUnsubscribed: true, deletedAt: null } }]
  ])('rejects a %s', (_label, snapshot) => {
    expect(() => assertMailDeliveryAllowed(snapshot)).toThrow(ConflictException);
  });
});
