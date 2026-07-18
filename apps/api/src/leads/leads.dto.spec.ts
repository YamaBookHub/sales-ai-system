import 'reflect-metadata';
import { validate } from 'class-validator';
import { ListLeadsQueryDto, UpdateLeadDto } from './leads.dto';

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

describe('ListLeadsQueryDto', () => {
  it('accepts the documented list filters and sort controls', async () => {
    const dto = Object.assign(new ListLeadsQueryDto(), {
      page: 2,
      limit: 100,
      source: 'campfire',
      status: 'qualified',
      priority: 'high',
      contactState: 'has',
      mailStatus: 'in_review',
      nextAction: 'overdue',
      sort: 'supporters',
      sortDirection: 'desc'
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects unsupported filter values and limits above 100', async () => {
    const dto = Object.assign(new ListLeadsQueryDto(), {
      limit: 101,
      contactState: 'unknown',
      mailStatus: 'unknown',
      nextAction: 'later',
      sort: 'mail',
      sortDirection: 'sideways'
    });

    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toEqual(expect.arrayContaining([
      'limit', 'contactState', 'mailStatus', 'nextAction', 'sort', 'sortDirection'
    ]));
  });
});
