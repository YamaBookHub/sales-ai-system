import { materialEngagementForClickCount } from './material-engagement-policy';

describe('material-engagement-policy', () => {
  it('treats one material click as interested', () => {
    expect(materialEngagementForClickCount(1)).toMatchObject({
      label: 'interested',
      scoreFloor: 70,
      priority: 'high',
      leadStatus: 'replied'
    });
  });

  it('treats repeated material clicks as hot appointment angle', () => {
    expect(materialEngagementForClickCount(3)).toMatchObject({
      label: 'hot',
      scoreFloor: 85,
      priority: 'high',
      leadStatus: 'meeting_candidate'
    });
  });
});
