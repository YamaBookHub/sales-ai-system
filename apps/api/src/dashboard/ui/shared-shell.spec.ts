import { getDashboardPageShell } from './shared-shell';

describe('getDashboardPageShell', () => {
  it('marks URL search as the active page', () => {
    expect(getDashboardPageShell('url-search')).toEqual({
      bodyClass: 'url-search-page',
      heading: '候補を探す',
      urlSearchButtonClass: ' class="primary"',
      mailWorkspaceButtonClass: ''
    });
  });

  it('marks mail workspace as the active page', () => {
    expect(getDashboardPageShell('mail-workspace')).toEqual({
      bodyClass: 'mail-workspace-page',
      heading: '作成・レビュー',
      urlSearchButtonClass: '',
      mailWorkspaceButtonClass: ' class="primary"'
    });
  });
});
