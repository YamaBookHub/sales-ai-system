import { renderSharedStyles } from './shared-styles';
import { renderClientApiScript } from '../client/api-client';
import { renderNavigationBadgesScript } from '../client/navigation-badges';
import { renderTopNavigation } from './top-navigation';

export function renderRepliesPage() {
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>返信対応 | Sales AI System</title>
  ${renderSharedStyles('replies')}
</head>
<body data-ui-page="replies">
  <header>
    <h1>返信対応</h1>
    <div class="toolbar">
      <span id="pageStatus" class="status ui-state-loading" aria-live="polite">返信を読み込み中</span>
      ${renderTopNavigation('replies')}
      <button onclick="loadReplies()">更新</button>
    </div>
  </header>
  <main>
    <section data-ui="reply-inbox">
      <div class="section-head">
        <h2>返信一覧</h2>
        <div class="summary" id="summary" aria-live="polite">
          <span class="summary-item">全件 <strong id="totalCount">0</strong></span>
          <span class="summary-item">manager確認 <strong id="managerCount">0</strong></span>
          <span class="summary-item">追客停止 <strong id="stopCount">0</strong></span>
        </div>
      </div>
      <div class="filters" data-ui="reply-filters">
        <div class="field"><label for="attention">対応状態</label><select id="attention" onchange="changeFilter()"><option value="all">すべて</option><option value="needs_action">要対応</option><option value="manager_review">manager確認</option><option value="stop_followup">追客停止</option></select></div>
        <div class="field"><label for="category">返信分類</label><select id="category" onchange="changeFilter()"><option value="all">すべて</option><option value="interested">興味あり</option><option value="need_info">資料・詳細希望</option><option value="meeting_request">商談希望</option><option value="not_interested">見送り</option><option value="unsubscribe">配信停止</option><option value="complaint">クレーム</option><option value="auto_reply">自動返信</option><option value="unknown">要確認</option></select></div>
        <div class="field"><label for="sort">並び順</label><select id="sort" onchange="changeFilter()"><option value="receivedAt">受信日時</option><option value="priority">優先度</option><option value="confidence">AI確信度</option></select></div>
        <div class="field"><label for="direction">順序</label><select id="direction" onchange="changeFilter()"><option value="desc">新しい順</option><option value="asc">古い順</option></select></div>
        <div class="field"><label>&nbsp;</label><button type="button" onclick="resetFilters()">条件をリセット</button></div>
      </div>
      <div class="body">
        <div id="replyList" class="reply-list" data-ui="reply-list">
          <div class="ui-state-loading">返信を読み込み中</div>
          <div class="ui-state-empty" hidden>表示できる返信はありません</div>
          <div class="ui-state-error" hidden>返信を読み込めませんでした</div>
        </div>
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
    const state = { page: 1, limit: 20, total: 0, items: [] };
    const categoryLabels = { interested:'興味あり', need_info:'資料・詳細希望', meeting_request:'商談希望', not_interested:'見送り', unsubscribe:'配信停止', complaint:'クレーム', auto_reply:'自動返信', unknown:'要確認' };

    function escapeHtml(value) {
      return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[char] || char));
    }

    function setStatus(message, type) {
      const element = document.getElementById('pageStatus');
      element.textContent = message;
      element.className = 'status ' + (type ? 'ui-state-' + type : '');
    }

    function currentFilters() {
      return { attention: document.getElementById('attention').value, category: document.getElementById('category').value, sort: document.getElementById('sort').value, direction: document.getElementById('direction').value };
    }

    async function loadReplies() {
      const list = document.getElementById('replyList');
      list.innerHTML = '<div class="ui-state-loading">返信を読み込み中</div>';
      setStatus('返信を読み込み中', 'loading');
      const params = new URLSearchParams({ page: String(state.page), limit: String(state.limit) });
      const filters = currentFilters();
      Object.entries(filters).forEach(([key, value]) => { if (value && value !== 'all') params.set(key, value); });
      try {
        const payload = await window.SalesAiApi.request('/api/replies?' + params.toString(), {}, { unwrapData: false, errorMode: 'http' });
        state.items = Array.isArray(payload.items) ? payload.items : [];
        state.total = Number(payload.total) || 0;
        state.page = Number(payload.page) || state.page;
        renderReplies();
        setStatus('読み込み完了', 'ready');
      } catch (error) {
        state.items = [];
        state.total = 0;
        list.innerHTML = '<div class="ui-state-error">返信を読み込めませんでした。時間をおいて再度お試しください。</div>';
        updatePagination();
        setStatus('読み込みエラー', 'error');
      }
    }

    function renderReplies() {
      const list = document.getElementById('replyList');
      const managerCount = state.items.filter((item) => item.flags && item.flags.managerReviewRequired).length;
      const stopCount = state.items.filter((item) => item.flags && item.flags.stopFollowup).length;
      document.getElementById('totalCount').textContent = String(state.total);
      document.getElementById('managerCount').textContent = String(managerCount);
      document.getElementById('stopCount').textContent = String(stopCount);
      if (!state.items.length) {
        list.innerHTML = '<div class="ui-state-empty">表示できる返信はありません</div>';
        updatePagination();
        return;
      }
      const rows = state.items.map((item) => {
        const flags = item.flags || {};
        const category = categoryLabels[item.category] || item.category || '要確認';
        const badges = '<span class="badge ' + escapeHtml(item.priority || '') + '">' + escapeHtml(category) + '</span>' + (flags.managerReviewRequired ? '<span class="badge critical">manager確認</span>' : '') + (flags.stopFollowup ? '<span class="badge stop">追客停止</span>' : '');
        const project = item.lead && item.lead.project ? item.lead.project.title : '案件未紐付け';
        const contact = item.contact && (item.contact.name || item.contact.email) ? (item.contact.name || item.contact.email) : (item.fromEmail || '送信元不明');
        const action = item.lead && item.lead.id ? '<button type="button" data-lead-id="' + escapeHtml(item.lead.id) + '" onclick="openLead(this.dataset.leadId)">案件を開く</button>' : '<span class="meta">担当未設定</span>';
        const rowClass = flags.managerReviewRequired ? ' class="manager-review"' : '';
        return '<tr' + rowClass + '><td><span class="company">' + escapeHtml(item.company && item.company.name) + '</span><span class="project">' + escapeHtml(project) + '</span><span class="meta">' + escapeHtml(contact) + '</span></td><td>' + badges + '<span class="meta">確信度 ' + escapeHtml(Math.round((Number(item.confidence) || 0) * 100)) + '%</span></td><td><strong>' + escapeHtml(item.summary || item.mail && item.mail.subject || '返信') + '</strong><span class="preview">' + escapeHtml(item.bodyText || '本文なし') + '</span></td><td class="next-action">' + escapeHtml(item.nextAction || '返信内容を確認し、次対応を判断する。') + '</td><td>' + escapeHtml(formatDate(item.receivedAt)) + '<span class="meta">' + escapeHtml(item.fromEmail || '') + '</span></td><td>' + action + '</td></tr>';
      }).join('');
      list.innerHTML = '<table><thead><tr><th>会社・案件</th><th>分類</th><th>返信</th><th>次の対応</th><th>受信日時</th><th>操作</th></tr></thead><tbody>' + rows + '</tbody></table>';
      updatePagination();
    }

    function formatDate(value) {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? '日時不明' : date.toLocaleString('ja-JP', { timeZone:'Asia/Tokyo', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
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
      loadReplies();
    }

    function changeFilter() {
      state.page = 1;
      loadReplies();
    }

    function resetFilters() {
      document.getElementById('attention').value = 'all';
      document.getElementById('category').value = 'all';
      document.getElementById('sort').value = 'receivedAt';
      document.getElementById('direction').value = 'desc';
      changeFilter();
    }

    function openLead(leadId) {
      if (!leadId) return;
      try { localStorage.setItem('salesAiSystem.selectedLeadId', leadId); } catch (error) { /* local selection is optional */ }
      location.href = '/leads-view';
    }

    loadReplies();
  </script>
</body>
</html>`;
}
