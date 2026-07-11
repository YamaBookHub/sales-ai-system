export function renderLeadsPage() {
    return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>営業案件詳細</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f6f7f9;
      --panel: #ffffff;
      --text: #172026;
      --muted: #66737f;
      --line: #dfe4ea;
      --accent: #136f63;
      --warn: #9f5a00;
      --danger: #a83232;
      --ok: #1d7b45;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif;
      font-size: 14px;
    }
    header {
      min-height: 58px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 0 24px;
      border-bottom: 1px solid var(--line);
      background: var(--panel);
      position: sticky;
      top: 0;
      z-index: 10;
    }
    h1 { font-size: 18px; margin: 0; }
    .top-nav {
      display: inline-flex;
      gap: 4px;
      padding: 4px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #f4f6f8;
    }
    .top-nav button {
      border-color: transparent;
      background: transparent;
    }
    .top-nav button.primary {
      background: var(--accent);
      color: white;
    }
    .nav-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 18px;
      height: 18px;
      margin-left: 4px;
      padding: 0 5px;
      border-radius: 9px;
      background: var(--warn);
      color: white;
      font-size: 11px;
      line-height: 1;
      font-variant-numeric: tabular-nums;
    }
    .nav-badge[hidden] { display: none; }
    button, input, select { font: inherit; }
    button {
      border: 1px solid var(--line);
      background: var(--panel);
      color: var(--text);
      height: 34px;
      border-radius: 6px;
      padding: 0 12px;
      cursor: pointer;
    }
    button.primary { background: var(--accent); border-color: var(--accent); color: white; }
    input, select {
      height: 36px;
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 0 10px;
      background: white;
      min-width: 0;
    }
    main { padding: 12px; display: grid; gap: 10px; }
    section {
      border: 1px solid var(--line);
      background: var(--panel);
      border-radius: 4px;
      overflow: hidden;
    }
    .section-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 12px;
      border-bottom: 1px solid var(--line);
    }
    h2 { font-size: 15px; margin: 0; }
    .body { padding: 12px; }
    .toolbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .filters {
      display: grid;
      grid-template-columns: minmax(220px, 1fr) repeat(4, minmax(150px, 180px));
      gap: 8px;
    }
    .summary-panel { order: 1; }
    .filters-panel { order: 2; }
    .lead-list-main { order: 3; }
    .export-tools { order: 4; }
    .collapsible-panel summary {
      min-height: 48px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 0 16px;
      cursor: pointer;
      font-weight: 700;
    }
    .collapsible-panel details[open] summary {
      border-bottom: 1px solid var(--line);
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 10px;
    }
    .export-panel {
      display: grid;
      grid-template-columns: minmax(170px, 220px) minmax(170px, 220px) minmax(190px, 260px) auto minmax(180px, 1fr);
      gap: 10px;
      align-items: center;
    }
    .export-preview {
      color: var(--muted);
      font-size: 13px;
    }
    .attention-reason {
      font-weight: 600;
      line-height: 1.45;
      overflow-wrap: anywhere;
    }
    .stat {
      border: 1px solid var(--line);
      border-radius: 4px;
      padding: 10px;
      background: #fbfcfd;
      height: auto;
      text-align: left;
    }
    .stat strong { display: block; font-size: 22px; margin-bottom: 4px; }
    .stat[data-active="true"] {
      border-color: var(--accent);
      background: #eef8f5;
      color: var(--text);
    }
    .muted { color: var(--muted); }
    .status { font-size: 13px; }
    .ui-state-loading { color: var(--muted); }
    .ui-state-empty { color: var(--muted); }
    .ui-state-error { color: var(--danger); font-weight: 600; }
    .split {
      display: grid;
      grid-template-columns: minmax(0, 1.65fr) minmax(360px, .75fr);
      gap: 10px;
      align-items: start;
    }
    .lead-detail-panel {
      position: sticky;
      top: 70px;
      max-height: calc(100vh - 82px);
      overflow: auto;
    }
    .detail-next-action {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 10px;
      padding: 10px 12px;
      border-bottom: 1px solid var(--line);
      background: #f5faf8;
    }
    .detail-next-action strong,
    .detail-next-action span { overflow-wrap: anywhere; }
    .lead-detail-stack {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 10px;
    }
    .detail-shell {
      display: grid;
      grid-template-columns: minmax(0, 1.1fr) minmax(360px, .9fr);
      gap: 10px;
      align-items: start;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    .table-scroll {
      overflow: auto;
      border-top: 0;
    }
    .table-scroll table {
      margin: 0;
      min-width: 1180px;
    }
    .table-scroll thead th {
      position: sticky;
      top: 0;
      z-index: 2;
      border-bottom: 1px solid var(--line);
    }
    .lead-list-scroll {
      max-height: 420px;
    }
    th, td {
      padding: 12px 10px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      vertical-align: top;
      line-height: 1.55;
    }
    th {
      font-size: 12px;
      color: var(--muted);
      background: #fbfcfd;
      position: static;
      line-height: 1.4;
    }
    th.sortable {
      cursor: pointer;
      user-select: none;
      white-space: nowrap;
    }
    th.sortable:hover {
      color: var(--accent);
      background: #eef7f4;
    }
    .sort-mark {
      margin-left: 4px;
      color: var(--accent);
      font-size: 12px;
    }
    tr { cursor: pointer; }
    tr:hover { background: #f8fbfa; }
    tr[data-selected="true"] { background: #eef8f5; }
    .clip {
      display: block;
      min-height: 1.55em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1.55;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      min-height: 24px;
      border: 1px solid var(--line);
      border-radius: 4px;
      padding: 2px 8px;
      font-size: 12px;
      background: white;
    }
    .badge.ok { color: var(--ok); border-color: #bddfc9; background: #f1fbf4; }
    .badge.warn { color: var(--warn); border-color: #ecd2a8; background: #fff8eb; }
    .badge.danger { color: var(--danger); border-color: #ecc4c4; background: #fff4f4; }
    .detail-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
    .detail-item { border: 1px solid var(--line); border-radius: 4px; padding: 8px; }
    .detail-label { color: var(--muted); font-size: 12px; margin-bottom: 4px; }
    .detail-value { word-break: break-word; }
    .row { margin-top: 12px; }
    .row label { display: block; color: var(--muted); font-size: 12px; margin-bottom: 5px; }
    .detail-text {
      border: 1px solid var(--line);
      border-radius: 4px;
      padding: 8px;
      background: #fbfcfd;
      white-space: pre-wrap;
      max-height: 180px;
      overflow: auto;
    }
    .ai-evidence-section {
      margin-top: 12px;
      padding-top: 10px;
      border-top: 1px solid var(--line);
    }
    .ai-evidence-heading {
      margin: 0 0 7px;
      font-size: 13px;
    }
    .ai-evidence-risk {
      border-left: 4px solid var(--warn);
      padding-left: 10px;
      background: #fffaf1;
    }
    .ai-evidence-risk .ai-evidence-heading { color: var(--warn); }
    textarea {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 4px;
      padding: 8px;
      font: inherit;
      line-height: 1.7;
      resize: vertical;
      min-height: 82px;
    }
    .form-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px;
    }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }
    footer {
      padding: 0 12px 14px;
      color: var(--muted);
      font-size: 12px;
    }
    @media (max-width: 1100px) {
      .filters, .stats, .split, .detail-grid, .detail-shell, .form-grid, .export-panel { grid-template-columns: 1fr; }
      .lead-detail-panel {
        position: static;
        max-height: none;
        overflow: visible;
      }
      .detail-next-action { grid-template-columns: 1fr; }
      th { position: static; }
    }
  </style>
</head>
<body data-ui-page="leads">
  <header>
    <h1>営業案件詳細</h1>
    <div class="toolbar">
      <span id="pageStatus" class="status ui-state-loading">読み込み中</span>
      <div class="top-nav" data-ui="top-nav">
        <button onclick="location.href='/today'">今日の営業 <span class="nav-badge" data-nav-badge="today" hidden></span></button>
        <button onclick="location.href='/'">候補を探す</button>
        <button class="primary" onclick="location.href='/leads-view'">営業案件 <span class="nav-badge" data-nav-badge="leads" hidden></span></button>
        <button onclick="location.href='/mail-workspace'">作成・レビュー <span class="nav-badge" data-nav-badge="mail" hidden></span></button>
      </div>
      <button class="primary" onclick="loadAll()">更新</button>
    </div>
  </header>
  <main>
    <section class="summary-panel">
      <div class="section-head">
        <h2>状態サマリー</h2>
        <div class="toolbar">
          <span id="summaryFilterStatus" class="status muted">全件</span>
          <button id="clearSummaryFilterButton" onclick="setSummaryFilter('all')" disabled>絞り込み解除</button>
        </div>
      </div>
      <div class="body">
        <div class="stats" id="stats"></div>
      </div>
    </section>

    <section class="export-tools collapsible-panel" data-ui="lead-export-tools">
      <details>
        <summary>
          <span>その他の操作</span>
          <span class="status muted">CSV / TSV出力</span>
        </summary>
        <div class="body export-panel">
          <select id="exportScope" onchange="updateExportPreview()">
            <option value="visible">表示中だけ出力</option>
            <option value="all">全件出力</option>
          </select>
          <select id="exportFormat" onchange="updateExportPreview()">
            <option value="csv">CSV</option>
            <option value="tsv">TSV</option>
          </select>
          <select id="exportColumns" onchange="updateExportPreview()">
            <option value="summary">一覧用</option>
            <option value="detail">詳細用</option>
          </select>
          <button class="primary" onclick="exportLeads()">出力する</button>
          <span id="exportPreview" class="export-preview">表示中の営業案件をCSVで出力します</span>
          <span id="exportStatus" class="status muted"></span>
        </div>
      </details>
    </section>

    <div class="split lead-list-main" data-ui="lead-list-workspace">
      <section>
        <div class="section-head">
          <h2>営業案件</h2>
          <span id="listCount" class="status muted">0件</span>
        </div>
        <div class="body table-scroll lead-list-scroll" style="padding:0">
          <table>
            <thead>
              <tr>
                <th class="sortable" onclick="toggleSort('lead','company')" style="width:16%">会社<span id="leadSort-company" class="sort-mark"></span></th>
                <th class="sortable" onclick="toggleSort('lead','project')">案件<span id="leadSort-project" class="sort-mark"></span></th>
                <th class="sortable" onclick="toggleSort('lead','source')" style="width:92px">取得元<span id="leadSort-source" class="sort-mark"></span></th>
                <th class="sortable" onclick="toggleSort('lead','status')" style="width:90px">状態<span id="leadSort-status" class="sort-mark"></span></th>
                <th class="sortable" onclick="toggleSort('lead','priority')" style="width:70px">優先度<span id="leadSort-priority" class="sort-mark"></span></th>
                <th class="sortable" onclick="toggleSort('lead','score')" style="width:70px">点数<span id="leadSort-score" class="sort-mark"></span></th>
                <th class="sortable" onclick="toggleSort('lead','contact')" style="width:130px">連絡/手段<span id="leadSort-contact" class="sort-mark"></span></th>
                <th class="sortable" onclick="toggleSort('lead','mail')" style="width:110px">最新メール<span id="leadSort-mail" class="sort-mark"></span></th>
                <th class="sortable" onclick="toggleSort('lead','attentionReason')" style="width:180px">今対応する理由<span id="leadSort-attentionReason" class="sort-mark"></span></th>
              </tr>
            </thead>
            <tbody id="leadRows"></tbody>
          </table>
        </div>
      </section>

      <section class="lead-detail-panel" data-ui="lead-detail-panel">
        <div class="section-head">
          <h2>選択案件の詳細</h2>
          <div class="toolbar">
            <button onclick="openProject()" id="openProjectButton" disabled>URLを開く</button>
          </div>
        </div>
        <div class="detail-next-action" id="detailNextAction">
          <strong>案件を選択してください</strong>
          <span class="muted">次の操作がここに表示されます</span>
        </div>
        <div class="body lead-detail-stack">
          <div id="leadDetail">
            <div class="muted">営業案件から案件を選択してください</div>
          </div>
          <div id="leadAnalysis">
            <div class="muted">案件を選択すると分析結果が表示されます</div>
          </div>
        </div>
      </section>
    </div>

    <section class="filters-panel collapsible-panel">
      <details>
        <summary>
          <span>検索・絞り込み</span>
          <span class="muted">必要な時だけ開く</span>
        </summary>
        <div class="body">
          <div class="filters">
            <input id="keyword" placeholder="会社・案件・URL・メモで検索" oninput="render()" />
            <select id="sourceFilter" onchange="render()">
              <option value="">取得元 すべて</option>
            </select>
            <select id="statusFilter" onchange="render()">
              <option value="">状態 すべて</option>
              <option value="discovered">発見</option>
              <option value="qualified">候補</option>
              <option value="drafted">下書き済み</option>
              <option value="reviewing">確認中</option>
              <option value="approved">承認済み</option>
              <option value="queued">送信待ち</option>
              <option value="contacted">連絡済み</option>
              <option value="replied">返信あり</option>
              <option value="meeting_candidate">商談候補</option>
              <option value="rejected">対象外</option>
            </select>
            <select id="priorityFilter" onchange="render()">
              <option value="">優先度 すべて</option>
              <option value="high">高</option>
              <option value="medium">中</option>
              <option value="low">低</option>
            </select>
            <select id="contactFilter" onchange="render()">
              <option value="">連絡先 すべて</option>
              <option value="has">連絡先あり</option>
              <option value="none">連絡先なし</option>
            </select>
            <select id="mailFilter" onchange="render()">
              <option value="">メール すべて</option>
              <option value="none">未生成</option>
              <option value="draft">下書き</option>
              <option value="in_review">確認待ち</option>
                <option value="approved">承認済み</option>
                <option value="queued">送信待ち</option>
                <option value="sent">送信済み</option>
                <option value="failed">送信失敗</option>
            </select>
          </div>
        </div>
      </details>
    </section>

  </main>
  <footer>Sales AI System</footer>
  <script>
    const SELECTED_LEAD_STORAGE_KEY = 'salesAiSystem.selectedLeadId';
    const state = { leads: [], mails: [], aiGenerations: [], selectedLeadId: null, summaryFilter: 'all', sort: { table: 'lead', key: '', direction: 'asc' } };

    async function api(path, options = {}) {
      const operatorEmail = window.localStorage.getItem('salesAiSystem.operatorEmail') || '';
      const response = await fetch(path, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...(operatorEmail ? { 'X-Operator-Email': operatorEmail } : {}), ...(options.headers || {}) }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || payload.error?.message || 'APIエラー');
      return payload.data;
    }

    async function loadAll() {
      setPageStatus('読み込み中', 'loading');
      try {
        const [leads, mails] = await Promise.all([
          api('/api/leads?limit=200'),
          api('/api/mails?limit=200')
        ]);
        state.leads = leads.items || [];
        state.mails = mails.items || [];
        renderNavigationBadges();
        restoreSelectedLead();
        applyUrlFilters();
        populateSourceFilterOptions('sourceFilter');
        render();
        setPageStatus(state.leads.length ? '読み込み完了' : '営業案件は0件です', state.leads.length ? 'ok' : 'empty');
      } catch (error) {
        setPageStatus('読み込みに失敗しました: ' + error.message + '。更新を押して再試行してください。', 'error');
      }
    }

    function setPageStatus(message, stateType) {
      const element = document.getElementById('pageStatus');
      element.textContent = message;
      element.className = stateType === 'ok' ? 'status ok' : 'status ui-state-' + stateType;
    }

    function renderNavigationBadges() {
      setNavigationBadge('today', countTodayItems());
      setNavigationBadge('leads', state.leads.length);
      setNavigationBadge('mail', state.mails.filter((mail) => ['draft', 'in_review', 'approved', 'queued'].includes(mail.status)).length);
    }

    function setNavigationBadge(key, count) {
      const element = document.querySelector('[data-nav-badge="' + key + '"]');
      if (!element) return;
      const value = Number(count) || 0;
      element.textContent = value > 99 ? '99+' : String(value);
      element.hidden = value === 0;
      element.setAttribute('aria-label', value + '件');
    }

    function countTodayItems() {
      const today = tokyoDateKey(new Date());
      return state.leads.filter((lead) => {
        const dueKey = tokyoDateKey(lead.nextActionAt || lead.nextFollowUpAt);
        const mail = latestMail(lead.id);
        return (dueKey && dueKey <= today) || lead.status === 'replied' || ['failed', 'draft', 'approved', 'queued'].includes(mail?.status);
      }).length;
    }

    function applyUrlFilters() {
      const params = new URLSearchParams(location.search);
      const mailFilter = params.get('mailFilter');
      const statusFilter = params.get('statusFilter');
      if (mailFilter && ['none', 'draft', 'in_review', 'approved', 'queued', 'sent', 'failed'].includes(mailFilter)) {
        document.getElementById('mailFilter').value = mailFilter;
      }
      if (statusFilter && Array.from(document.getElementById('statusFilter').options).some((option) => option.value === statusFilter)) {
        document.getElementById('statusFilter').value = statusFilter;
      }
    }

    function render() {
      renderStats();
      renderRows();
      renderDetail();
      renderLeadAnalysis();
      updateExportPreview();
    }

    function renderStats() {
      const counts = {
        total: state.leads.length,
        noContact: state.leads.filter((lead) => !hasContact(lead)).length,
        draft: state.leads.filter((lead) => latestMail(lead.id)?.status === 'draft').length,
        review: state.leads.filter((lead) => latestMail(lead.id)?.status === 'in_review').length,
        queued: state.leads.filter((lead) => latestMail(lead.id)?.status === 'queued').length
      };
      document.getElementById('stats').innerHTML =
        statCard('all', '総案件', counts.total) +
        statCard('noContact', '連絡先なし', counts.noContact) +
        statCard('draft', '下書き', counts.draft) +
        statCard('review', '確認待ち', counts.review) +
        statCard('queued', '送信待ち', counts.queued);
      const labels = { all: '全件', noContact: '連絡先なし', draft: '下書き', review: '確認待ち', queued: '送信待ち' };
      document.getElementById('summaryFilterStatus').textContent = '選択中: ' + (labels[state.summaryFilter] || '全件');
      document.getElementById('clearSummaryFilterButton').disabled = state.summaryFilter === 'all';
    }

    function statCard(filter, label, value) {
      const active = state.summaryFilter === filter;
      return '<button class="stat" type="button" data-summary-filter="' + escapeAttr(filter) + '" data-active="' + active + '" aria-pressed="' + active + '" onclick="setSummaryFilter(\\'' + escapeAttr(filter) + '\\')"><strong>' + escapeHtml(value) + '</strong><span class="muted">' + escapeHtml(label) + '</span></button>';
    }

    function setSummaryFilter(filter) {
      state.summaryFilter = filter;
      ['keyword', 'sourceFilter', 'statusFilter', 'priorityFilter', 'contactFilter', 'mailFilter'].forEach((id) => {
        const element = document.getElementById(id);
        if (element) element.value = '';
      });
      render();
    }

    function renderRows() {
      const listScroll = document.querySelector('[data-ui="lead-list-workspace"] .lead-list-scroll');
      const listScrollTop = listScroll ? listScroll.scrollTop : 0;
      const visibleLeads = filteredLeads();
      const rows = visibleLeads.map((lead) => {
        const mail = latestMail(lead.id);
        const project = lead.project || {};
        const contact = contactSummary(lead);
        const sendMethod = lead.sendMethod || suggestSendMethod(lead);
        return '<tr data-selected="' + (lead.id === state.selectedLeadId) + '" onclick="selectLead(\\'' + lead.id + '\\')">' +
          '<td><div class="clip">' + escapeHtml(lead.company?.name || lead.companyId) + '</div></td>' +
          '<td><div class="clip">' + escapeHtml(project.title || '案件名なし') + '</div><div class="muted clip">' + escapeHtml(project.url || '') + '</div></td>' +
          '<td><span class="badge">' + escapeHtml(projectPlatformLabel(project)) + '</span></td>' +
          '<td><span class="badge">' + escapeHtml(labelLeadStatus(lead.status)) + '</span></td>' +
          '<td>' + escapeHtml(labelPriority(lead.priority)) + '</td>' +
          '<td>' + escapeHtml(Number(lead.score || 0)) + '</td>' +
          '<td><span class="badge ' + (contact === '未確認' ? 'danger' : 'ok') + '">' + escapeHtml(contact) + '</span><div class="muted clip">' + escapeHtml(sendMethod || '手段未定') + '</div></td>' +
          '<td>' + (mail ? '<span class="badge ' + mailBadgeClass(mail.status) + '">' + escapeHtml(labelMailStatus(mail.status)) + '</span>' : '<span class="badge warn">未生成</span>') + '</td>' +
          '<td data-ui="lead-attention-reason"><div class="attention-reason">' + escapeHtml(attentionReason(lead, mail)) + '</div><div class="muted">' + escapeHtml(nextActionDateLabel(lead)) + '</div></td>' +
        '</tr>';
      }).join('');
      document.getElementById('leadRows').innerHTML = rows || '<tr><td colspan="9" class="ui-state-empty">条件に合う営業案件がありません</td></tr>';
      if (listScroll) listScroll.scrollTop = listScrollTop;
      document.getElementById('listCount').textContent = visibleLeads.length + '件';
      renderSortMarks('lead', ['company', 'project', 'source', 'status', 'priority', 'score', 'contact', 'mail', 'attentionReason']);
    }

    function renderDetail() {
      const lead = state.leads.find((item) => item.id === state.selectedLeadId);
      const container = document.getElementById('leadDetail');
      const openButton = document.getElementById('openProjectButton');
      const nextAction = document.getElementById('detailNextAction');
      if (!lead) {
        container.innerHTML = '<div class="muted">営業案件から案件を選択してください</div>';
        document.getElementById('leadAnalysis').innerHTML = '<div class="muted">案件を選択すると分析結果が表示されます</div>';
        openButton.disabled = true;
        if (nextAction) nextAction.innerHTML = '<strong>案件を選択してください</strong><span class="muted">次の操作がここに表示されます</span>';
        return;
      }
      const project = lead.project || {};
      const mail = latestMail(lead.id);
      openButton.disabled = !project.url;
      if (nextAction) {
        nextAction.innerHTML =
          '<div><span class="muted">今対応する理由</span><br><strong>' + escapeHtml(attentionReason(lead, mail)) + '</strong></div>' +
          '<div><span class="muted">次の操作</span><br><strong>' + escapeHtml(nextActionLabel(lead, mail)) + '</strong></div>';
      }
      container.innerHTML =
        '<div class="detail-grid">' +
          detailItem('企業名', lead.company?.name || lead.companyId) +
          detailItem('取得元', projectPlatformLabel(project)) +
          detailItem('状態', labelLeadStatus(lead.status)) +
          detailItem('優先度', labelPriority(lead.priority)) +
          detailItem('点数', Number(lead.score || 0)) +
          detailItem('支援額', formatCurrency(project.amount)) +
          detailItem('支援者数', formatNumber(project.supporterCount) + '人') +
          detailItem('残り日数', project.daysLeft === null || project.daysLeft === undefined ? '未取得' : project.daysLeft + '日') +
          detailItem('地域', project.location || lead.company?.location || '未取得') +
          detailItem('実行者PJ数', lead.company?.sourceProjectCount === null || lead.company?.sourceProjectCount === undefined ? '未取得' : lead.company.sourceProjectCount + '件') +
          detailItem('連絡先', contactSummary(lead)) +
          detailItem('最新メール', mail ? labelMailStatus(mail.status) : '未生成') +
          detailItem('送信手段', lead.sendMethod || suggestSendMethod(lead)) +
          detailItem('次対応日', nextActionDateLabel(lead)) +
        '</div>' +
        rowBlock('案件名', project.title || '未取得') +
        rowBlock('URL', project.url ? renderLink(project.url) : '未取得', true) +
        rowBlock('商品説明', project.description || '未取得') +
        rowBlock('営業理由', lead.reason || '未入力') +
        rowBlock('連絡先メモ', contactDetail(lead), true) +
        rowBlock('ブランド/SNS', snsDetail(lead), true) +
        rowBlock('次にやること', nextActionLabel(lead, mail)) +
        rowBlock('最新メール件名', mail?.subject || '未生成') +
        renderLeadEditPanel(lead);
    }

    async function loadLeadAnalysis() {
      if (!state.selectedLeadId) {
        state.aiGenerations = [];
        renderLeadAnalysis();
        return;
      }
      document.getElementById('leadAnalysis').innerHTML = '<div class="ui-state-loading">分析結果を読み込み中</div>';
      try {
        const result = await api('/api/ai/leads/' + state.selectedLeadId + '/generations');
        state.aiGenerations = result.items || [];
        renderDetail();
        renderLeadAnalysis();
      } catch (error) {
        document.getElementById('leadAnalysis').innerHTML = '<div class="ui-state-error">分析結果の読み込みに失敗しました: ' + escapeHtml(error.message) + '</div>';
      }
    }

    function renderLeadAnalysis() {
      const container = document.getElementById('leadAnalysis');
      if (!container) return;
      if (!state.selectedLeadId) {
        container.innerHTML = '<div class="muted">案件を選択すると分析結果が表示されます</div>';
        return;
      }
      const latest = state.aiGenerations.find((item) => item.type === 'project_summary') || state.aiGenerations[0];
      if (!latest) {
        container.innerHTML = '<section style="border-radius:4px"><div class="section-head"><h2>分析</h2></div><div class="body ui-state-empty">まだ分析結果がありません。URL取り込み時の自動分析、またはAI分析を実行してください。</div></section>';
        return;
      }
      const output = latest.outputJson || {};
      container.innerHTML =
        '<section style="border-radius:4px">' +
          '<div class="section-head"><h2>分析</h2><span class="status muted">' + escapeHtml(formatDate(latest.createdAt)) + '</span></div>' +
          '<div class="body">' +
            '<div class="detail-grid">' +
              detailItem('判断', output.readiness?.label || '未判定') +
              detailItem('点数', typeof output.readiness?.score === 'number' ? output.readiness.score + '点' : '未判定') +
              detailItem('種別', labelAiGenerationType(latest.type)) +
              detailItem('モデル', latest.model || '未取得') +
            '</div>' +
            rowBlock('分析まとめ', output.summary || '未生成') +
            renderPlaceholderAnalysis(output.mailPlaceholders) +
            listBlock('商品の魅力・強み', output.productStrengths) +
            listBlock('SNSでの見せ方', output.snsIdeas) +
            listBlock('次に確認すること', output.nextChecks) +
            renderAiEvidenceSection('使用した事実', output.factsUsed, 'facts') +
            renderAiEvidenceSection('AIの仮定', output.assumptions, 'assumptions') +
            renderAiEvidenceSection('注意点', output.riskFlags, 'risk') +
            '<div class="row"><label>生成履歴</label><div class="ai-history">' + renderAiHistory() + '</div></div>' +
          '</div>' +
        '</section>';
    }

    function renderAiEvidenceSection(label, values, type) {
      const isMissing = values === undefined || values === null;
      const items = Array.isArray(values) ? values.filter(Boolean) : [];
      let content;
      if (isMissing) {
        content = '<div class="muted">未取得</div>';
      } else if (items.length) {
        content = '<ul class="list-block">' + items.map((item) => '<li>' + escapeHtml(item) + '</li>').join('') + '</ul>';
      } else {
        content = '<div class="muted">' + (type === 'risk' ? 'リスク情報なし（安全判定ではありません）' : 'なし') + '</div>';
      }
      return '<section class="ai-evidence-section' + (type === 'risk' ? ' ai-evidence-risk' : '') + '"><h3 class="ai-evidence-heading">' + escapeHtml(label) + '</h3>' + content + '</section>';
    }

    function renderAiHistory() {
      return state.aiGenerations.map((item, index) => {
        const title = formatDate(item.createdAt) + ' / ' + labelAiGenerationType(item.type) + ' / ' + (item.model || '未取得');
        return '<button onclick="showAiGeneration(' + index + ')">' + escapeHtml(title) + '</button>';
      }).join('');
    }

    function showAiGeneration(index) {
      const item = state.aiGenerations[index];
      if (!item) return;
      state.aiGenerations = [item].concat(state.aiGenerations.filter((_, itemIndex) => itemIndex !== index));
      renderLeadAnalysis();
    }

    function filteredLeads() {
      const keyword = value('keyword').toLowerCase();
      const status = value('statusFilter');
      const priority = value('priorityFilter');
      const contact = value('contactFilter');
      const mailStatus = value('mailFilter');
      const sourceFilter = value('sourceFilter');
      const leads = state.leads.filter((lead) => {
        const mail = latestMail(lead.id);
        const project = lead.project || {};
        const sourceLabel = projectPlatformLabel(project);
        const haystack = [
          lead.company?.name,
          project.title,
          sourceLabel,
          project.url,
          project.description,
          lead.reason,
          lead.ownerMemo
        ].filter(Boolean).join(' ').toLowerCase();
        if (keyword && !haystack.includes(keyword)) return false;
        if (status && lead.status !== status) return false;
        if (priority && lead.priority !== priority) return false;
        if (contact === 'has' && !hasContact(lead)) return false;
        if (contact === 'none' && hasContact(lead)) return false;
        if (mailStatus === 'none' && mail) return false;
        if (mailStatus && mailStatus !== 'none' && mail?.status !== mailStatus) return false;
        if (sourceFilter && sourceLabel !== sourceFilter) return false;
        if (state.summaryFilter === 'noContact' && hasContact(lead)) return false;
        if (state.summaryFilter === 'draft' && mail?.status !== 'draft') return false;
        if (state.summaryFilter === 'review' && mail?.status !== 'in_review') return false;
        if (state.summaryFilter === 'queued' && mail?.status !== 'queued') return false;
        return true;
      });
      return sortItems(leads, state.sort, leadSortValue);
    }

    function updateExportPreview() {
      const preview = document.getElementById('exportPreview');
      if (!preview) return;
      const scope = value('exportScope') || 'visible';
      const format = value('exportFormat') || 'csv';
      const columns = value('exportColumns') || 'summary';
      const count = exportLeadRows(scope).length;
      const scopeLabel = scope === 'all' ? '全件' : '表示中';
      const columnLabel = columns === 'detail' ? '詳細用' : '一覧用';
      preview.textContent = scopeLabel + ' ' + count + '件を' + format.toUpperCase() + '・' + columnLabel + 'で出力します';
    }

    function exportLeads() {
      const scope = value('exportScope') || 'visible';
      const format = value('exportFormat') || 'csv';
      const columns = value('exportColumns') || 'summary';
      const leads = exportLeadRows(scope);
      if (!leads.length) {
        setInlineStatus('exportStatus', '出力する営業案件がありません', 'warn');
        return;
      }
      const delimiter = format === 'tsv' ? '\\t' : ',';
      const rows = buildLeadExportRows(leads, columns);
      const text = rows.map((row) => row.map((cell) => formatExportCell(cell, delimiter)).join(delimiter)).join('\\n');
      const bom = format === 'csv' ? '\\ufeff' : '';
      const blob = new Blob([bom + text], { type: format === 'tsv' ? 'text/tab-separated-values;charset=utf-8' : 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      link.href = url;
      link.download = 'sales-leads-' + timestamp + '.' + format;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setInlineStatus('exportStatus', '出力しました: ' + leads.length + '件', 'ok');
    }

    function exportLeadRows(scope) {
      return scope === 'all' ? sortItems([...state.leads], state.sort, leadSortValue) : filteredLeads();
    }

    function buildLeadExportRows(leads, columnSet) {
      const columns = leadExportColumns(columnSet);
      return [
        columns.map((column) => column.label),
        ...leads.map((lead) => columns.map((column) => column.value(lead)))
      ];
    }

    function leadExportColumns(columnSet) {
      const summary = [
        ['会社名', (lead) => lead.company?.name || lead.companyId || ''],
        ['案件名', (lead) => lead.project?.title || ''],
        ['取得元', (lead) => projectPlatformLabel(lead.project || {})],
        ['URL', (lead) => lead.project?.url || ''],
        ['状態', (lead) => labelLeadStatus(lead.status)],
        ['優先度', (lead) => labelPriority(lead.priority)],
        ['点数', (lead) => Number(lead.score || 0)],
        ['連絡先', (lead) => contactSummary(lead)],
        ['送信手段', (lead) => lead.sendMethod || suggestSendMethod(lead)],
        ['最新メール', (lead) => latestMail(lead.id) ? labelMailStatus(latestMail(lead.id).status) : '未生成'],
        ['次にやること', (lead) => nextActionLabel(lead, latestMail(lead.id))],
        ['次対応日', (lead) => nextActionDateLabel(lead)]
      ];
      const detail = [
        ...summary,
        ['支援額', (lead) => lead.project?.amount || 0],
        ['支援者数', (lead) => lead.project?.supporterCount || 0],
        ['残り日数', (lead) => lead.project?.daysLeft ?? ''],
        ['カテゴリ', (lead) => lead.project?.category || ''],
        ['地域', (lead) => lead.project?.location || lead.company?.location || ''],
        ['実行者プロジェクト数', (lead) => lead.company?.sourceProjectCount ?? ''],
        ['実行者累計金額', (lead) => lead.company?.sourceTotalAmount ?? ''],
        ['実行者累計サポーター数', (lead) => lead.company?.sourceSupporterCount ?? ''],
        ['商品説明', (lead) => lead.project?.description || ''],
        ['営業理由', (lead) => lead.reason || ''],
        ['メールアドレス', (lead) => lead.contactEmail || ''],
        ['フォームURL', (lead) => lead.contactFormUrl || ''],
        ['サイト内メッセージURL', (lead) => lead.siteMessageUrl || ''],
        ['公式サイト', (lead) => lead.brandWebsiteUrl || ''],
        ['Instagram', (lead) => lead.instagramUrl || ''],
        ['TikTok', (lead) => lead.tiktokUrl || ''],
        ['X', (lead) => lead.xUrl || ''],
        ['連絡先メモ', (lead) => lead.contactMemo || ''],
        ['営業メモ', (lead) => lead.ownerMemo || ''],
        ['ブランド分析メモ', (lead) => lead.brandAnalysisMemo || ''],
        ['SNS分析メモ', (lead) => lead.snsAnalysisMemo || '']
      ];
      return (columnSet === 'detail' ? detail : summary).map(([label, value]) => ({ label, value }));
    }

    function formatExportCell(value, delimiter) {
      const text = String(value ?? '').replace(/\\r\\n/g, '\\n').replace(/\\r/g, '\\n');
      if (delimiter === '\\t') return text.replace(/\\t/g, ' ').replace(/\\n/g, ' ');
      return '"' + text.replace(/"/g, '""') + '"';
    }

    function toggleSort(table, key) {
      if (state.sort.table === table && state.sort.key === key) {
        state.sort.direction = state.sort.direction === 'asc' ? 'desc' : 'asc';
      } else {
        state.sort = { table, key, direction: defaultSortDirection(key) };
      }
      render();
    }

    function renderSortMarks(table, keys) {
      keys.forEach((key) => {
        const element = document.getElementById(table + 'Sort-' + key);
        if (!element) return;
        element.textContent = state.sort.table === table && state.sort.key === key
          ? (state.sort.direction === 'asc' ? '▲' : '▼')
          : '';
      });
    }

    function sortItems(items, sort, valueGetter) {
      if (!sort?.key) return items;
      const direction = sort.direction === 'desc' ? -1 : 1;
      return [...items].sort((left, right) => compareValues(valueGetter(left, sort.key), valueGetter(right, sort.key)) * direction);
    }

    function compareValues(left, right) {
      const leftEmpty = left === null || left === undefined || left === '';
      const rightEmpty = right === null || right === undefined || right === '';
      if (leftEmpty && rightEmpty) return 0;
      if (leftEmpty) return 1;
      if (rightEmpty) return -1;
      if (typeof left === 'number' && typeof right === 'number') return left - right;
      return String(left).localeCompare(String(right), 'ja', { numeric: true, sensitivity: 'base' });
    }

    function defaultSortDirection(key) {
      return ['score', 'createdAt', 'amount', 'supporterCount', 'daysLeft', 'profileProjectCount'].includes(key) ? 'desc' : 'asc';
    }

    function leadSortValue(lead, key) {
      const mail = latestMail(lead.id);
      const project = lead.project || {};
      const values = {
        company: lead.company?.name || lead.companyId || '',
        project: project.title || '',
        source: projectPlatformLabel(project),
        status: labelLeadStatus(lead.status),
        priority: priorityRank(lead.priority),
        score: Number(lead.score || 0),
        contact: contactSummary(lead),
        mail: mail ? labelMailStatus(mail.status) : '未生成',
        attentionReason: attentionReason(lead, mail)
      };
      return values[key] ?? '';
    }

    function priorityRank(priority) {
      return ({ high: 3, medium: 2, low: 1 })[priority] || 0;
    }

    function populateSourceFilterOptions(selectId) {
      const select = document.getElementById(selectId);
      if (!select) return;
      const current = select.value;
      const labels = Array.from(new Set(state.leads.map((lead) => projectPlatformLabel(lead.project || {})).filter(Boolean))).sort();
      select.innerHTML = '<option value="">取得元 すべて</option>' +
        labels.map((label) => '<option value="' + escapeAttr(label) + '">' + escapeHtml(label) + '</option>').join('');
      if (labels.includes(current)) select.value = current;
    }

    function latestMail(leadId) {
      const lead = state.leads.find((item) => item.id === leadId);
      return state.mails
        .filter((mail) => {
          if (mail.leadId === leadId || mail.lead?.id === leadId) return true;
          if (lead && mail.companyId === lead.companyId) return true;
          if (lead && mail.company?.id === lead.companyId) return true;
          return false;
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
    }

    function selectLead(id) {
      state.selectedLeadId = id;
      persistSelectedLead(id);
      state.aiGenerations = [];
      renderRows();
      renderDetail();
      renderLeadAnalysis();
      void loadLeadAnalysis();
    }

    function persistSelectedLead(id) {
      if (!id) return;
      localStorage.setItem(SELECTED_LEAD_STORAGE_KEY, id);
    }

    function restoreSelectedLead() {
      const savedId = localStorage.getItem(SELECTED_LEAD_STORAGE_KEY);
      if (savedId && state.leads.some((lead) => lead.id === savedId)) {
        state.selectedLeadId = savedId;
      }
    }

    function openProject() {
      const lead = state.leads.find((item) => item.id === state.selectedLeadId);
      const url = lead?.project?.url;
      if (url) window.open(url, '_blank', 'noopener');
    }

    function nextActionLabel(lead, mail) {
      if (!hasContact(lead)) return '連絡先確認';
      if (!mail) return 'AI分析後にメール生成';
      if (mail.status === 'draft') return '本文確認';
      if (mail.status === 'in_review') return '上長確認';
      if (mail.status === 'rejected') return '修正して再依頼';
      if (mail.status === 'approved') return 'キュー投入';
      if (mail.status === 'queued') return '送信待ち';
      if (mail.status === 'sent') return '返信確認';
      return '確認';
    }

    function attentionReason(lead, mail, now = new Date()) {
      const nextActionReason = dueDateReason(lead.nextActionAt, '次対応', now);
      if (nextActionReason) return nextActionReason;
      const followUpReason = dueDateReason(lead.nextFollowUpAt, '次回確認', now);
      if (followUpReason) return followUpReason;
      if (mail?.status === 'failed') return '送信失敗を確認';
      if (mail?.status === 'rejected') return '本文を修正して再レビュー';
      if (mail?.status === 'in_review') return 'レビュー結果を確認';
      if (mail?.status === 'approved') return '送信待ちにする';
      if (mail?.status === 'draft') return '下書きを確認';
      if (!hasContact(lead)) return '連絡先を確認';
      const rawDaysLeft = lead.project?.daysLeft;
      const daysLeft = Number(rawDaysLeft);
      if (rawDaysLeft !== null && rawDaysLeft !== undefined && rawDaysLeft !== '' && Number.isFinite(daysLeft) && daysLeft >= 0 && daysLeft <= 7) {
        return '終了まで' + daysLeft + '日';
      }
      if (lead.reason) return shortDisplayText(lead.reason, 36);
      return '次の対応を設定';
    }

    function dueDateReason(value, label, now) {
      const dueDate = tokyoDateKey(value);
      const today = tokyoDateKey(now);
      if (!dueDate || !today || dueDate > today) return '';
      return dueDate < today ? label + '期限超過' : label + 'は今日';
    }

    function tokyoDateKey(value) {
      if (!value) return '';
      const date = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(date.getTime())) return '';
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).formatToParts(date);
      const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
      return values.year + '-' + values.month + '-' + values.day;
    }

    function shortDisplayText(value, maxLength) {
      const text = String(value || '').trim();
      return text.length > maxLength ? text.slice(0, maxLength - 1) + '…' : text;
    }

    function hasContact(lead) {
      return Boolean(lead.contactEmail || lead.contactFormUrl || lead.siteMessageUrl);
    }

    function contactSummary(lead) {
      if (lead.contactEmail) return 'メール';
      if (lead.contactFormUrl) return 'フォーム';
      if (lead.siteMessageUrl) return 'サイト内';
      return '未確認';
    }

    function suggestSendMethod(lead) {
      if (lead.contactEmail) return 'メール';
      if (lead.contactFormUrl) return '問い合わせフォーム';
      if (lead.siteMessageUrl) return 'サイト内メッセージ';
      return '';
    }

    function nextActionDateLabel(lead) {
      const value = lead.nextFollowUpAt || lead.nextActionAt;
      return value ? formatDate(value) : '日付未定';
    }

    function contactDetail(lead) {
      return [
        lead.contactEmail ? 'メール: ' + escapeHtml(lead.contactEmail) : '',
        lead.contactFormUrl ? 'フォーム: ' + renderLink(lead.contactFormUrl) : '',
        lead.siteMessageUrl ? 'サイト内: ' + renderLink(lead.siteMessageUrl) : '',
        lead.contactMemo ? 'メモ: ' + escapeHtml(lead.contactMemo) : ''
      ].filter(Boolean).join('<br>') || '未確認';
    }

    function snsDetail(lead) {
      return [
        lead.brandWebsiteUrl ? '公式: ' + renderLink(lead.brandWebsiteUrl) : '',
        lead.instagramUrl ? 'Instagram: ' + renderLink(lead.instagramUrl) : '',
        lead.tiktokUrl ? 'TikTok: ' + renderLink(lead.tiktokUrl) : '',
        lead.xUrl ? 'X: ' + renderLink(lead.xUrl) : ''
      ].filter(Boolean).join('<br>') || '未取得';
    }

    function latestProjectAnalysisOutput() {
      const latest = state.aiGenerations.find((item) => item.type === 'project_summary');
      return latest?.outputJson || {};
    }

    function suggestedLeadMemos(lead) {
      const output = latestProjectAnalysisOutput();
      if (!Object.keys(output).length) {
        return { ownerMemo: '', brandAnalysisMemo: '', snsAnalysisMemo: '' };
      }
      const placeholders = output.mailPlaceholders || {};
      const projectSource = leadProjectSource(lead);
      const productStrengths = compatibleMemoItems(output.productStrengths, projectSource);
      const appeal = isMemoTextCompatible(placeholders.appeal, projectSource) ? placeholders.appeal : '';
      const targetUser = isMemoTextCompatible(placeholders.targetUser, projectSource) ? placeholders.targetUser : '';
      return {
        ownerMemo: [
          output.summary,
          output.readiness?.label ? '判断: ' + output.readiness.label + (typeof output.readiness.score === 'number' ? ' / ' + output.readiness.score + '点' : '') : '',
          memoList('次に確認', output.nextChecks)
        ].filter(Boolean).join('\\n\\n'),
        brandAnalysisMemo: [
          memoList('商品の魅力・強み', productStrengths),
          appeal ? 'メールで触れる魅力: ' + appeal : '',
          targetUser ? '想定する相手: ' + targetUser : '',
          memoList('不足情報', output.missingInfo)
        ].filter(Boolean).join('\\n\\n'),
        snsAnalysisMemo: [
          memoList('SNSでの見せ方', output.snsIdeas),
          memoList('メールでの切り口', output.mailAdvice)
        ].filter(Boolean).join('\\n\\n')
      };
    }

    function memoList(label, values) {
      const items = Array.isArray(values) ? values.filter(Boolean) : [];
      return items.length ? label + '\\n' + items.map((item) => '・' + item).join('\\n') : '';
    }

    function leadProjectSource(lead) {
      const project = lead?.project || {};
      return [project.title, project.description, project.category].filter(Boolean).join(' ');
    }

    function compatibleMemoItems(items, projectSource) {
      return Array.isArray(items) ? items.filter((item) => isMemoTextCompatible(item, projectSource)) : [];
    }

    function isMemoTextCompatible(text, projectSource) {
      if (!text || !projectSource) return true;
      const rules = [
        { pattern: /米びつ|米櫃|お米|キッチン|真空保存|鮮度|保存容器|収納/, required: /米びつ|米櫃|お米|キッチン|真空保存|鮮度|保存容器|収納/ },
        { pattern: /醤油差し|醤油|サイフォン|有田焼|陶磁器|器|食卓|残量|ガラス管|NEO CLAY/i, required: /醤油差し|醤油|サイフォン|有田焼|陶磁器|器|食卓|残量|ガラス管|NEO CLAY/i },
        { pattern: /エアベッド|寝心地|車中泊|キャンプ|アウトドア|来客|寝具/, required: /エアベッド|ベッド|寝心地|車中泊|キャンプ|アウトドア|来客|寝具/ },
        { pattern: /ライブ|コンサート|ファン|音楽|バンド|周年|公演/, required: /ライブ|コンサート|ファン|音楽|バンド|周年|公演/ },
        { pattern: /焼き鳥|焼鳥|炭火|店舗|飲食|居酒屋|リフォーム|改装/, required: /焼き鳥|焼鳥|炭火|店舗|飲食|居酒屋|リフォーム|改装/ }
      ];
      return rules.every((rule) => !rule.pattern.test(text) || rule.required.test(projectSource));
    }

    function renderLeadEditPanel(lead) {
      const memo = suggestedLeadMemos(lead);
      const project = lead.project || {};
      return '<div class="row">' +
        '<label>選択案件の詳細</label>' +
        '<div class="form-grid">' +
          inputField('leadCompanyNameEdit', '企業名', lead.company?.name || '') +
          selectField('leadProjectSourceEdit', '取得元', projectPlatformType(project), [
            ['campfire', 'CAMPFIRE'],
            ['makuake', 'Makuake'],
            ['green_funding', 'GREEN FUNDING'],
            ['other', 'その他']
          ]) +
          inputField('leadProjectTitleEdit', '案件名', project.title) +
          inputField('leadProjectUrlEdit', 'プロジェクトURL', project.url) +
          inputField('leadProjectCategoryEdit', 'カテゴリ', project.category) +
          selectField('leadProjectStatusEdit', '公開状態', project.status || 'unknown', [
            ['unknown', '未確認'],
            ['discovered', '発見'],
            ['active', '公開中'],
            ['ended', '終了'],
            ['suspended', '停止']
          ]) +
          inputField('leadProjectAmountEdit', '支援額', project.amount || 0, '', 'number') +
          inputField('leadProjectSupporterCountEdit', '支援者数', project.supporterCount || 0, '', 'number') +
          inputField('leadProjectTargetAmountEdit', '目標金額', project.targetAmount || '', '', 'number') +
          inputField('leadProjectEndDateEdit', '終了日時', toDateTimeLocal(project.endDate), '', 'datetime-local') +
        '</div>' +
        '<div class="row">' +
          '<label for="leadProjectDescriptionEdit">プロジェクト説明</label>' +
          '<textarea id="leadProjectDescriptionEdit">' + escapeHtml(project.description || '') + '</textarea>' +
        '</div>' +
      '</div>' +
      '<div class="row">' +
        '<label>営業管理</label>' +
        '<div class="form-grid">' +
          selectField('leadStatusEdit', '状態', lead.status, [
            ['discovered', '発見'],
            ['qualified', '候補'],
            ['drafted', '下書き済み'],
            ['reviewing', '確認中'],
            ['approved', '承認済み'],
            ['queued', '送信待ち'],
            ['contacted', '連絡済み'],
            ['replied', '返信あり'],
            ['meeting_candidate', '商談候補'],
            ['rejected', '対象外'],
            ['no_response', '返信なし'],
            ['archived', 'アーカイブ']
          ]) +
          selectField('leadPriorityEdit', '優先度', lead.priority, [
            ['high', '高'],
            ['medium', '中'],
            ['low', '低']
          ]) +
          selectField('leadSendMethodEdit', '送信手段', lead.sendMethod || suggestSendMethod(lead), [
            ['', '未定'],
            ['メール', 'メール'],
            ['問い合わせフォーム', '問い合わせフォーム'],
            ['サイト内メッセージ', 'サイト内メッセージ'],
            ['その他', 'その他']
          ]) +
          inputField('leadNextActionAtEdit', '次対応日時', toDateTimeLocal(lead.nextFollowUpAt || lead.nextActionAt), '', 'datetime-local') +
          inputField('leadContactEmailEdit', 'メールアドレス', lead.contactEmail) +
          inputField('leadContactFormUrlEdit', 'フォームURL', lead.contactFormUrl) +
          inputField('leadSiteMessageUrlEdit', 'サイト内メッセージURL', lead.siteMessageUrl) +
          inputField('leadBrandWebsiteUrlEdit', '公式サイト', lead.brandWebsiteUrl) +
          inputField('leadInstagramUrlEdit', 'Instagram', lead.instagramUrl) +
          inputField('leadTiktokUrlEdit', 'TikTok', lead.tiktokUrl) +
          inputField('leadXUrlEdit', 'X', lead.xUrl) +
        '</div>' +
        '<div class="row">' +
          '<label for="leadContactMemoEdit">連絡先・送信メモ</label>' +
          '<textarea id="leadContactMemoEdit">' + escapeHtml(lead.contactMemo || '') + '</textarea>' +
        '</div>' +
        '<div class="row">' +
          '<label for="leadOwnerMemoEdit">営業メモ</label>' +
          '<textarea id="leadOwnerMemoEdit">' + escapeHtml(lead.ownerMemo || memo.ownerMemo || '') + '</textarea>' +
        '</div>' +
        '<div class="row">' +
          '<label for="leadBrandAnalysisMemoEdit">ブランド分析メモ</label>' +
          '<textarea id="leadBrandAnalysisMemoEdit">' + escapeHtml(lead.brandAnalysisMemo || memo.brandAnalysisMemo || '') + '</textarea>' +
        '</div>' +
        '<div class="row">' +
          '<label for="leadSnsAnalysisMemoEdit">SNS分析メモ</label>' +
          '<textarea id="leadSnsAnalysisMemoEdit">' + escapeHtml(lead.snsAnalysisMemo || memo.snsAnalysisMemo || '') + '</textarea>' +
        '</div>' +
        '<div class="toolbar">' +
          '<button class="primary" onclick="saveLeadEdit()">営業情報を保存</button>' +
          '<span id="leadEditStatus" class="status"></span>' +
        '</div>' +
      '</div>';
    }

    async function saveLeadEdit() {
      if (!state.selectedLeadId) return;
      setInlineStatus('leadEditStatus', '保存中', 'warn');
      try {
        await api('/api/leads/' + state.selectedLeadId, {
          method: 'PATCH',
          body: JSON.stringify(compactPayload({
            companyName: value('leadCompanyNameEdit'),
            projectSource: value('leadProjectSourceEdit'),
            projectTitle: value('leadProjectTitleEdit'),
            projectUrl: value('leadProjectUrlEdit'),
            projectStatus: value('leadProjectStatusEdit'),
            projectAmount: numberValue('leadProjectAmountEdit'),
            projectSupporterCount: numberValue('leadProjectSupporterCountEdit'),
            projectTargetAmount: optionalNumberValue('leadProjectTargetAmountEdit'),
            projectEndDate: dateTimeValue('leadProjectEndDateEdit'),
            projectCategory: value('leadProjectCategoryEdit'),
            projectDescription: value('leadProjectDescriptionEdit'),
            status: value('leadStatusEdit'),
            priority: value('leadPriorityEdit'),
            sendMethod: value('leadSendMethodEdit'),
            nextActionAt: dateTimeValue('leadNextActionAtEdit'),
            nextFollowUpAt: dateTimeValue('leadNextActionAtEdit'),
            contactEmail: value('leadContactEmailEdit'),
            contactFormUrl: value('leadContactFormUrlEdit'),
            siteMessageUrl: value('leadSiteMessageUrlEdit'),
            brandWebsiteUrl: value('leadBrandWebsiteUrlEdit'),
            instagramUrl: value('leadInstagramUrlEdit'),
            tiktokUrl: value('leadTiktokUrlEdit'),
            xUrl: value('leadXUrlEdit'),
            ownerMemo: value('leadOwnerMemoEdit'),
            contactMemo: value('leadContactMemoEdit'),
            brandAnalysisMemo: value('leadBrandAnalysisMemoEdit'),
            snsAnalysisMemo: value('leadSnsAnalysisMemoEdit')
          }))
        });
        setInlineStatus('leadEditStatus', '保存しました', 'ok');
        await loadAll();
      } catch (error) {
        setInlineStatus('leadEditStatus', error.message, 'error');
      }
    }

    function value(id) {
      return document.getElementById(id).value.trim();
    }

    function dateTimeValue(id) {
      const raw = value(id);
      return raw ? new Date(raw).toISOString() : '';
    }

    function numberValue(id) {
      const raw = value(id);
      const number = Number(raw || 0);
      return Number.isFinite(number) ? number : 0;
    }

    function optionalNumberValue(id) {
      const raw = value(id);
      if (!raw) return undefined;
      const number = Number(raw);
      return Number.isFinite(number) ? number : undefined;
    }

    function compactPayload(payload) {
      return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined && value !== null && value !== ''));
    }

    function setInlineStatus(id, message, type = '') {
      const element = document.getElementById(id);
      if (!element) return;
      element.textContent = message;
      element.className = 'status ' + type;
    }

    function detailItem(label, value) {
      return '<div class="detail-item"><div class="detail-label">' + escapeHtml(label) + '</div><div class="detail-value">' + escapeHtml(value || '未取得') + '</div></div>';
    }

    function rowBlock(label, value, html = false) {
      return '<div class="row"><label>' + escapeHtml(label) + '</label><div class="detail-text">' + (html ? value : escapeHtml(value || '未取得')) + '</div></div>';
    }

    function inputField(id, label, fieldValue, placeholder = '', type = 'text') {
      return '<div class="row"><label for="' + escapeHtml(id) + '">' + escapeHtml(label) + '</label><input id="' + escapeHtml(id) + '" type="' + escapeHtml(type) + '" value="' + escapeAttr(fieldValue || '') + '" placeholder="' + escapeAttr(placeholder) + '" /></div>';
    }

    function selectField(id, label, selectedValue, options) {
      return '<div class="row"><label for="' + escapeHtml(id) + '">' + escapeHtml(label) + '</label><select id="' + escapeHtml(id) + '">' +
        options.map(([value, text]) => '<option value="' + escapeAttr(value) + '" ' + (value === selectedValue ? 'selected' : '') + '>' + escapeHtml(text) + '</option>').join('') +
      '</select></div>';
    }

    function toDateTimeLocal(value) {
      if (!value) return '';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '';
      const offset = date.getTimezoneOffset();
      const local = new Date(date.getTime() - offset * 60 * 1000);
      return local.toISOString().slice(0, 16);
    }

    function listBlock(label, values) {
      const items = Array.isArray(values) ? values : [];
      return '<div class="row"><label>' + escapeHtml(label) + '</label><div class="detail-text">' +
        (items.length ? items.map((item) => '・' + escapeHtml(item)).join('<br>') : '未生成') +
      '</div></div>';
    }

    function renderPlaceholderAnalysis(placeholders) {
      if (!placeholders || typeof placeholders !== 'object') return '';
      const rows = [
        ['【企業名＋ご担当者】', placeholders.companyRecipient],
        ['【商品名】', placeholders.productName],
        ['【商品の魅力・特徴・強み】', placeholders.appeal],
        ['【使う人】', placeholders.targetUser],
        ['文脈', placeholders.subjectType],
        ['注意', placeholders.caution]
      ].filter(([, value]) => value);
      if (!rows.length) return '';
      return '<div class="row"><label>メール差し込み分析</label><div class="detail-text">' +
        rows.map(([label, value]) => escapeHtml(label) + ': ' + escapeHtml(value)).join('<br>') +
      '</div></div>';
    }

    function renderLink(url) {
      return '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener">' + escapeHtml(url) + '</a>';
    }

    function formatDate(value) {
      if (!value) return '';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '';
      return date.toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    }

    function formatCurrency(value) {
      const number = Number(value || 0);
      return number ? number.toLocaleString('ja-JP') + '円' : '未取得';
    }

    function formatNumber(value) {
      const number = Number(value || 0);
      return Number.isFinite(number) ? number.toLocaleString('ja-JP') : '0';
    }

    function projectPlatformLabel(project) {
      if (project?.platform?.name) return project.platform.name;
      const type = project?.platform?.type;
      if (type) {
        return ({
          campfire: 'CAMPFIRE',
          makuake: 'Makuake',
          green_funding: 'GREEN FUNDING',
          other: 'その他'
        })[type] || type;
      }
      const url = project?.url || '';
      if (url.includes('camp-fire.jp')) return 'CAMPFIRE';
      if (url.includes('makuake.com')) return 'Makuake';
      if (url.includes('greenfunding.jp')) return 'GREEN FUNDING';
      return '未取得';
    }

    function projectPlatformType(project) {
      if (project?.platform?.type) return project.platform.type;
      const url = project?.url || '';
      if (url.includes('camp-fire.jp')) return 'campfire';
      if (url.includes('makuake.com')) return 'makuake';
      if (url.includes('greenfunding.jp')) return 'green_funding';
      return 'other';
    }

    function labelLeadStatus(status) {
      return ({
        discovered: '発見',
        qualified: '候補',
        drafted: '下書き済み',
        reviewing: '確認中',
        approved: '承認済み',
        queued: '送信待ち',
        contacted: '連絡済み',
        replied: '返信あり',
        meeting_candidate: '商談候補',
        rejected: '対象外'
      })[status] || status || '未設定';
    }

    function labelPriority(priority) {
      return ({ high: '高', medium: '中', low: '低' })[priority] || priority || '未設定';
    }

    function labelMailStatus(status) {
      return ({
        draft: '下書き',
        in_review: '確認待ち',
        rejected: '棄却',
        approved: '承認済み',
        queued: '送信待ち',
        sending: '送信中',
        sent: '送信済み',
        failed: '送信失敗',
        cancelled: 'キャンセル'
      })[status] || status || '未設定';
    }

    function labelAiGenerationType(type) {
      return ({
        project_summary: 'AI分析',
        email_draft: 'メール生成',
        lead_scoring: 'スコア分析',
        subject_generation: '件名生成',
        reply_classification: '返信分類',
        next_action: '次アクション'
      })[type] || type || '未設定';
    }

    function mailBadgeClass(status) {
      if (['approved', 'queued', 'sent'].includes(status)) return 'ok';
      if (['rejected', 'failed', 'cancelled'].includes(status)) return 'danger';
      return 'warn';
    }

    function escapeHtml(value) {
      return String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      }[char]));
    }

    function escapeAttr(value) {
      return escapeHtml(value);
    }

    loadAll();
  </script>
</body>
</html>`;
}
