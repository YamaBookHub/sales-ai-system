import { validate } from 'class-validator';
import { CreateContactDto, UpdateContactDto } from './contacts.dto';

describe('contact DTOs', () => {
  it('accepts nullable optional contact fields for explicit clearing', async () => {
    const dto = Object.assign(new UpdateContactDto(), {
      name: null,
      email: null,
      inquiryUrl: null,
      roleTitle: null,
      isUnsubscribed: false
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects invalid email, URL, and blank names', async () => {
    const dto = Object.assign(new CreateContactDto(), {
      name: '',
      email: 'not-an-email',
      inquiryUrl: 'not-a-url',
      isPrimary: 'yes'
    });

    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toEqual(expect.arrayContaining([
      'name',
      'email',
      'inquiryUrl',
      'isPrimary'
    ]));
  });
});
