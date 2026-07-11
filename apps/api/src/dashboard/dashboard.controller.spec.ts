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
    expect(html).toContain('class="top-nav"');
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
    expect(html).toContain('<body class="url-search-page">');
    expect(html).toContain('<h1>URL検索</h1>');
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
    expect(html).toContain('<h1>営業リスト詳細</h1>');
    expect(html).toContain('id="stats"');
    expect(html).toContain('id="exportScope"');
    expect(html).toContain('id="exportFormat"');
    expect(html).toContain('id="leadRows"');
    expect(html).toContain('id="leadDetail"');
    expect(html).toContain('id="leadAnalysis"');
    expect(html).toContain('id="keyword"');
  });

  it('returns mail workspace HTML generated from index replacement contract', () => {
    const indexHtml = controller.index();
    const mailHtml = controller.mailWorkspace();

    expectHtmlResponse(mailHtml);
    expectTopNavigation(mailHtml);
    expect(mailHtml).toContain('<body class="mail-workspace-page">');
    expect(mailHtml).toContain('<h1>メール作成</h1>');
    expect(mailHtml).toContain('<button onclick="location.href=\'/\'">URL検索</button>');
    expect(mailHtml).toContain('<button class="primary" onclick="location.href=\'/mail-workspace\'">メール作成</button>');
    expect(mailHtml).toContain('id="mailLeadSummary"');
    expect(mailHtml).toContain('id="templateKey"');
    expect(mailHtml).toContain('id="mailRows"');
    expect(mailHtml).toContain('id="subject"');
    expect(mailHtml).toContain('id="body"');
    expect(mailHtml).toContain('id="checklistRows"');
    expect(indexHtml).toContain('<body class="url-search-page">');
    expect(mailHtml).not.toContain('<body class="url-search-page">');
  });
});
