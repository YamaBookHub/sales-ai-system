import { renderTopNavigation } from './top-navigation';

describe('top navigation', () => {
  it('renders one shared order with every count slot', () => {
    const html = renderTopNavigation('replies');

    expect(html).toContain('class="top-nav" data-ui="top-nav"');
    expect(html).toContain('class="primary" onclick="location.href=\'/replies\'"');
    expect(html).toContain('data-nav-badge="today"');
    expect(html).toContain('data-nav-badge="replies"');
    expect(html).toContain('data-nav-badge="leads"');
    expect(html).toContain('data-nav-badge="mail"');

    const paths = ['/today', '/replies', '/leads-view', '/mail-workspace', '/'];
    const positions = paths.map((path) => html.indexOf(`location.href='${path}'`));
    expect(positions).toEqual([...positions].sort((left, right) => left - right));
  });
});
