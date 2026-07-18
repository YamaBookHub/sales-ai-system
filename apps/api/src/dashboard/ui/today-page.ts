import { renderSharedStyles } from './shared-styles';
import { renderClientApiScript } from '../client/api-client';
import { renderNavigationBadgesScript } from '../client/navigation-badges';
import { renderTopNavigation } from './top-navigation';

export function renderTodayPage() {
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>今日の営業</title>
  ${renderSharedStyles('today')}
</head>
<body data-ui-page="today">
  <header>
    <h1>今日の営業</h1>
    <div class="toolbar">
      <span id="pageStatus" class="status ui-state-loading" aria-live="polite">読み込み中</span>
      ${renderTopNavigation('today')}
      <button onclick="loadToday()">更新</button>
    </div>
  </header>
  <main>
    <section data-ui="today-workspace">
      <div class="section-head"><h2>今日の対応</h2><span id="todayDate" class="status muted" aria-live="polite"></span></div>
      <div class="body">
        <div class="today-stats" id="todayStats"></div>
      </div>
    </section>
    <section data-ui="today-lead-list">
      <div class="section-head"><h2>優先して見る案件</h2><span id="todayCount" class="status muted" aria-live="polite">0件</span></div>
      <div class="body">
        <div class="today-list" id="todayRows"><div class="ui-state-loading">今日の対応を読み込み中</div></div>
        <div class="pagination">
          <button id="previousButton" type="button" onclick="changePage(-1)" disabled>前へ</button>
          <span id="pageLabel">1 / 1</span>
          <button id="nextButton" type="button" onclick="changePage(1)" disabled>次へ</button>
        </div>
      </div>
    </section>
  </main>
  <footer>Sales AI System</footer>
  <script>
${renderClientApiScript()}
${renderNavigationBadgesScript()}
    const state = { page: 1, limit: 50, total: 0, items: [], counts: {} };
    const categories = [
      ['overdue', '期限超過', '次対応日を確認'],
      ['due_today', '今日が期限', '今日の対応'],
      ['draft_review', '下書き確認', '本文を確認'],
      ['approval_pending', '承認待ち', 'チェック・承認'],
      ['send_queue', '送信待ち', '送信状態を確認'],
      ['reply_received', '返信あり', '返信を確認'],
      ['send_failed', '送信失敗', '失敗理由を確認']
    ];

    async function api(path) {
      return window.SalesAiApi.request(path);
    }

    async function loadToday() {
      setPageStatus('読み込み中', 'loading');
      try {
        const payload = await api('/api/leads/today?page=' + state.page + '&limit=' + state.limit);
        state.items = payload.items || [];
        state.counts = payload.counts || {};
        state.total = Number(payload.total) || 0;
        state.page = Number(payload.page) || state.page;
        renderToday();
        setPageStatus('読み込み完了', 'ok');
      } catch (error) {
        setPageStatus('読み込みに失敗しました: ' + error.message + '。更新して再試行してください。', 'error');
        document.getElementById('todayRows').innerHTML = '<div class="error">今日の対応を読み込めませんでした。</div>';
      }
    }

    function renderToday() {
      document.getElementById('todayDate').textContent = tokyoDateKey(new Date());
      const counts = state.counts;
      document.getElementById('todayStats').innerHTML = categories.map(([key, label, hint]) => '<button class="today-stat" type="button" data-today-category="' + key + '" data-active="' + Boolean(counts[key]) + '" onclick="openCategory(&quot;' + key + '&quot;)"><strong>' + counts[key] + '</strong><span>' + label + ' / ' + hint + '</span></button>').join('');
      const rows = state.items
        .map(({ lead, mail, category }) => '<button class="today-row" type="button" data-lead-id="' + escapeAttr(lead.id) + '" onclick="openLead(this.dataset.leadId)"><strong>' + escapeHtml(lead.company?.name || lead.companyId || '会社名未取得') + '</strong><span class="reason">' + escapeHtml(categoryLabel(category)) + '</span><span class="badge">' + escapeHtml(mail?.status ? mailStatusLabel(mail.status) : lead.status || '未判定') + '</span><span class="date meta">' + escapeHtml(formatDate(lead.nextTask?.dueAt || lead.nextActionAt || lead.nextFollowUpAt)) + '</span></button>')
        .join('');
      document.getElementById('todayCount').textContent = state.total + '件';
      document.getElementById('todayRows').innerHTML = rows || '<div class="ui-state-empty">今日の対応はありません。営業案件から候補を探してください。</div>';
      updatePagination();
    }

    function updatePagination() {
      const pages = Math.max(1, Math.ceil(state.total / state.limit));
      document.getElementById('pageLabel').textContent = state.page + ' / ' + pages;
      document.getElementById('previousButton').disabled = state.page <= 1;
      document.getElementById('nextButton').disabled = state.page >= pages;
    }
    function changePage(delta) {
      const pages = Math.max(1, Math.ceil(state.total / state.limit));
      state.page = Math.min(pages, Math.max(1, state.page + delta));
      loadToday();
    }
    function categoryLabel(category) { return categories.find(([key]) => key === category)?.[1] || '今日の対応'; }
    function openCategory(category) { const mailFilter = { draft_review: 'draft', approval_pending: 'approved', send_queue: 'queued', send_failed: 'failed' }[category]; const statusFilter = category === 'reply_received' ? 'replied' : ''; location.href = mailFilter ? '/leads-view?mailFilter=' + encodeURIComponent(mailFilter) : statusFilter ? '/leads-view?statusFilter=' + encodeURIComponent(statusFilter) : '/leads-view'; }
    function openLead(id) { localStorage.setItem('salesAiSystem.selectedLeadId', id); location.href = '/leads-view'; }
    function tokyoDateKey(value) { const date = new Date(value); if (Number.isNaN(date.getTime())) return ''; const parts = new Intl.DateTimeFormat('en-US', { timeZone:'Asia/Tokyo', year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(date); const values = Object.fromEntries(parts.map((part) => [part.type, part.value])); return values.year + '-' + values.month + '-' + values.day; }
    function formatDate(value) { if (!value) return '日付未定'; const date = new Date(value); return Number.isNaN(date.getTime()) ? '日付未定' : date.toLocaleString('ja-JP', { timeZone:'Asia/Tokyo', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }); }
    function mailStatusLabel(value) { return ({ draft:'下書き', in_review:'確認待ち', approved:'承認済み', queued:'送信待ち', failed:'送信失敗', sent:'送信済み' })[value] || value; }
    function setPageStatus(message, type) { const element = document.getElementById('pageStatus'); element.textContent = message; element.className = 'status ' + (type === 'loading' ? 'ui-state-loading' : type === 'error' ? 'error' : 'ok'); }
    function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[char])); }
    function escapeAttr(value) { return escapeHtml(value); }
    loadToday();
  </script>
</body>
</html>`;
}
