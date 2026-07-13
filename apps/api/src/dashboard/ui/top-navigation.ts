export type DashboardNavigationPage = 'url-search' | 'leads' | 'mail-workspace' | 'today' | 'replies';

const NAVIGATION_ITEMS: Array<{ key: DashboardNavigationPage; path: string; label: string; badge: string }> = [
  { key: 'today', path: '/today', label: '今日の営業', badge: 'today' },
  { key: 'replies', path: '/replies', label: '返信', badge: 'replies' },
  { key: 'leads', path: '/leads-view', label: '営業案件', badge: 'leads' },
  { key: 'mail-workspace', path: '/mail-workspace', label: '作成・レビュー', badge: 'mail' },
  { key: 'url-search', path: '/', label: '候補を探す', badge: '' }
];

export function renderTopNavigation(activePage: DashboardNavigationPage) {
  const buttons = NAVIGATION_ITEMS.map((item) => {
    const activeClass = item.key === activePage ? ' class="primary"' : '';
    const badge = item.badge
      ? ` <span class="nav-badge" data-nav-badge="${item.badge}" hidden></span>`
      : '';
    return `<button${activeClass} onclick="location.href='${item.path}'">${item.label}${badge}</button>`;
  }).join('');

  return `<div class="top-nav" data-ui="top-nav">${buttons}</div>`;
}
