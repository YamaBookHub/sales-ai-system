import { renderClientContactsScript } from './contacts';

describe('contacts client renderer', () => {
  it('exports a browser-parseable reusable contact manager', () => {
    const script = renderClientContactsScript();

    expect(script).toContain('SalesAiContacts');
    expect(script).toContain('company-contact-manager');
    expect(script).toContain('companyContactPrimary');
    expect(() => new Function(script)).not.toThrow();
  });

  it('does not select an unsubscribed contact as the primary recipient', () => {
    const script = renderClientContactsScript();
    const fakeWindow: Record<string, unknown> = {};
    const contacts = new Function('window', script + '; return window.SalesAiContacts;')(fakeWindow);

    expect(contacts.primaryContact([
      { id: 'stopped-1', isPrimary: true, isUnsubscribed: true },
      { id: 'stopped-2', isPrimary: false, isUnsubscribed: true }
    ])).toBeNull();
  });
});
