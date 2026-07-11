import { PATH_METADATA } from '@nestjs/common/constants';
import { DashboardController } from './dashboard.controller';

describe('DashboardController HTML contracts', () => {
  const controller = new DashboardController();

  function expectHtmlResponse(html: string) {
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('<html lang="ja">');
    expect(html).toContain('<meta charset="utf-8"');
    expect(html).toContain('<title>');
    expect(html).toContain('</html>');
  }

  function expectTopNavigation(html: string) {
    expect(html).toContain('class="top-nav" data-ui="top-nav"');
    expect(html).toContain("location.href='/'");
    expect(html).toContain("location.href='/leads-view'");
    expect(html).toContain("location.href='/mail-workspace'");
    expect(html).toContain('URL検索');
    expect(html).toContain('営業リスト');
    expect(html).toContain('メール作成');
  }

  it('keeps route paths stable', () => {
    expect(Reflect.getMetadata(PATH_METADATA, DashboardController)).toBe('/');
    expect(Reflect.getMetadata(PATH_METADATA, DashboardController.prototype.leadsView)).toBe('leads-view');
    expect(Reflect.getMetadata(PATH_METADATA, DashboardController.prototype.mailWorkspace)).toBe('mail-workspace');
    expect(Reflect.getMetadata(PATH_METADATA, DashboardController.prototype.index)).toBe('/');
  });

  it('returns URL search HTML with key DOM ids and navigation', () => {
    const html = controller.index();

    expectHtmlResponse(html);
    expectTopNavigation(html);
    expect(html).toContain('<body class="url-search-page" data-ui-page="url-search">');
    expect(html).toContain('<h1>URL検索</h1>');
    expect(html).toContain('data-ui="candidate-search"');
    expect(html).toContain('id="sourcePlatform"');
    expect(html).toContain('id="campfireUrl"');
    expect(html).toContain('id="campfireSearchKeyword"');
    expect(html).toContain('id="campfireCandidates"');
    expect(html).toContain('id="bulkImportButton"');
    expect(html).toContain('id="leadRows"');
    expect(html).toContain('id="leadDetail"');
  });

  it('returns leads view HTML with key DOM ids and navigation', () => {
    const html = controller.leadsView();

    expectHtmlResponse(html);
    expectTopNavigation(html);
    expect(html).toContain('<body data-ui-page="leads">');
    expect(html).toContain('<h1>営業リスト詳細</h1>');
    expect(html).toContain('data-ui="lead-list-workspace"');
    expect(html).toContain('id="stats"');
    expect(html).toContain('id="exportScope"');
    expect(html).toContain('id="exportFormat"');
    expect(html).toContain('id="leadRows"');
    expect(html).toContain('id="leadDetail"');
    expect(html).toContain('id="leadAnalysis"');
    expect(html).toContain('id="keyword"');
  });

  it('returns mail workspace HTML from page mode without string replacement', () => {
    const indexHtml = controller.index();
    const mailHtml = controller.mailWorkspace();
    const mailWorkspaceSource = DashboardController.prototype.mailWorkspace.toString();

    expectHtmlResponse(mailHtml);
    expectTopNavigation(mailHtml);
    expect(mailHtml).toContain('<body class="mail-workspace-page" data-ui-page="mail-workspace">');
    expect(mailHtml).toContain('<h1>メール作成</h1>');
    expect(mailHtml).toContain('<button onclick="location.href=\'/\'">URL検索</button>');
    expect(mailHtml).toContain('<button class="primary" onclick="location.href=\'/mail-workspace\'">メール作成</button>');
    expect(mailHtml).toContain('data-ui="mail-lead-queue"');
    expect(mailHtml).toContain('data-ui="mail-focus-workspace"');
    expect(mailHtml).toContain('data-ui="mail-lead-summary"');
    expect(mailHtml).toContain('data-ui="mail-history"');
    expect(mailHtml).toContain('data-ui="mail-draft-editor"');
    expect(mailHtml).toContain('data-ui="mail-review-panel"');
    expect(mailHtml).toContain('id="mailLeadSummary"');
    expect(mailHtml).toContain('id="templateKey"');
    expect(mailHtml).toContain('id="mailRows"');
    expect(mailHtml).toContain('id="subject"');
    expect(mailHtml).toContain('id="body"');
    expect(mailHtml).toContain('id="checklistRows"');
    expect(indexHtml).toContain('<body class="url-search-page" data-ui-page="url-search">');
    expect(mailHtml).not.toContain('<body class="url-search-page" data-ui-page="url-search">');
    expect(mailWorkspaceSource).not.toContain('.replace(');
  });
});
