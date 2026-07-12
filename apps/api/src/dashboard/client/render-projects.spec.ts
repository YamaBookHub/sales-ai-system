import { renderClientProjectsScript } from './render-projects';

describe('projects client render', () => {
  it('exports a browser-parseable candidate renderer without moving API calls', () => {
    const script = renderClientProjectsScript();

    expect(script).toContain('window.SalesAiRenderProjects');
    expect(script).toContain('function renderCampfireCandidates()');
    expect(script).toContain('campfireCandidates');
    expect(script).toContain('bulkImportButton');
    expect(() => new Function(script)).not.toThrow();
  });
});
