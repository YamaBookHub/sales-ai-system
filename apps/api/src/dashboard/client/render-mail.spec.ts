import { renderClientMailScript } from './render-mail';

describe('mail client render', () => {
  it('exports a browser-parseable mail renderer', () => {
    const script = renderClientMailScript();

    expect(script).toContain('window.SalesAiRenderAreas');
    expect(script).toContain('function renderMails()');
    expect(script).toContain('mailRows');
    expect(script).toContain('renderMailStageCards');
    expect(script).toContain('loadMailEngagement');
    expect(() => new Function(script)).not.toThrow();
  });
});
