import { renderClientApiScript } from '../client/api-client';
import { renderNavigationBadgesScript } from '../client/navigation-badges';
import { renderSharedStyles } from './shared-styles';
import { renderTopNavigation } from './top-navigation';

export function renderOperationsPage() {
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>運用状況</title>
  ${renderSharedStyles('operations')}
</head>
<body data-ui-page="operations">
  <header>
    <h1>運用状況</h1>
    <div class="toolbar">
      <span id="operationsStatus" class="status ui-state-loading" aria-live="polite">読み込み中</span>
      ${renderTopNavigation('operations')}
    </div>
  </header>
  <main>
    <section data-ui="operations-filters">
      <div class="section-head">
        <h2>集計期間</h2>
        <span id="operationsPeriod" class="period-meta" aria-live="polite"></span>
      </div>
      <div class="body">
        <form class="filters operations-filters" onsubmit="applyFilters(event)">
          <label>開始日<input id="operationsFrom" type="date" required /></label>
          <label>終了日<input id="operationsTo" type="date" required /></label>
          <button class="primary" type="submit">適用</button>
        </form>
      </div>
    </section>

    <section data-ui="operations-alerts">
      <div class="section-head">
        <h2>期間内の失敗・現在の停滞</h2>
        <span id="operationsAlertCount" class="period-meta"></span>
      </div>
      <div id="operationsAlerts" class="body alert-list">
        <div class="ui-state-loading">運用状態を確認中</div>
      </div>
    </section>

    <section data-ui="operations-summary">
      <div class="section-head">
        <h2>期間サマリー</h2>
        <span id="operationsAsOf" class="period-meta"></span>
      </div>
      <div id="operationsSummary" class="body metric-grid operations-metric-grid">
        <div class="ui-state-loading">集計中</div>
      </div>
    </section>

    <section data-ui="operations-ai">
      <div class="section-head">
        <h2>AI費用</h2>
        <span id="operationsBudgetState" class="period-meta"></span>
      </div>
      <div class="body operations-ai-layout">
        <div id="operationsAiMetrics" class="metric-grid operations-ai-grid">
          <div class="ui-state-loading">AI利用を集計中</div>
        </div>
        <div class="budget-panel">
          <div class="budget-head">
            <span>OpenAI月額予算</span>
            <strong id="operationsBudgetAmount">読み込み中</strong>
          </div>
          <div class="budget-track" aria-hidden="true">
            <span id="operationsBudgetBar"></span>
          </div>
          <div id="operationsBudgetMessage" class="period-meta"></div>
        </div>
      </div>
    </section>

    <section data-ui="operations-acquisition">
      <div class="section-head"><h2>候補検索・取り込み</h2></div>
      <div class="operations-columns">
        <div class="table-scroll">
          <table>
            <thead><tr><th colspan="2">検索</th></tr></thead>
            <tbody id="operationsSearchRows"><tr><td colspan="2" class="ui-state-loading">検索状況を集計中</td></tr></tbody>
          </table>
        </div>
        <div class="table-scroll">
          <table>
            <thead><tr><th colspan="2">取り込み</th></tr></thead>
            <tbody id="operationsImportRows"><tr><td colspan="2" class="ui-state-loading">取り込み状況を集計中</td></tr></tbody>
          </table>
        </div>
      </div>
    </section>

    <section data-ui="operations-communication">
      <div class="section-head"><h2>メール・返信</h2></div>
      <div class="operations-columns">
        <div class="table-scroll">
          <table>
            <thead><tr><th>メール状態</th><th class="number">件数</th></tr></thead>
            <tbody id="operationsMailRows"><tr><td colspan="2" class="ui-state-loading">メール状態を集計中</td></tr></tbody>
          </table>
        </div>
        <div class="table-scroll">
          <table>
            <thead><tr><th>返信分類</th><th class="number">件数</th></tr></thead>
            <tbody id="operationsReplyRows"><tr><td colspan="2" class="ui-state-loading">返信を集計中</td></tr></tbody>
          </table>
        </div>
      </div>
    </section>
  </main>
  <footer>Sales AI System</footer>
  <script>
${renderClientApiScript()}
${renderNavigationBadgesScript()}
    const state = {
      report: null,
      budget: null,
      requestGeneration: 0,
      requestController: null
    };
    const mailStatuses = [
      ['draft', '下書き'],
      ['in_review', '確認待ち'],
      ['rejected', '棄却'],
      ['approved', '承認済み'],
      ['queued', '送信待ち'],
      ['sending', '送信中'],
      ['sent', '送信済み'],
      ['failed', '送信失敗'],
      ['cancelled', '取消']
    ];
    const replyCategories = [
      ['interested', '興味あり'],
      ['need_info', '情報希望'],
      ['meeting_request', '商談希望'],
      ['not_interested', '見送り'],
      ['unsubscribe', '配信停止'],
      ['auto_reply', '自動返信'],
      ['complaint', '苦情'],
      ['unknown', '未分類']
    ];

    function api(path, options) {
      return window.SalesAiApi.request(path, options);
    }

    function tokyoDateKey(date) {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(date);
    }

    function defaultFromDate() {
      const cursor = new Date(tokyoDateKey(new Date()) + 'T12:00:00+09:00');
      cursor.setUTCDate(cursor.getUTCDate() - 29);
      return tokyoDateKey(cursor);
    }

    function escapeHtml(value) {
      return String(value == null ? '' : value).replace(/[&<>"']/g, (character) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      })[character]);
    }

    function formatCount(value) {
      return new Intl.NumberFormat('ja-JP').format(Number(value) || 0);
    }

    function formatUsd(value) {
      return '$' + new Intl.NumberFormat('ja-JP', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 6
      }).format(Number(value) || 0);
    }

    function formatDuration(value) {
      const milliseconds = Number(value) || 0;
      if (milliseconds < 1000) return formatCount(Math.round(milliseconds)) + 'ms';
      return new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 1 }).format(milliseconds / 1000) + '秒';
    }

    function formatDateTime(value) {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '';
      return new Intl.DateTimeFormat('ja-JP', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    }

    function setStatus(message, type) {
      const element = document.getElementById('operationsStatus');
      element.textContent = message;
      element.className = 'status' + (type === 'loading' ? ' ui-state-loading' : type ? ' ' + type : '');
    }

    function reportPath() {
      const params = new URLSearchParams();
      params.set('from', document.getElementById('operationsFrom').value);
      params.set('to', document.getElementById('operationsTo').value);
      return '/api/reports/operations?' + params.toString();
    }

    function metric(label, value, tone) {
      return '<div class="metric' + (tone ? ' ' + tone : '') + '">' +
        '<span class="metric-label">' + escapeHtml(label) + '</span>' +
        '<strong class="metric-value">' + escapeHtml(value) + '</strong>' +
        '</div>';
    }

    function rows(items) {
      return items.map((item) =>
        '<tr><td>' + escapeHtml(item[0]) + '</td><td class="number">' + escapeHtml(item[1]) + '</td></tr>'
      ).join('');
    }

    function renderAlerts() {
      const alerts = Array.isArray(state.report?.alerts) ? state.report.alerts : [];
      document.getElementById('operationsAlertCount').textContent = alerts.length ? alerts.length + '件' : '0件';
      document.getElementById('operationsAlerts').innerHTML = alerts.length
        ? alerts.map((alert) =>
            '<div class="alert-row ' + escapeHtml(alert.severity || 'warning') + '">' +
              '<span class="alert-label">' + escapeHtml(alert.label || '確認が必要です') + '</span>' +
              '<strong>' + formatCount(alert.value) + '</strong>' +
            '</div>'
          ).join('')
        : '<div class="ui-state-empty">確認が必要な状態はありません。</div>';
    }

    function renderBudget() {
      const budget = state.budget || {};
      const configured = budget.configured === true;
      const blocked = budget.blocked === true;
      document.getElementById('operationsBudgetState').textContent = blocked ? '上限到達' : configured ? '上限設定済み' : '上限未設定';
      document.getElementById('operationsBudgetAmount').textContent = configured
        ? formatUsd(budget.spentUsd) + ' / ' + formatUsd(budget.budgetUsd)
        : formatUsd(budget.spentUsd);
      const percent = configured ? Math.min(100, Math.max(0, Number(budget.usagePercent) || 0)) : 0;
      const bar = document.getElementById('operationsBudgetBar');
      bar.style.width = percent + '%';
      bar.className = blocked ? 'danger' : percent >= 80 ? 'warn' : '';
      document.getElementById('operationsBudgetMessage').textContent = budget.statusMessage || '';
    }

    function renderReport() {
      const report = state.report;
      if (!report) return;
      const ai = report.ai || {};
      const searches = report.searches || {};
      const imports = report.imports || {};
      const replies = report.replies || {};
      const mails = report.mails || {};
      const period = report.period || {};

      document.getElementById('operationsPeriod').textContent = [period.from, period.to, period.timezone].filter(Boolean).join(' - ');
      document.getElementById('operationsAsOf').textContent = period.asOf ? '集計時点: ' + formatDateTime(period.asOf) : '';
      document.getElementById('operationsSummary').innerHTML =
        metric('AI概算費用', formatUsd(ai.costUsd)) +
        metric('失敗合計', formatCount((ai.failed || 0) + (searches.failed || 0) + (imports.failed || 0) + Number((mails.byStatus || {}).failed || 0)), 'danger') +
        metric('検索回数', formatCount(searches.total)) +
        metric('取込成功', formatCount(imports.imported)) +
        metric('返信', formatCount(replies.total)) +
        metric('メール', formatCount(mails.total));

      document.getElementById('operationsAiMetrics').innerHTML =
        metric('期間費用', formatUsd(ai.costUsd)) +
        metric('完了', formatCount(ai.completed)) +
        metric('失敗', formatCount(ai.failed), ai.failed ? 'danger' : '') +
        metric('予約中', formatCount(ai.reserved), ai.reserved ? 'warn' : '');

      document.getElementById('operationsSearchRows').innerHTML = rows([
        ['合計', formatCount(searches.total)],
        ['完了', formatCount(searches.completed)],
        ['失敗', formatCount(searches.failed)],
        ['取消', formatCount(searches.cancelled)],
        ['実行中', formatCount(searches.running)],
        ['平均時間', formatDuration(searches.averageDurationMs)],
        ['最長時間', formatDuration(searches.maxDurationMs)]
      ]);
      document.getElementById('operationsImportRows').innerHTML = rows([
        ['実行回数', formatCount(imports.runs)],
        ['対象', formatCount(imports.requested)],
        ['成功', formatCount(imports.imported)],
        ['失敗', formatCount(imports.failed)],
        ['分析失敗', formatCount(imports.analysisFailed)]
      ]);

      const mailCounts = mails.byStatus || {};
      document.getElementById('operationsMailRows').innerHTML = rows(
        mailStatuses.map((item) => [item[1], formatCount(mailCounts[item[0]])])
      );
      const replyCounts = replies.byCategory || {};
      document.getElementById('operationsReplyRows').innerHTML = rows(
        replyCategories.map((item) => [item[1], formatCount(replyCounts[item[0]])])
      );
      renderAlerts();
      renderBudget();
    }

    function renderError() {
      state.report = null;
      state.budget = null;
      document.getElementById('operationsPeriod').textContent = '';
      document.getElementById('operationsAsOf').textContent = '';
      document.getElementById('operationsAlertCount').textContent = '';
      document.getElementById('operationsBudgetState').textContent = '';
      document.getElementById('operationsBudgetAmount').textContent = '表示できません';
      document.getElementById('operationsBudgetMessage').textContent = '';
      document.getElementById('operationsBudgetBar').style.width = '0%';
      document.getElementById('operationsAlerts').innerHTML = '<div class="ui-state-error">運用状況を読み込めませんでした。</div>';
      document.getElementById('operationsSummary').innerHTML = '<div class="ui-state-error">集計結果を表示できません。</div>';
      document.getElementById('operationsAiMetrics').innerHTML = '<div class="ui-state-error">AI利用を表示できません。</div>';
      document.getElementById('operationsSearchRows').innerHTML = '<tr><td colspan="2" class="ui-state-error">検索状況を表示できません。</td></tr>';
      document.getElementById('operationsImportRows').innerHTML = '<tr><td colspan="2" class="ui-state-error">取り込み状況を表示できません。</td></tr>';
      document.getElementById('operationsMailRows').innerHTML = '<tr><td colspan="2" class="ui-state-error">メール状態を表示できません。</td></tr>';
      document.getElementById('operationsReplyRows').innerHTML = '<tr><td colspan="2" class="ui-state-error">返信を表示できません。</td></tr>';
    }

    function isCurrentRequest(generation, controller) {
      return state.requestGeneration === generation && state.requestController === controller;
    }

    async function loadOperations() {
      const previousController = state.requestController;
      const generation = state.requestGeneration + 1;
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      state.requestGeneration = generation;
      state.requestController = controller;
      previousController?.abort();
      setStatus('読み込み中', 'loading');
      try {
        const options = controller ? { signal: controller.signal } : {};
        const result = await Promise.all([
          api(reportPath(), options),
          api('/api/ai/usage-summary', options)
        ]);
        if (!isCurrentRequest(generation, controller)) return;
        state.report = result[0];
        state.budget = result[1];
        renderReport();
        setStatus('読み込み完了', 'ok');
      } catch (_error) {
        if (!isCurrentRequest(generation, controller) || controller?.signal.aborted) return;
        renderError();
        setStatus('読み込みに失敗しました。時間を置いて再試行してください。', 'error');
      } finally {
        if (isCurrentRequest(generation, controller)) state.requestController = null;
      }
    }

    function applyFilters(event) {
      event.preventDefault();
      void loadOperations();
    }

    document.getElementById('operationsFrom').value = defaultFromDate();
    document.getElementById('operationsTo').value = tokyoDateKey(new Date());
    void loadOperations();
  </script>
</body>
</html>`;
}
