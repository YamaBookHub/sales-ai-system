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

  function applyPermissionVisibility(user) {
    const granted = new Set(Array.isArray(user && user.permissions) ? user.permissions : []);
    document.querySelectorAll('[data-required-permissions]').forEach((element) => {
      const required = String(element.getAttribute('data-required-permissions') || '')
        .split(/\\s+/)
        .filter(Boolean);
      element.hidden = !required.every((permission) => granted.has(permission));
    });
  }

  async function refresh() {
    try {
      const [summary, current] = await Promise.all([
        global.SalesAiApi.request('/api/navigation-summary'),
        global.SalesAiApi.loadCurrentUser()
      ]);
      applyPermissionVisibility(current && current.user);
      badgeKeys.forEach((key) => setBadge(key, summary[key]));
    } catch (_error) {
      badgeKeys.forEach((key) => setBadge(key, 0));
    }
  }

  global.SalesAiNavigation = { refresh };
  void refresh();
})(window);`;
}
