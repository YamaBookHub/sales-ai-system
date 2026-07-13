export function renderNavigationBadgesScript() {
  return `(function (global) {
  const badgeKeys = ['today', 'replies', 'leads', 'mail'];

  function setBadge(key, count) {
    const element = document.querySelector('[data-nav-badge="' + key + '"]');
    if (!element) return;
    const value = Number(count) || 0;
    element.textContent = value > 99 ? '99+' : String(value);
    element.hidden = value === 0;
    element.setAttribute('aria-label', value + '件');
  }

  async function refresh() {
    try {
      const summary = await global.SalesAiApi.request('/api/navigation-summary');
      badgeKeys.forEach((key) => setBadge(key, summary[key]));
    } catch (_error) {
      badgeKeys.forEach((key) => setBadge(key, 0));
    }
  }

  global.SalesAiNavigation = { refresh };
  void refresh();
})(window);`;
}
