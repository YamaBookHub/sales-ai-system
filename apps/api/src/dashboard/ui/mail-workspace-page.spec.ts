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
    expect(mailWorkspaceHtml).toContain('id="aiModel"');
    expect(mailWorkspaceHtml).toContain('<option value="gemini-3.1-flash-lite">Gemini 3.1 Flash-Lite（低コスト・既定）</option>');
    expect(mailWorkspaceHtml).toContain('<option value="gemini-3.5-flash">Gemini 3.5 Flash（品質重視）</option>');
    expect(mailWorkspaceHtml).toContain('<option value="gpt-4.1-mini">GPT-4.1 mini（旧既定・低コスト）</option>');
    expect(mailWorkspaceHtml).toContain('<option value="gpt-5.6-luna">5.6 LUNA（互換用）</option>');
    expect(mailWorkspaceHtml).toContain('<option value="gpt-5.6-sol">5.6 SOL（互換用）</option>');
    expect(mailWorkspaceHtml).toContain('data-mail-work-tab="review"');
    expect(mailWorkspaceHtml).toContain('id="checklistRows"');
    expect(mailWorkspaceHtml).toContain('expectedSourceFingerprint: state.structuredAnalysis?.sourceFingerprint');
    expect(mailWorkspaceHtml).toContain('analysisRevisionId: analysis.id');
    expect(mailWorkspaceHtml).toContain('await loadStructuredAnalysis();');
  });
});
