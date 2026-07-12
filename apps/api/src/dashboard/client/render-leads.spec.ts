import { renderClientLeadsScript } from './render-leads';

describe('leads client render', () => {
  it('exports a browser-parseable lead renderer', () => {
    const script = renderClientLeadsScript();

    expect(script).toContain('window.SalesAiRenderAreas');
    expect(script).toContain('function renderLeads()');
    expect(script).toContain('leadRows');
    expect(script).toContain('mailLeadCount');
    expect(() => new Function(script)).not.toThrow();
  });
});
