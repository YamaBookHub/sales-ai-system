import { resolveMailRecipient } from './contact-recipient.resolver';

describe('resolveMailRecipient', () => {
  it('selects an active email contact with primary contacts first', async () => {
    const contactPerson = {
      findFirst: jest.fn().mockResolvedValue({ id: 'primary_1', email: 'primary@example.com' })
    };

    await expect(resolveMailRecipient({ contactPerson } as any, 'company_1')).resolves.toEqual({
      id: 'primary_1', email: 'primary@example.com'
    });
    expect(contactPerson.findFirst).toHaveBeenCalledWith({
      where: {
        companyId: 'company_1',
        deletedAt: null,
        isUnsubscribed: false,
        email: { not: null }
      },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      select: { id: true, email: true }
    });
  });

  it('returns null when every contact is unavailable', async () => {
    const contactPerson = { findFirst: jest.fn().mockResolvedValue(null) };

    await expect(resolveMailRecipient({ contactPerson } as any, 'company_1')).resolves.toBeNull();
  });
});
