import { renderLeadsPage } from './leads-page';
import { renderLeadsPageDocument } from './leads-page-static';

describe('Lead page static HTML', () => {
  it('keeps the lead workspace DOM and injects the client script once', () => {
    const html = renderLeadsPage();
    const injected = renderLeadsPageDocument('window.__leadPageContract = true;');

    expect(html).toContain('id="leadRows"');
    expect(html).toContain('id="leadDetail"');
    expect(html).toContain('data-ui="lead-task-workspace"');
    expect(html).toContain('function saveTask()');
    expect(injected).toContain('window.__leadPageContract = true;');
    expect((injected.match(/<script>/g) || []).length).toBe(1);
  });
});
