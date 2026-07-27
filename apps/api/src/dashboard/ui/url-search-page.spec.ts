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
    expect(urlSearchHtml).toContain("api('/api/projects/sources')");
    expect(urlSearchHtml).toContain('state.projectSources.map((item)');
    expect(urlSearchHtml).toContain("sourceSupports('categoryFilter')");
    expect(urlSearchHtml).toContain("sourceSupports('endingSoonFilter')");
    expect(urlSearchHtml).toContain('capabilities.profileProjectCountFilter');
    expect(urlSearchHtml).toContain('capabilities.keywordSearch');
    expect(urlSearchHtml).toContain('capabilities.categoryFilter');
    expect(urlSearchHtml).toContain('capabilities.cancellation');
    expect(urlSearchHtml).not.toContain("['campfire', 'makuake'].includes(selectedSourcePlatform())");
    expect(urlSearchHtml).not.toContain('<option value="green_funding" disabled>');
    expect(urlSearchHtml).toContain('onchange="syncCampfireSearchEndingSoonFilter()"');
    expect(urlSearchHtml).toContain('onchange="syncCampfireDisplayEndingSoonFilter(); renderCampfireCandidates()"');
    expect(urlSearchHtml).toContain('募集中のみでは終了日数の条件は使いません');
    expect(urlSearchHtml).toContain("setStatus('campfireSearchStatusText', job.message");
    expect(urlSearchHtml).toContain(": job.message;");
    expect(urlSearchHtml).toContain('source: item.source || job.source');
    expect(urlSearchHtml).toContain('state.campfireCandidates = mergeCandidates(state.campfireCandidates, sourcedItems)');
    expect(urlSearchHtml).toContain('const searchSequence = ++state.campfireSearchSequence');
    expect(urlSearchHtml).toContain("void api('/api/projects/search-jobs/' + previousJobId + '/cancel'");
    expect(urlSearchHtml).toContain('if (searchSequence !== state.campfireSearchSequence) {');
    expect(urlSearchHtml).toContain('if (state.campfireSearchJobId !== jobId) return');
    expect(urlSearchHtml).toContain('function applySearchJob(job, expectedJobId = job.id)');
    expect(urlSearchHtml).toContain("void api('/api/projects/search-jobs/' + activeJobId + '/cancel'");
    expect(urlSearchHtml).toContain('見つかった候補から順にここへ追加されます');
  });

  it('invalidates the old search job when the source changes', () => {
    const html = renderDashboardPage('url-search');
    const sourceChangeScript = html.slice(
      html.indexOf('function onSourcePlatformChange()'),
      html.indexOf('function toggleSourceField(')
    );

    expect(sourceChangeScript).toContain('invalidateCampfireSearchForSourceChange()');
    expect(sourceChangeScript).toContain('state.campfireSearchSequence += 1');
    expect(sourceChangeScript).toContain('state.campfireSearchJobId = null');
    expect(sourceChangeScript).toContain('stopCampfireSearchPoll()');
    expect(sourceChangeScript).toContain("api('/api/projects/search-jobs/' + activeJobId + '/cancel'");
  });

  it('keeps a newer source selection when the sources request responds late', () => {
    const html = renderDashboardPage('url-search');
    const loadSourcesScript = html.slice(
      html.indexOf('async function loadProjectSources()'),
      html.indexOf('function onSourcePlatformChange()')
    );

    expect(loadSourcesScript).toContain('const requestGeneration = ++state.projectSourcesRequestGeneration');
    expect(loadSourcesScript).toContain('if (requestGeneration !== state.projectSourcesRequestGeneration) return');
    expect(loadSourcesScript).toContain("const selectedBeforeApply = select.value || state.currentSourcePlatform || ''");
    expect(loadSourcesScript).toContain('select.value = selectedBeforeApply');
  });

  it('imports individual and bulk candidates with each candidate source', () => {
    const html = renderDashboardPage('url-search');
    const individualImportScript = html.slice(
      html.indexOf('async function importCampfireCandidate('),
      html.indexOf('async function bulkImportVisibleCandidates()')
    );
    const bulkImportScript = html.slice(
      html.indexOf('async function bulkImportVisibleCandidates()'),
      html.indexOf('async function analyzeLead(')
    );

    expect(individualImportScript).toContain('const source = candidateSource(candidate)');
    expect(individualImportScript).toContain('body: JSON.stringify({ source, url: candidate.url })');
    expect(individualImportScript).not.toContain('selectedSourcePlatform()');
    expect(bulkImportScript).toContain('const entriesBySource = new Map()');
    expect(bulkImportScript).toContain('const source = candidateSource(entry.item)');
    expect(bulkImportScript).toContain('Array.from(entriesBySource.entries())');
    expect(bulkImportScript).toContain('urls: sourceEntries.map(({ item }) => item.url)');
    expect(bulkImportScript).not.toContain('selectedSourcePlatform()');
  });
});
