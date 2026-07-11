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
    expect(html).toContain('.ui-state-loading');
    expect(html).toContain('.ui-state-empty');
    expect(html).toContain('.ui-state-error');
  }

  function expectTopNavigation(html: string) {
    expect(html).toContain('class="top-nav" data-ui="top-nav"');
    expect(html).toContain("location.href='/today'");
    expect(html).toContain("location.href='/'");
    expect(html).toContain("location.href='/leads-view'");
    expect(html).toContain("location.href='/mail-workspace'");
    expect(html).toContain('候補を探す');
    expect(html).toContain('営業案件');
    expect(html).toContain('作成・レビュー');
  }

  it('keeps route paths stable', () => {
    expect(Reflect.getMetadata(PATH_METADATA, DashboardController)).toBe('/');
    expect(Reflect.getMetadata(PATH_METADATA, DashboardController.prototype.leadsView)).toBe('leads-view');
    expect(Reflect.getMetadata(PATH_METADATA, DashboardController.prototype.mailWorkspace)).toBe('mail-workspace');
    expect(Reflect.getMetadata(PATH_METADATA, DashboardController.prototype.today)).toBe('today');
    expect(Reflect.getMetadata(PATH_METADATA, DashboardController.prototype.index)).toBe('/');
  });

  it('returns today sales HTML with existing-data workflow markers', () => {
    const html = controller.today();

    expectHtmlResponse(html);
    expect(html).toContain('<body data-ui-page="today">');
    expect(html).toContain('<h1>今日の営業</h1>');
    expect(html).toContain('data-ui="today-workspace"');
    expect(html).toContain('data-ui="today-lead-list"');
    expect(html).toContain('id="todayStats"');
    expect(html).toContain('id="todayRows"');
    expect(html).toContain('function classifyToday(lead)');
    expect(html).toContain('今日の対応はありません');
    expect(html).toContain("location.href = '/leads-view'");
  });

  it('returns URL search HTML with key DOM ids and navigation', () => {
    const html = controller.index();

    expectHtmlResponse(html);
    expectTopNavigation(html);
    expect(html).toContain('<body class="url-search-page" data-ui-page="url-search">');
    expect(html).toContain('<h1>候補を探す</h1>');
    expect(html).toContain('data-ui="candidate-search"');
    expect(html).toContain('<details class="search-drawer" open>');
    expect(html).toContain('id="sourcePlatform"');
    expect(html).toContain('id="campfireUrl"');
    expect(html).toContain('id="campfireSearchKeyword"');
    expect(html).toContain('id="campfireCandidates"');
    expect(html).toContain('<div class="ui-state-empty">検索すると候補URLがここに表示されます。</div>');
    expect(html).toContain('id="bulkImportButton"');
    expect(html).toContain('id="leadRows"');
    expect(html).toContain('id="leadDetail"');
  });

  it('returns leads view HTML with key DOM ids and navigation', () => {
    const html = controller.leadsView();

    expectHtmlResponse(html);
    expectTopNavigation(html);
    expect(html).toContain('<body data-ui-page="leads">');
    expect(html).toContain('<h1>営業案件詳細</h1>');
    expect(html).toContain('id="pageStatus" class="status ui-state-loading"');
    expect(html).toContain('条件に合う営業案件がありません');
    expect(html).toContain('data-ui="lead-list-workspace"');
    expect(html).toContain('id="stats"');
    expect(html).toContain('id="summaryFilterStatus"');
    expect(html).toContain('id="clearSummaryFilterButton"');
    expect(html).toContain('data-summary-filter=');
    expect(html).toContain('function setSummaryFilter(filter)');
    expect(html).toContain('今対応する理由');
    expect(html).toContain('data-ui="lead-attention-reason"');
    expect(html).toContain('data-ui="lead-detail-panel"');
    expect(html).toContain('id="detailNextAction"');
    expect(html).toContain('const listScrollTop = listScroll ? listScroll.scrollTop : 0;');
    expect(html).toContain('if (listScroll) listScroll.scrollTop = listScrollTop;');
    expect(html).toContain('function attentionReason(lead, mail, now = new Date())');
    expect(html).toContain("timeZone: 'Asia/Tokyo'");
    expect(html).toContain("rawDaysLeft !== null && rawDaysLeft !== undefined && rawDaysLeft !== ''");
    expect(html).toContain('data-ui="lead-export-tools"');
    expect(html).toContain('<span>その他の操作</span>');
    expect(html).toContain('<span class="status muted">CSV / TSV出力</span>');
    expect(html).toContain('id="exportScope"');
    expect(html).toContain('id="exportFormat"');
    expect(html).toContain('id="leadRows"');
    expect(html).toContain('id="leadDetail"');
    expect(html).toContain('id="leadAnalysis"');
    expect(html).toContain('function renderAiEvidenceSection(label, values, type)');
    expect(html).toContain('function showAiGeneration(index)');
    expect(html).toContain('リスク情報なし（安全判定ではありません）');
    expect(html).toContain('id="keyword"');
  });

  it('returns mail workspace HTML from page mode without string replacement', () => {
    const indexHtml = controller.index();
    const mailHtml = controller.mailWorkspace();
    const mailWorkspaceSource = DashboardController.prototype.mailWorkspace.toString();

    expectHtmlResponse(mailHtml);
    expectTopNavigation(mailHtml);
    expect(mailHtml).toContain('<body class="mail-workspace-page" data-ui-page="mail-workspace">');
    expect(mailHtml).toContain('<h1>作成・レビュー</h1>');
    expect(mailHtml).toContain('id="apiStatus" class="status ui-state-loading"');
    expect(mailHtml).toContain('<details class="search-drawer">');
    expect(mailHtml).not.toContain('<details class="search-drawer" open>');
    expect(mailHtml).toContain('<button onclick="location.href=\'/\'">候補を探す</button>');
    expect(mailHtml).toContain('<button class="primary" onclick="location.href=\'/mail-workspace\'">作成・レビュー <span class="nav-badge" data-nav-badge="mail" hidden></span></button>');
    expect(mailHtml).toContain('data-nav-badge="today"');
    expect(mailHtml).toContain('function renderNavigationBadges()');
    expect(mailHtml).toContain('data-ui="mail-lead-queue"');
    expect(mailHtml).toContain('data-ui="mail-focus-workspace"');
    expect(mailHtml).toContain('data-ui="mail-lead-summary"');
    expect(mailHtml).toContain('data-ui="mail-history"');
    expect(mailHtml).toContain('data-ui="mail-draft-editor"');
    expect(mailHtml).toContain('id="mailProjectComparison" data-ui="mail-project-comparison"');
    expect(mailHtml).toContain('案件情報と見比べる');
    expect(mailHtml).toContain('ai-evidence-risk');
    expect(mailHtml).toContain('function renderAiEvidenceSection(label, values, type)');
    expect(mailHtml).toContain('リスク情報なし（安全判定ではありません）');
    expect(mailHtml).toContain('data-ui="mail-review-panel"');
    expect(mailHtml).toContain('id="draftConsistencyWarning"');
    expect(mailHtml).toContain('function confirmDraftConsistency()');
    expect(mailHtml).toContain("'/api/mails/' + state.selectedMailId + '/consistency'");
    expect(mailHtml).toContain('id="mailContextBar" data-ui="mail-context-bar"');
    expect(mailHtml).toContain('id="nextLeadButton"');
    expect(mailHtml).toContain('id="mailEditorSaveState"');
    expect(mailHtml).toContain('body.mail-workspace-page .mail-context-bar {');
    expect(mailHtml).toContain('top: 58px;');
    expect(mailHtml).toContain('body.mail-workspace-page .mail-context-bar { position: static; box-shadow: none; }');
    expect(mailHtml).toContain('grid-template-columns: minmax(320px, 360px) minmax(0, 1fr);');
    expect(mailHtml).toContain('height: calc(100vh - 80px);');
    expect(mailHtml).toContain('const leadQueueScrollTop = leadQueue ? leadQueue.scrollTop : 0;');
    expect(mailHtml).toContain('if (leadQueue) leadQueue.scrollTop = leadQueueScrollTop;');
    expect(mailHtml).toContain('id="mailLeadSummary"');
    expect(mailHtml).toContain('id="templateKey"');
    expect(mailHtml).toContain('id="mailRows"');
    expect(mailHtml).toContain('id="subject"');
    expect(mailHtml).toContain('id="body"');
    expect(mailHtml).toContain('id="checklistRows"');
    expect(mailHtml).toContain('<button id="generateButton" onclick="generateMail()" disabled>AI下書きを生成</button>');
    expect(mailHtml).toContain('<button onclick="saveMail()" id="saveButton" disabled>保存</button>');
    expect(mailHtml).toContain('id="queueButton" disabled>送信待ちにする</button>');
    expect(mailHtml).toContain('function updatePrimaryMailAction(mail)');
    expect(mailHtml).toContain('function renderMailContextBar(lead, mail, checkedCount, checklistCount)');
    expect(mailHtml).toContain('function renderMailProjectComparison(lead, mail)');
    expect(mailHtml).toContain('function mailComparisonItem(label, value, allowHtml = false, id = \'\')');
    expect(mailHtml).toContain('aria-label="メール作業"');
    expect(mailHtml).toContain('data-mail-work-tab="overview"');
    expect(mailHtml).toContain('data-mail-work-tab="draft"');
    expect(mailHtml).toContain('data-mail-work-tab="review"');
    expect(mailHtml).toContain('data-mail-work-tab="history"');
    expect(mailHtml).toContain('function defaultMailWorkTab(mail)');
    expect(mailHtml).toContain('function syncMailWorkTab(mail)');
    expect(mailHtml).toContain('function visibleMailLeads()');
    expect(mailHtml).toContain('function selectNextLead()');
    expect(mailHtml).toContain('function hasUnsavedMailEditorChanges()');
    expect(mailHtml).toContain('function setMailEditorBaseline(mailId, subject, body)');
    expect(mailHtml).toContain('function updateMailEditorDirtyState()');
    expect(mailHtml).toContain("window.addEventListener('beforeunload'");
    expect(mailHtml).toContain('対象一覧の最後です');
    expect(mailHtml).toContain("if (mail.status === 'in_review' && state.checklistComplete) return 'approveButton';");
    expect(mailHtml).toContain("if (mail.status === 'approved' && state.checklistComplete) return 'queueButton';");
    expect(indexHtml).toContain('<body class="url-search-page" data-ui-page="url-search">');
    expect(mailHtml).not.toContain('<body class="url-search-page" data-ui-page="url-search">');
    expect(mailWorkspaceSource).not.toContain('.replace(');
  });
});
