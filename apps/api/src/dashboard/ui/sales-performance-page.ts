import { renderClientApiScript } from '../client/api-client';
import { renderNavigationBadgesScript } from '../client/navigation-badges';
import { renderSharedStyles } from './shared-styles';
import { renderTopNavigation } from './top-navigation';

export function renderSalesPerformancePage() {
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>営業成績</title>
  ${renderSharedStyles('sales-performance')}
</head>
<body data-ui-page="sales-performance">
  <header>
    <h1>営業成績</h1>
    <div class="toolbar">
      <span id="salesPerformanceStatus" class="status ui-state-loading" aria-live="polite">読み込み中</span>
      ${renderTopNavigation('sales-performance')}
    </div>
  </header>
  <main>
    <section data-ui="sales-performance-filters">
      <div class="section-head"><h2>集計条件</h2><span id="salesPerformancePeriod" class="period-meta" aria-live="polite"></span></div>
      <div class="body">
        <form class="filters" onsubmit="applyFilters(event)">
          <label>開始日<input id="salesPerformanceFrom" type="date" required /></label>
          <label>終了日<input id="salesPerformanceTo" type="date" required /></label>
          <label>担当者<select id="salesPerformanceOwner"><option value="">すべての担当者</option></select></label>
          <label>取得元<select id="salesPerformanceSource"><option value="">すべての取得元</option><option value="campfire">CAMPFIRE</option><option value="makuake">Makuake</option><option value="green_funding">GREEN FUNDING</option><option value="other">その他</option><option value="manual">手動登録</option></select></label>
          <button class="primary" type="submit">適用</button>
        </form>
      </div>
    </section>
    <section data-ui="sales-performance-summary">
      <div class="section-head"><h2>件数</h2><span id="salesPerformanceAsOf" class="period-meta" aria-live="polite"></span></div>
      <div id="salesPerformanceCounts" class="body metric-grid"><div class="ui-state-loading">営業成績を読み込み中</div></div>
    </section>
    <section data-ui="sales-performance-rates">
      <div class="section-head"><h2>率</h2></div>
      <div class="body">
        <p class="rate-note">返信率・商談率・受注率はすべて接触リード数を分母として表示しています。</p>
        <div id="salesPerformanceRates" class="rate-grid"><div class="ui-state-loading">営業成績を読み込み中</div></div>
      </div>
    </section>
    <section data-ui="sales-performance-loss-reasons">
      <div class="section-head"><h2>失注理由</h2><span id="salesPerformanceLossCount" class="period-meta" aria-live="polite"></span></div>
      <div class="table-scroll">
        <table>
          <thead><tr><th>理由</th><th class="number">件数</th><th class="number">構成比</th></tr></thead>
          <tbody id="salesPerformanceLossReasons"><tr><td colspan="3" class="ui-state-loading">失注理由を読み込み中</td></tr></tbody>
        </table>
      </div>
    </section>
  </main>
  <footer>Sales AI System</footer>
  <script>
${renderClientApiScript()}
${renderNavigationBadgesScript()}
    const state = {
      report: null,
      assignees: [],
      salesPerformanceRequestGeneration: 0,
      salesPerformanceRequestController: null
    };
    const countMetrics = [
      ['sentMessages', '送信数'],
      ['contactedLeads', '接触リード'],
      ['repliedLeads', '返信リード'],
      ['meetingLeads', '商談リード'],
      ['wonLeads', '受注リード'],
      ['lostLeads', '失注リード']
    ];
    const rateMetrics = [
      ['replyRate', '返信率'],
      ['meetingRate', '商談率'],
      ['wonRate', '受注率']
    ];

    function api(path, options) {
      return window.SalesAiApi.request(path, options);
    }

    function tokyoDateKey(date) {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
    }

    function defaultFromDate() {
      const cursor = new Date(tokyoDateKey(new Date()) + 'T12:00:00+09:00');
      cursor.setUTCDate(cursor.getUTCDate() - 29);
      return tokyoDateKey(cursor);
    }

    function escapeHtml(value) {
      return String(value == null ? '' : value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
    }

    function formatCount(value) {
      return new Intl.NumberFormat('ja-JP').format(Number(value) || 0);
    }

    function formatRate(value) {
      return new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 1 }).format(Number(value) || 0) + '%';
    }

    function setStatus(message, type) {
      const element = document.getElementById('salesPerformanceStatus');
      element.textContent = message;
      element.className = 'status' + (type === 'loading' ? ' ui-state-loading' : type ? ' ' + type : '');
    }

    function reportPath() {
      const params = new URLSearchParams();
      const from = document.getElementById('salesPerformanceFrom').value;
      const to = document.getElementById('salesPerformanceTo').value;
      const ownerId = document.getElementById('salesPerformanceOwner').value;
      const source = document.getElementById('salesPerformanceSource').value;
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (ownerId) params.set('ownerId', ownerId);
      if (source) params.set('source', source);
      return '/api/reports/sales-performance?' + params.toString();
    }

    function renderReport() {
      const report = state.report;
      if (!report) return;
      const counts = report.counts || {};
      const rates = report.rates || {};
      const period = report.period || {};
      const lossReasons = Array.isArray(report.lossReasons) ? report.lossReasons : [];
      document.getElementById('salesPerformancePeriod').textContent = [period.from, period.to, period.timezone].filter(Boolean).join(' - ');
      document.getElementById('salesPerformanceAsOf').textContent = period.asOf ? '集計時点: ' + formatDateTime(period.asOf) : '';
      document.getElementById('salesPerformanceCounts').innerHTML = countMetrics.map(([key, label]) => '<div class="metric"><span class="metric-label">' + label + '</span><strong class="metric-value">' + formatCount(counts[key]) + '</strong></div>').join('');
      document.getElementById('salesPerformanceRates').innerHTML = rateMetrics.map(([key, label]) => '<div class="metric"><span class="metric-label">' + label + '</span><strong class="metric-value">' + formatRate(rates[key]) + '</strong></div>').join('');
      document.getElementById('salesPerformanceLossCount').textContent = lossReasons.length + '種類';
      document.getElementById('salesPerformanceLossReasons').innerHTML = lossReasons.length
        ? lossReasons.map((item) => '<tr><td>' + escapeHtml(item.label || item.reason || '未設定') + '</td><td class="number">' + formatCount(item.count) + '</td><td class="number">' + formatRate(item.share) + '</td></tr>').join('')
        : '<tr><td colspan="3" class="ui-state-empty">この条件の失注理由はありません。</td></tr>';
    }

    function renderError(message) {
      document.getElementById('salesPerformanceCounts').innerHTML = '<div class="ui-state-error">営業成績を読み込めませんでした。</div>';
      document.getElementById('salesPerformanceRates').innerHTML = '<div class="ui-state-error">営業成績を読み込めませんでした。</div>';
      document.getElementById('salesPerformanceLossReasons').innerHTML = '<tr><td colspan="3" class="ui-state-error">' + escapeHtml(message) + '</td></tr>';
    }

    function formatDateTime(value) {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return String(value);
      return new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date);
    }

    function isCurrentSalesPerformanceRequest(generation, controller) {
      return state.salesPerformanceRequestGeneration === generation && state.salesPerformanceRequestController === controller;
    }

    async function loadSalesPerformance() {
      const previousController = state.salesPerformanceRequestController;
      const generation = state.salesPerformanceRequestGeneration + 1;
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      state.salesPerformanceRequestGeneration = generation;
      state.salesPerformanceRequestController = controller;
      previousController?.abort();
      setStatus('読み込み中', 'loading');
      try {
        const report = await api(reportPath(), controller ? { signal: controller.signal } : {});
        if (!isCurrentSalesPerformanceRequest(generation, controller)) return;
        state.report = report;
        renderReport();
        setStatus('読み込み完了', 'ok');
      } catch (error) {
        if (!isCurrentSalesPerformanceRequest(generation, controller) || controller?.signal.aborted) return;
        renderError(error.message);
        setStatus('読み込みに失敗しました。条件を確認して再試行してください。', 'error');
      } finally {
        if (isCurrentSalesPerformanceRequest(generation, controller)) state.salesPerformanceRequestController = null;
      }
    }

    async function loadAssignees() {
      try {
        state.assignees = await api('/api/task-assignees');
        const select = document.getElementById('salesPerformanceOwner');
        select.innerHTML = '<option value="">すべての担当者</option>' + (Array.isArray(state.assignees) ? state.assignees : []).map((assignee) => '<option value="' + escapeHtml(assignee.id) + '">' + escapeHtml(assignee.name || assignee.email || '担当未設定') + '</option>').join('');
      } catch (_error) {
        setStatus('担当者候補を読み込めませんでした。全担当者で集計できます。', 'error');
      }
    }

    function applyFilters(event) {
      event.preventDefault();
      void loadSalesPerformance();
    }

    document.getElementById('salesPerformanceFrom').value = defaultFromDate();
    document.getElementById('salesPerformanceTo').value = tokyoDateKey(new Date());
    void Promise.all([loadAssignees(), loadSalesPerformance()]);
  </script>
</body>
</html>`;
}
