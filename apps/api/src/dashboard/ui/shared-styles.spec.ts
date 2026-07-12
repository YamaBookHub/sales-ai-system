import { renderDashboardPage } from './dashboard-page';
import { renderLeadsPage } from './leads-page';
import { renderRepliesPage } from './replies-page';
import { renderSharedStyles, type SharedStylePage } from './shared-styles';
import { renderTodayPage } from './today-page';

describe('shared dashboard styles', () => {
  const cases: Array<[SharedStylePage, () => string, string[]]> = [
    ['dashboard', () => renderDashboardPage('url-search'), ['.workflow', '.candidate-table']],
    ['leads', renderLeadsPage, ['.lead-list-scroll', '.lead-detail-panel']],
    ['today', renderTodayPage, ['.today-stats', '.today-row']],
    ['replies', renderRepliesPage, ['.reply-list', '.pagination']]
  ];

  it.each(cases)('keeps the %s CSS in the shared renderer', (page, renderPage, selectors) => {
    const styles = renderSharedStyles(page);
    const html = renderPage();

    expect(styles).toMatch(/^<style>\n/);
    expect(styles).toMatch(/<\/style>$/);
    expect(html).toContain(styles);
    selectors.forEach((selector) => expect(styles).toContain(selector));
  });
});
