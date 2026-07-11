import type { DashboardPageMode } from './dashboard-page-mode';

export interface DashboardPageShell {
  bodyClass: 'url-search-page' | 'mail-workspace-page';
  heading: '候補を探す' | '作成・レビュー';
  urlSearchButtonClass: '' | ' class="primary"';
  mailWorkspaceButtonClass: '' | ' class="primary"';
}

export function getDashboardPageShell(pageMode: DashboardPageMode): DashboardPageShell {
  const isMailWorkspace = pageMode === 'mail-workspace';
  return {
    bodyClass: isMailWorkspace ? 'mail-workspace-page' : 'url-search-page',
    heading: isMailWorkspace ? '作成・レビュー' : '候補を探す',
    urlSearchButtonClass: isMailWorkspace ? '' : ' class="primary"',
    mailWorkspaceButtonClass: isMailWorkspace ? ' class="primary"' : ''
  };
}
