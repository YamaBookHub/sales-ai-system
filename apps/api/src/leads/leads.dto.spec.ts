import { validate } from 'class-validator';
import { UpdateLeadDto } from './leads.dto';

describe('UpdateLeadDto', () => {
  it('accepts null for optional fields so saved values can be cleared', async () => {
    const dto = Object.assign(new UpdateLeadDto(), {
      contactEmail: null,
      projectTargetAmount: null,
      projectEndDate: null,
      brandAnalysisMemo: null
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects negative metrics and invalid URLs', async () => {
    const dto = Object.assign(new UpdateLeadDto(), {
      projectAmount: -1,
      projectSupporterCount: -2,
      companyWebsiteUrl: 'not-a-url'
    });

    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toEqual(expect.arrayContaining([
      'projectAmount',
      'projectSupporterCount',
      'companyWebsiteUrl'
    ]));
  });
});
