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
    expect(urlSearchHtml).toContain('onchange="syncCampfireSearchEndingSoonFilter()"');
    expect(urlSearchHtml).toContain('onchange="syncCampfireDisplayEndingSoonFilter(); renderCampfireCandidates()"');
    expect(urlSearchHtml).toContain('募集中のみでは終了日数の条件は使いません');
    expect(urlSearchHtml).toContain("setStatus('campfireSearchStatusText', job.message");
    expect(urlSearchHtml).toContain(": job.message;");
    expect(urlSearchHtml).toContain('state.campfireCandidates = mergeCandidates(state.campfireCandidates, job.items || [])');
    expect(urlSearchHtml).toContain('const searchSequence = ++state.campfireSearchSequence');
    expect(urlSearchHtml).toContain("void api('/api/projects/search-jobs/' + previousJobId + '/cancel'");
    expect(urlSearchHtml).toContain('if (searchSequence !== state.campfireSearchSequence) {');
    expect(urlSearchHtml).toContain('if (state.campfireSearchJobId !== jobId) return');
    expect(urlSearchHtml).toContain('function applySearchJob(job, expectedJobId = job.id)');
    expect(urlSearchHtml).toContain("void api('/api/projects/search-jobs/' + activeJobId + '/cancel'");
    expect(urlSearchHtml).toContain('見つかった候補から順にここへ追加されます');
  });
});
