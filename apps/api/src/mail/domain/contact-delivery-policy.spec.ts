import { ConflictException } from '@nestjs/common';
import {
  assertMailDeliveryAllowed,
  buildDeliveryDestinationKeys,
  normalizeContactUrl,
  resolvePrimaryDeliveryDestination
} from './contact-delivery-policy';

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

  it.each([
    ['same normalized email', {
      destination: { sendMethod: 'email', email: ' SALES@Example.COM ' },
      priorDeliveries: [{ status: 'sent', destination: { sendMethod: 'email', email: 'sales@example.com' } }]
    }],
    ['same normalized contact form URL', {
      destination: { sendMethod: 'contact_form', inquiryUrl: 'https://example.com/contact/#form' },
      priorDeliveries: [{
        status: 'approved',
        destination: { sendMethod: 'contact_form', inquiryUrl: 'https://EXAMPLE.com/contact' }
      }]
    }],
    ['same site message destination still being prepared', {
      destination: { sendMethod: 'site_message', siteMessageUrl: 'https://example.com/profile/1' },
      priorDeliveries: [{
        status: 'draft',
        destination: { sendMethod: 'site_message', siteMessageUrl: 'https://example.com/profile/1/' }
      }]
    }]
  ])('rejects duplicate outreach for the %s', (_label, duplicate) => {
    expect(() => assertMailDeliveryAllowed({ ...allowed, ...duplicate } as any)).toThrow(ConflictException);
  });

  it('does not confuse different delivery channels or destinations', () => {
    expect(() => assertMailDeliveryAllowed({
      ...allowed,
      destination: { sendMethod: 'email', email: 'sales@example.com' },
      priorDeliveries: [{
        status: 'sent',
        destination: { sendMethod: 'contact_form', inquiryUrl: 'https://example.com/contact' }
      }]
    })).not.toThrow();
  });

  it('normalizes URL fragments, host case, and trailing slash', () => {
    expect(normalizeContactUrl('https://EXAMPLE.com/contact/#form'))
      .toBe('https://example.com/contact');
  });

  it('selects one auditable destination for persistence', () => {
    expect(resolvePrimaryDeliveryDestination({
      email: ' SALES@Example.COM ',
      inquiryUrl: 'https://example.com/contact/'
    })).toEqual({
      type: 'email',
      value: 'sales@example.com',
      key: 'email:sales@example.com'
    });
    expect(buildDeliveryDestinationKeys({
      sendMethod: 'contact_form',
      email: 'sales@example.com',
      inquiryUrl: 'https://example.com/contact/'
    })).toEqual(['contact_form:https://example.com/contact']);
  });
});
