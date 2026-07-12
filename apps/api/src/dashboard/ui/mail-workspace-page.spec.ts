import { renderDashboardPage } from './dashboard-page';
import { renderMailLeadQueue, renderMailWorkspace } from './mail-workspace-page';

describe('Mail workspace static HTML', () => {
  it('keeps the target queue, tabs, and work areas in both dashboard modes', () => {
    const urlSearchHtml = renderDashboardPage('url-search');
    const mailWorkspaceHtml = renderDashboardPage('mail-workspace');

    expect(urlSearchHtml).toContain(renderMailLeadQueue());
    expect(urlSearchHtml).toContain(renderMailWorkspace());
    expect(mailWorkspaceHtml).toContain(renderMailLeadQueue());
    expect(mailWorkspaceHtml).toContain(renderMailWorkspace());
    expect(mailWorkspaceHtml).toContain('data-ui="mail-lead-queue"');
    expect(mailWorkspaceHtml).toContain('data-ui="mail-focus-workspace"');
    expect(mailWorkspaceHtml).toContain('data-mail-work-tab="review"');
    expect(mailWorkspaceHtml).toContain('id="checklistRows"');
  });
});
