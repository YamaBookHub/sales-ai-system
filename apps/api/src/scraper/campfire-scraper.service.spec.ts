import { matchesSearchStatus, sortSearchResults } from './campfire-scraper.service';

describe('CAMPFIRE search status filters', () => {
  const items = [
    { url: 'a', title: 'A', daysLeft: 30, isActive: true, amount: 0, supporterCount: 0, category: '', profileProjectCount: null, summary: '' },
    { url: 'b', title: 'B', daysLeft: 20, isActive: true, amount: 0, supporterCount: 0, category: '', profileProjectCount: null, summary: '' },
    { url: 'c', title: 'C', daysLeft: 7, isActive: true, amount: 0, supporterCount: 0, category: '', profileProjectCount: null, summary: '' },
    { url: 'd', title: 'D', daysLeft: 3, isActive: false, amount: 0, supporterCount: 0, category: '', profileProjectCount: null, summary: '' }
  ];

  it('does not apply the ending-day limit to active-only searches', () => {
    expect(items.filter((item) => matchesSearchStatus(item, { status: 'active', endingSoonDays: 14 })).map((item) => item.url)).toEqual(['a', 'b', 'c']);
  });

  it('uses the selected ending-day limit only for ending-soon searches', () => {
    expect(sortSearchResults(items, { status: 'endingSoon', endingSoonDays: 30 }).map((item) => item.url)).toEqual(['c', 'b', 'a']);
    expect(sortSearchResults(items, { status: 'endingSoon', endingSoonDays: 7 }).map((item) => item.url)).toEqual(['c']);
  });
});
