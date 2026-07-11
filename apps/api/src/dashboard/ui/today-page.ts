export function renderTodayPage() {
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>今日の営業</title>
  <style>
    :root { color-scheme: light; --bg:#f6f7f9; --panel:#fff; --text:#172026; --muted:#66737f; --line:#dfe4ea; --accent:#136f63; --warn:#9f5a00; --danger:#a83232; --ok:#1d7b45; }
    * { box-sizing: border-box; }
    body { margin:0; background:var(--bg); color:var(--text); font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans","Yu Gothic",sans-serif; font-size:14px; }
    header { min-height:58px; display:flex; align-items:center; justify-content:space-between; gap:16px; padding:0 24px; border-bottom:1px solid var(--line); background:var(--panel); position:sticky; top:0; z-index:10; }
    h1 { font-size:18px; margin:0; }
    h2 { font-size:15px; margin:0; }
    button { font:inherit; border:1px solid var(--line); background:var(--panel); color:var(--text); min-height:34px; border-radius:6px; padding:0 12px; cursor:pointer; }
    button.primary { background:var(--accent); border-color:var(--accent); color:white; }
    button:disabled { opacity:.55; cursor:not-allowed; }
    .toolbar { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
    .top-nav { display:inline-flex; gap:4px; padding:4px; border:1px solid var(--line); border-radius:8px; background:#f4f6f8; }
    .top-nav button { border-color:transparent; background:transparent; }
    .top-nav button.primary { background:var(--accent); color:white; }
    .nav-badge { display:inline-flex; align-items:center; justify-content:center; min-width:18px; height:18px; margin-left:4px; padding:0 5px; border-radius:9px; background:var(--warn); color:white; font-size:11px; line-height:1; font-variant-numeric:tabular-nums; }
    .nav-badge[hidden] { display:none; }
    main { display:grid; gap:10px; padding:12px; max-width:1240px; margin:0 auto; }
    section { border:1px solid var(--line); border-radius:4px; background:var(--panel); overflow:hidden; }
    .section-head { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 12px; border-bottom:1px solid var(--line); }
    .body { padding:12px; }
    .status { font-size:13px; min-height:18px; }
    .muted { color:var(--muted); }
    .ok { color:var(--ok); }
    .warn { color:var(--warn); }
    .error { color:var(--danger); font-weight:600; }
    .ui-state-loading { color:var(--muted); }
    .ui-state-empty { color:var(--muted); padding:16px 0; }
    .ui-state-error { color:var(--danger); font-weight:600; }
    .today-stats { display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); gap:8px; }
    .today-stat { display:grid; gap:4px; min-height:82px; padding:10px; text-align:left; border-radius:4px; background:#fbfcfd; }
    .today-stat[data-active="true"] { border-color:var(--accent); background:#eef8f5; }
    .today-stat strong { font-size:22px; }
    .today-stat span { color:var(--muted); line-height:1.4; }
    .today-list { display:grid; gap:0; }
    .today-row { display:grid; grid-template-columns:170px minmax(0,1fr) 140px 160px; gap:12px; align-items:center; width:100%; min-height:58px; padding:9px 0; border:0; border-bottom:1px solid var(--line); border-radius:0; text-align:left; }
    .today-row:hover { background:#f7faf9; }
    .today-row strong, .today-row span { min-width:0; overflow-wrap:anywhere; }
    .today-row .reason { font-weight:600; }
    .today-row .meta { color:var(--muted); font-size:12px; }
    .today-row .badge { display:inline-block; width:max-content; padding:3px 7px; border:1px solid var(--line); border-radius:4px; color:var(--muted); }
    footer { max-width:1240px; margin:0 auto; padding:0 12px 14px; color:var(--muted); font-size:12px; }
    @media (max-width:1050px) { .today-stats { grid-template-columns:repeat(4,minmax(0,1fr)); } .today-row { grid-template-columns:140px minmax(0,1fr) 120px; } .today-row .date { display:none; } }
    @media (max-width:700px) { header { padding:0 14px; align-items:flex-start; padding-top:12px; padding-bottom:12px; } .top-nav { max-width:100%; overflow:auto; } .today-stats { grid-template-columns:repeat(2,minmax(0,1fr)); } .today-row { grid-template-columns:minmax(0,1fr) auto; gap:6px; } .today-row .reason { grid-column:1 / -1; grid-row:1; } .today-row strong { grid-column:1; grid-row:2; } .today-row .badge { grid-column:2; grid-row:2; } }
  </style>
</head>
<body data-ui-page="today">
  <header>
    <h1>今日の営業</h1>
    <div class="toolbar">
      <span id="pageStatus" class="status ui-state-loading">読み込み中</span>
      <div class="top-nav" data-ui="top-nav">
        <button class="primary" onclick="location.href='/today'">今日の営業 <span class="nav-badge" data-nav-badge="today" hidden></span></button>
        <button onclick="location.href='/leads-view'">営業案件 <span class="nav-badge" data-nav-badge="leads" hidden></span></button>
        <button onclick="location.href='/mail-workspace'">作成・レビュー <span class="nav-badge" data-nav-badge="mail" hidden></span></button>
        <button onclick="location.href='/'">候補を探す</button>
      </div>
      <button onclick="loadToday()">更新</button>
    </div>
  </header>
  <main>
    <section data-ui="today-workspace">
      <div class="section-head"><h2>今日の対応</h2><span id="todayDate" class="status muted"></span></div>
      <div class="body">
        <div class="today-stats" id="todayStats"></div>
      </div>
    </section>
    <section data-ui="today-lead-list">
      <div class="section-head"><h2>優先して見る案件</h2><span id="todayCount" class="status muted">0件</span></div>
      <div class="body"><div class="today-list" id="todayRows"><div class="ui-state-loading">今日の対応を読み込み中</div></div></div>
    </section>
  </main>
  <footer>Sales AI System</footer>
  <script>
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
      const response = await fetch(path, { headers: { 'Content-Type': 'application/json' } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || payload.error?.message || 'APIエラー');
      return payload.data;
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
        .map(({ lead, mail, category }) => '<button class="today-row" type="button" data-lead-id="' + escapeAttr(lead.id) + '" onclick="openLead(this.dataset.leadId)"><strong>' + escapeHtml(lead.company?.name || lead.companyId || '会社名未取得') + '</strong><span class="reason">' + escapeHtml(categoryLabel(category)) + '</span><span class="badge">' + escapeHtml(mail?.status ? mailStatusLabel(mail.status) : lead.status || '未判定') + '</span><span class="date meta">' + escapeHtml(formatDate(lead.nextActionAt || lead.nextFollowUpAt)) + '</span></button>')
        .join('');
      document.getElementById('todayCount').textContent = state.items.length + '件';
      document.getElementById('todayRows').innerHTML = rows || '<div class="ui-state-empty">今日の対応はありません。営業案件から候補を探してください。</div>';
    }

    function classifyToday(lead) {
      const mail = latestMail(lead.id);
      const due = lead.nextActionAt || lead.nextFollowUpAt;
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
    function formatDate(value) { if (!value) return '日付未定'; const date = new Date(value); return Number.isNaN(date.getTime()) ? '日付未定' : date.toLocaleString('ja-JP', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }); }
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
