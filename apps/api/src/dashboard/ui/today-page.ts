import { renderSharedStyles } from './shared-styles';
import { renderClientApiScript } from '../client/api-client';

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
      <div class="top-nav" data-ui="top-nav">
        <button class="primary" onclick="location.href='/today'">今日の営業 <span class="nav-badge" data-nav-badge="today" hidden></span></button>
        <button onclick="location.href='/replies'">返信</button>
        <button onclick="location.href='/leads-view'">営業案件 <span class="nav-badge" data-nav-badge="leads" hidden></span></button>
        <button onclick="location.href='/mail-workspace'">作成・レビュー <span class="nav-badge" data-nav-badge="mail" hidden></span></button>
        <button onclick="location.href='/'">候補を探す</button>
      </div>
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
      <div class="body"><div class="today-list" id="todayRows"><div class="ui-state-loading">今日の対応を読み込み中</div></div></div>
    </section>
  </main>
  <footer>Sales AI System</footer>
  <script>
${renderClientApiScript()}
    const state = { leads: [], mails: [], items: [] };
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
        const [leads, mails] = await Promise.all([api('/api/leads?limit=200'), api('/api/mails?limit=200')]);
        state.leads = leads.items || [];
        state.mails = mails.items || [];
        state.items = state.leads.map((lead) => ({ lead, mail: latestMail(lead.id), category: classifyToday(lead) })).filter((item) => item.category);
        renderToday();
        setPageStatus('読み込み完了', 'ok');
      } catch (error) {
        setPageStatus('読み込みに失敗しました: ' + error.message + '。更新して再試行してください。', 'error');
        document.getElementById('todayRows').innerHTML = '<div class="error">今日の対応を読み込めませんでした。</div>';
      }
    }

    function renderToday() {
      document.getElementById('todayDate').textContent = tokyoDateKey(new Date());
      renderNavigationBadges();
      const counts = Object.fromEntries(categories.map(([key]) => [key, state.items.filter((item) => item.category === key).length]));
      document.getElementById('todayStats').innerHTML = categories.map(([key, label, hint]) => '<button class="today-stat" type="button" data-today-category="' + key + '" data-active="' + Boolean(counts[key]) + '" onclick="openCategory(&quot;' + key + '&quot;)"><strong>' + counts[key] + '</strong><span>' + label + ' / ' + hint + '</span></button>').join('');
      const rows = state.items
        .sort((left, right) => categoryRank(left.category) - categoryRank(right.category) || String(left.lead.company?.name || left.lead.companyId).localeCompare(String(right.lead.company?.name || right.lead.companyId), 'ja'))
        .slice(0, 20)
        .map(({ lead, mail, category }) => '<button class="today-row" type="button" data-lead-id="' + escapeAttr(lead.id) + '" onclick="openLead(this.dataset.leadId)"><strong>' + escapeHtml(lead.company?.name || lead.companyId || '会社名未取得') + '</strong><span class="reason">' + escapeHtml(categoryLabel(category)) + '</span><span class="badge">' + escapeHtml(mail?.status ? mailStatusLabel(mail.status) : lead.status || '未判定') + '</span><span class="date meta">' + escapeHtml(formatDate(lead.nextTask?.dueAt || lead.nextActionAt || lead.nextFollowUpAt)) + '</span></button>')
        .join('');
      document.getElementById('todayCount').textContent = state.items.length + '件';
      document.getElementById('todayRows').innerHTML = rows || '<div class="ui-state-empty">今日の対応はありません。営業案件から候補を探してください。</div>';
    }

    function classifyToday(lead) {
      const mail = latestMail(lead.id);
      const due = lead.nextTask?.dueAt || lead.nextActionAt || lead.nextFollowUpAt;
      const dueKey = tokyoDateKey(due);
      const today = tokyoDateKey(new Date());
      if (dueKey && dueKey < today) return 'overdue';
      if (dueKey && dueKey === today) return 'due_today';
      if (lead.status === 'replied') return 'reply_received';
      if (mail?.status === 'failed') return 'send_failed';
      if (mail?.status === 'draft') return 'draft_review';
      if (mail?.status === 'approved') return 'approval_pending';
      if (mail?.status === 'queued') return 'send_queue';
      return null;
    }

    function latestMail(leadId) { return state.mails.filter((mail) => mail.leadId === leadId || mail.lead?.id === leadId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]; }
    function categoryRank(category) { return categories.findIndex(([key]) => key === category); }
    function categoryLabel(category) { return categories.find(([key]) => key === category)?.[1] || '今日の対応'; }
    function openCategory(category) { const mailFilter = { draft_review: 'draft', approval_pending: 'approved', send_queue: 'queued', send_failed: 'failed' }[category]; const statusFilter = category === 'reply_received' ? 'replied' : ''; location.href = mailFilter ? '/leads-view?mailFilter=' + encodeURIComponent(mailFilter) : statusFilter ? '/leads-view?statusFilter=' + encodeURIComponent(statusFilter) : '/leads-view'; }
    function openLead(id) { localStorage.setItem('salesAiSystem.selectedLeadId', id); location.href = '/leads-view'; }
    function tokyoDateKey(value) { const date = new Date(value); if (Number.isNaN(date.getTime())) return ''; const parts = new Intl.DateTimeFormat('en-US', { timeZone:'Asia/Tokyo', year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(date); const values = Object.fromEntries(parts.map((part) => [part.type, part.value])); return values.year + '-' + values.month + '-' + values.day; }
    function formatDate(value) { if (!value) return '日付未定'; const date = new Date(value); return Number.isNaN(date.getTime()) ? '日付未定' : date.toLocaleString('ja-JP', { timeZone:'Asia/Tokyo', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }); }
    function mailStatusLabel(value) { return ({ draft:'下書き', in_review:'確認待ち', approved:'承認済み', queued:'送信待ち', failed:'送信失敗', sent:'送信済み' })[value] || value; }
    function renderNavigationBadges() { setNavigationBadge('today', state.items.length); setNavigationBadge('leads', state.leads.length); setNavigationBadge('mail', state.mails.filter((mail) => ['draft', 'in_review', 'approved', 'queued'].includes(mail.status)).length); }
    function setNavigationBadge(key, count) { const element = document.querySelector('[data-nav-badge="' + key + '"]'); if (!element) return; const value = Number(count) || 0; element.textContent = value > 99 ? '99+' : String(value); element.hidden = value === 0; element.setAttribute('aria-label', value + '件'); }
    function setPageStatus(message, type) { const element = document.getElementById('pageStatus'); element.textContent = message; element.className = 'status ' + (type === 'loading' ? 'ui-state-loading' : type === 'error' ? 'error' : 'ok'); }
    function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[char])); }
    function escapeAttr(value) { return escapeHtml(value); }
    loadToday();
  </script>
</body>
</html>`;
}
