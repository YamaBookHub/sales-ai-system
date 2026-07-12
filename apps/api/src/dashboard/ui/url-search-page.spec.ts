import { renderDashboardPage } from './dashboard-page';
import {
  renderCandidateListSection,
  renderCandidateSearchSection,
  renderUrlSearchEntry
} from './url-search-page';

describe('URL search static HTML', () => {
  it('keeps candidate search and candidate list DOM stable in both dashboard modes', () => {
    const urlSearchHtml = renderDashboardPage('url-search');
    const mailWorkspaceHtml = renderDashboardPage('mail-workspace');

    expect(urlSearchHtml).toContain(renderUrlSearchEntry());
    expect(urlSearchHtml).toContain(renderCandidateSearchSection('url-search'));
    expect(mailWorkspaceHtml).toContain(renderCandidateSearchSection('mail-workspace'));
    expect(urlSearchHtml).toContain(renderCandidateListSection());
    expect(mailWorkspaceHtml).toContain(renderCandidateListSection());
    expect(urlSearchHtml).toContain('<details class="search-drawer" open>');
    expect(mailWorkspaceHtml).toContain('<details class="search-drawer">');
  });
});
