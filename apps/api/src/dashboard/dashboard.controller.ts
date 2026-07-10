import { Controller, Get, Header } from '@nestjs/common';

@Controller()
export class DashboardController {
  @Get('leads-view')
  @Header('Content-Type', 'text/html; charset=utf-8')
  leadsView() {
    return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>営業リスト詳細</title>
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
    .stat {
      border: 1px solid var(--line);
      border-radius: 4px;
      padding: 10px;
      background: #fbfcfd;
    }
    .stat strong { display: block; font-size: 22px; margin-bottom: 4px; }
    .muted { color: var(--muted); }
    .status { font-size: 13px; }
    .split {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 10px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    th, td {
      padding: 8px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      vertical-align: top;
    }
    th { font-size: 12px; color: var(--muted); background: #fbfcfd; position: sticky; top: 58px; z-index: 2; }
    tr { cursor: pointer; }
    tr:hover { background: #f8fbfa; }
    tr[data-selected="true"] { background: #eef8f5; }
    .clip { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
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
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }
    @media (max-width: 1100px) {
      .filters, .stats, .split, .detail-grid { grid-template-columns: 1fr; }
      th { position: static; }
    }
  </style>
</head>
<body>
  <header>
    <h1>営業リスト詳細</h1>
    <div class="toolbar">
      <span id="pageStatus" class="status muted">読み込み中</span>
      <div class="top-nav">
        <button onclick="location.href='/'">URL検索</button>
        <button class="primary" onclick="location.href='/leads-view'">営業リスト</button>
        <button onclick="location.href='/mail-workspace'">メール作成</button>
      </div>
      <button class="primary" onclick="loadAll()">更新</button>
    </div>
  </header>
  <main>
    <section class="summary-panel">
      <div class="section-head">
        <h2>状態サマリー</h2>
      </div>
      <div class="body">
        <div class="stats" id="stats"></div>
      </div>
    </section>

    <div class="split lead-list-main">
      <section>
        <div class="section-head">
          <h2>営業リスト</h2>
          <span id="listCount" class="status muted">0件</span>
        </div>
        <div class="body" style="padding:0">
          <table>
            <thead>
              <tr>
                <th style="width:18%">会社</th>
                <th>案件</th>
                <th style="width:90px">状態</th>
                <th style="width:70px">優先度</th>
                <th style="width:70px">点数</th>
                <th style="width:120px">連絡先</th>
                <th style="width:110px">最新メール</th>
                <th style="width:110px">次対応</th>
              </tr>
            </thead>
            <tbody id="leadRows"></tbody>
          </table>
        </div>
      </section>

      <section>
        <div class="section-head">
          <h2>選択案件の詳細</h2>
          <div class="toolbar">
            <button onclick="openProject()" id="openProjectButton" disabled>URLを開く</button>
          </div>
        </div>
        <div class="body" id="leadDetail">
          <div class="muted">営業リストから案件を選択してください</div>
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
            </select>
          </div>
        </div>
      </details>
    </section>

  </main>
  <script>
    const state = { leads: [], mails: [], selectedLeadId: null };

    async function api(path) {
      const response = await fetch(path);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || payload.error?.message || 'APIエラー');
      return payload.data;
    }

    async function loadAll() {
      document.getElementById('pageStatus').textContent = '読み込み中';
      try {
        const [leads, mails] = await Promise.all([
          api('/api/leads?limit=200'),
          api('/api/mails?limit=200')
        ]);
        state.leads = leads.items || [];
        state.mails = mails.items || [];
        render();
        document.getElementById('pageStatus').textContent = '読み込み完了';
      } catch (error) {
        document.getElementById('pageStatus').textContent = error.message;
      }
    }

    function render() {
      renderStats();
      renderRows();
      renderDetail();
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
        statCard('総リード', counts.total) +
        statCard('連絡先なし', counts.noContact) +
        statCard('下書き', counts.draft) +
        statCard('確認待ち', counts.review) +
        statCard('送信待ち', counts.queued);
    }

    function statCard(label, value) {
      return '<div class="stat"><strong>' + escapeHtml(value) + '</strong><span class="muted">' + escapeHtml(label) + '</span></div>';
    }

    function renderRows() {
      const rows = filteredLeads().map((lead) => {
        const mail = latestMail(lead.id);
        const project = lead.project || {};
        const contact = contactSummary(lead);
        return '<tr data-selected="' + (lead.id === state.selectedLeadId) + '" onclick="selectLead(\\'' + lead.id + '\\')">' +
          '<td><div class="clip">' + escapeHtml(lead.company?.name || lead.companyId) + '</div></td>' +
          '<td><div class="clip">' + escapeHtml(project.title || '案件名なし') + '</div><div class="muted clip">' + escapeHtml(project.url || '') + '</div></td>' +
          '<td><span class="badge">' + escapeHtml(labelLeadStatus(lead.status)) + '</span></td>' +
          '<td>' + escapeHtml(labelPriority(lead.priority)) + '</td>' +
          '<td>' + escapeHtml(Number(lead.score || 0)) + '</td>' +
          '<td><span class="badge ' + (contact === '未確認' ? 'danger' : 'ok') + '">' + escapeHtml(contact) + '</span></td>' +
          '<td>' + (mail ? '<span class="badge ' + mailBadgeClass(mail.status) + '">' + escapeHtml(labelMailStatus(mail.status)) + '</span>' : '<span class="badge warn">未生成</span>') + '</td>' +
          '<td>' + escapeHtml(nextActionLabel(lead, mail)) + '</td>' +
        '</tr>';
      }).join('');
      document.getElementById('leadRows').innerHTML = rows || '<tr><td colspan="8" class="muted">条件に合うリードがありません</td></tr>';
      document.getElementById('listCount').textContent = filteredLeads().length + '件';
    }

    function renderDetail() {
      const lead = state.leads.find((item) => item.id === state.selectedLeadId);
      const container = document.getElementById('leadDetail');
      const openButton = document.getElementById('openProjectButton');
      if (!lead) {
        container.innerHTML = '<div class="muted">営業リストから案件を選択してください</div>';
        openButton.disabled = true;
        return;
      }
      const project = lead.project || {};
      const mail = latestMail(lead.id);
      openButton.disabled = !project.url;
      container.innerHTML =
        '<div class="detail-grid">' +
          detailItem('企業名', lead.company?.name || lead.companyId) +
          detailItem('状態', labelLeadStatus(lead.status)) +
          detailItem('優先度', labelPriority(lead.priority)) +
          detailItem('点数', Number(lead.score || 0)) +
          detailItem('支援額', formatCurrency(project.amount)) +
          detailItem('支援者数', formatNumber(project.supporterCount) + '人') +
          detailItem('連絡先', contactSummary(lead)) +
          detailItem('最新メール', mail ? labelMailStatus(mail.status) : '未生成') +
        '</div>' +
        rowBlock('案件名', project.title || '未取得') +
        rowBlock('URL', project.url ? renderLink(project.url) : '未取得', true) +
        rowBlock('商品説明', project.description || '未取得') +
        rowBlock('営業理由', lead.reason || '未入力') +
        rowBlock('連絡先メモ', contactDetail(lead), true) +
        rowBlock('ブランド/SNS', snsDetail(lead), true) +
        rowBlock('次にやること', nextActionLabel(lead, mail)) +
        rowBlock('最新メール件名', mail?.subject || '未生成');
    }

    function filteredLeads() {
      const keyword = value('keyword').toLowerCase();
      const status = value('statusFilter');
      const priority = value('priorityFilter');
      const contact = value('contactFilter');
      const mailStatus = value('mailFilter');
      return state.leads.filter((lead) => {
        const mail = latestMail(lead.id);
        const project = lead.project || {};
        const haystack = [
          lead.company?.name,
          project.title,
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
        return true;
      });
    }

    function latestMail(leadId) {
      return state.mails
        .filter((mail) => mail.leadId === leadId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
    }

    function selectLead(id) {
      state.selectedLeadId = id;
      renderRows();
      renderDetail();
    }

    function openProject() {
      const lead = state.leads.find((item) => item.id === state.selectedLeadId);
      const url = lead?.project?.url;
      if (url) window.open(url, '_blank', 'noopener');
    }

    function nextActionLabel(lead, mail) {
      if (!hasContact(lead)) return '連絡先確認';
      if (!mail) return '無料分析後にメール生成';
      if (mail.status === 'draft') return '本文確認';
      if (mail.status === 'in_review') return '上長確認';
      if (mail.status === 'rejected') return '修正して再依頼';
      if (mail.status === 'approved') return 'キュー投入';
      if (mail.status === 'queued') return '送信待ち';
      if (mail.status === 'sent') return '返信確認';
      return '確認';
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

    function value(id) {
      return document.getElementById(id).value.trim();
    }

    function detailItem(label, value) {
      return '<div class="detail-item"><div class="detail-label">' + escapeHtml(label) + '</div><div class="detail-value">' + escapeHtml(value || '未取得') + '</div></div>';
    }

    function rowBlock(label, value, html = false) {
      return '<div class="row"><label>' + escapeHtml(label) + '</label><div class="detail-text">' + (html ? value : escapeHtml(value || '未取得')) + '</div></div>';
    }

    function renderLink(url) {
      return '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener">' + escapeHtml(url) + '</a>';
    }

    function formatCurrency(value) {
      const number = Number(value || 0);
      return number ? number.toLocaleString('ja-JP') + '円' : '未取得';
    }

    function formatNumber(value) {
      const number = Number(value || 0);
      return Number.isFinite(number) ? number.toLocaleString('ja-JP') : '0';
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

    loadAll();
  </script>
</body>
</html>`;
  }

  @Get('mail-workspace')
  @Header('Content-Type', 'text/html; charset=utf-8')
  mailWorkspace() {
    return this.index()
      .replace('<body class="url-search-page">', '<body class="mail-workspace-page">')
      .replace('<h1>URL検索</h1>', '<h1>メール作成</h1>')
      .replace('<button class="primary" onclick="location.href=\'/\'">URL検索</button>', '<button onclick="location.href=\'/\'">URL検索</button>')
      .replace('<button onclick="location.href=\'/mail-workspace\'">メール作成</button>', '<button class="primary" onclick="location.href=\'/mail-workspace\'">メール作成</button>');
  }

  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  index() {
    return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Sales AI System</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f6f7f9;
      --panel: #ffffff;
      --text: #172026;
      --muted: #66737f;
      --line: #dfe4ea;
      --accent: #136f63;
      --accent-strong: #0f554c;
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
      height: 58px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
      border-bottom: 1px solid var(--line);
      background: var(--panel);
      position: sticky;
      top: 0;
      z-index: 10;
    }
    h1 { font-size: 18px; margin: 0; }
    button, input, select, textarea {
      font: inherit;
    }
    button {
      border: 1px solid var(--line);
      background: var(--panel);
      color: var(--text);
      height: 34px;
      border-radius: 6px;
      padding: 0 12px;
      cursor: pointer;
    }
    button.primary {
      background: var(--accent);
      border-color: var(--accent);
      color: white;
    }
    button.primary:hover { background: var(--accent-strong); }
    button:disabled { opacity: .55; cursor: not-allowed; }
    main {
      display: grid;
      grid-template-columns: 420px minmax(0, 1fr);
      gap: 10px;
      padding: 12px;
      min-height: calc(100vh - 58px);
    }
    .workflow {
      display: none;
    }
    section {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 4px;
      min-width: 0;
    }
    .left, .right { display: grid; gap: 10px; align-content: start; }
    .section-head {
      padding: 10px 12px;
      border-bottom: 1px solid var(--line);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    h2 { font-size: 15px; margin: 0; }
    .body { padding: 12px; }
    .row { display: grid; gap: 8px; margin-bottom: 12px; }
    label { color: var(--muted); font-size: 12px; }
    input, select, textarea {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 4px;
      background: white;
      color: var(--text);
      padding: 9px 10px;
    }
    textarea { min-height: 260px; resize: vertical; line-height: 1.7; }
    .toolbar { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    .muted { color: var(--muted); }
    .status { font-size: 12px; min-height: 18px; }
    .status.ok { color: var(--ok); }
    .status.warn { color: var(--warn); }
    .status.error { color: var(--danger); }
    .notice {
      border: 1px solid #f0d4aa;
      border-left: 4px solid var(--warn);
      background: #fff8ee;
      border-radius: 6px;
      padding: 8px 10px;
      margin-bottom: 12px;
      line-height: 1.6;
    }
    .notice strong { display: block; margin-bottom: 4px; }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    th, td {
      border-bottom: 1px solid var(--line);
      padding: 8px 10px;
      text-align: left;
      vertical-align: top;
    }
    th {
      color: var(--muted);
      font-size: 12px;
      font-weight: 600;
      background: #fafbfc;
    }
    tr[data-selected="true"] { background: #edf7f5; }
    tr:hover { background: #f7faf9; }
    .clip { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .badge {
      display: inline-flex;
      align-items: center;
      min-height: 22px;
      padding: 2px 8px;
      border-radius: 4px;
      background: #edf0f2;
      color: #3b4750;
      font-size: 12px;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .checklist {
      display: grid;
      gap: 10px;
      padding: 0;
      margin: 0;
      list-style: none;
    }
    .checklist label {
      display: grid;
      grid-template-columns: 24px 1fr;
      gap: 10px;
      align-items: center;
      min-height: 46px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: #fafbfc;
      padding: 10px 12px;
      color: var(--text);
      font-size: 13px;
      line-height: 1.5;
      cursor: pointer;
      user-select: none;
    }
    .checklist label:hover {
      border-color: #b8c7d1;
      background: #f4f8f7;
    }
    .checklist label:has(input:checked) {
      border-color: #9fc9c1;
      background: #eef8f6;
    }
    .checklist input {
      width: 20px;
      height: 20px;
      margin: 0;
      accent-color: var(--accent);
      cursor: pointer;
    }
    .split {
      display: grid;
      grid-template-columns: minmax(0, .95fr) minmax(0, 1.05fr);
      gap: 16px;
    }
    .detail-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 14px;
    }
    .detail-item {
      min-width: 0;
      border-left: 3px solid var(--line);
      padding-left: 10px;
    }
    .detail-label {
      color: var(--muted);
      font-size: 12px;
      margin-bottom: 4px;
    }
    .detail-value {
      overflow-wrap: anywhere;
      line-height: 1.5;
    }
    .detail-text {
      white-space: pre-wrap;
      line-height: 1.7;
      color: #26323a;
    }
    .list-block {
      display: grid;
      gap: 6px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .list-block li {
      border-left: 3px solid var(--line);
      padding-left: 10px;
      line-height: 1.6;
    }
    .ai-history {
      display: grid;
      gap: 8px;
      margin-top: 12px;
    }
    .ai-history button {
      height: auto;
      min-height: 34px;
      text-align: left;
      padding: 8px 10px;
    }
    .tabs {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 16px;
    }
    .tab-button {
      background: #eef1f4;
      border-color: #d7dee5;
      color: #34424d;
    }
    .tab-button[data-active="true"] {
      background: var(--accent);
      border-color: var(--accent);
      color: #fff;
    }
    .tab-panel { display: none; }
    .tab-panel[data-active="true"] { display: block; }
    body.url-search-page .left section:not(:first-child),
    body.url-search-page .tabs,
    body.url-search-page .tab-panel,
    body.url-search-page .workflow {
      display: none;
    }
    body.mail-workspace-page .left section:first-child,
    body.mail-workspace-page .right > section:first-child,
    body.mail-workspace-page .tabs,
    body.mail-workspace-page [data-tab-panel="detail"],
    body.mail-workspace-page [data-tab-panel="ai"] {
      display: none;
    }
    body.mail-workspace-page [data-tab-panel="mail"] {
      display: block;
    }
    body.url-search-page main {
      grid-template-columns: minmax(0, 1fr);
      max-width: 1240px;
      width: 100%;
      margin: 0 auto;
      align-content: start;
      gap: 10px;
    }
    body.mail-workspace-page main {
      grid-template-columns: minmax(0, 1fr);
      max-width: 1240px;
      width: 100%;
      margin: 0 auto;
      align-content: start;
      gap: 10px;
    }
    body.mail-workspace-page .left,
    body.mail-workspace-page .right {
      display: block;
    }
    .mail-lead-filter {
      display: none;
    }
    body.mail-workspace-page .mail-lead-filter {
      display: block;
    }
    .mail-filter-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 180px;
      gap: 8px;
    }
    .search-panel {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      margin-top: 14px;
    }
    .search-panel .toolbar { grid-column: 1 / -1; }
    .search-console .body {
      display: grid;
      gap: 14px;
    }
    .direct-import,
    .quick-search {
      display: grid;
      gap: 10px;
      align-items: center;
    }
    .direct-import {
      grid-template-columns: minmax(0, 1fr) 220px;
    }
    .quick-search {
      grid-template-columns: minmax(0, 1fr) 92px 92px;
    }
    .search-filter-row {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
      padding-top: 2px;
    }
    .direct-import .status,
    .quick-search .status {
      grid-column: 1 / -1;
    }
    .advanced-search {
      min-width: 170px;
    }
    .advanced-search summary,
    .display-filter summary {
      height: 34px;
      display: inline-flex;
      align-items: center;
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 0 12px;
      background: #fff;
      cursor: pointer;
      color: #34424d;
      white-space: nowrap;
    }
    .advanced-search[open] summary,
    .display-filter[open] summary {
      border-color: #b9c8d1;
      background: #f8fafb;
    }
    .advanced-search .search-panel {
      margin-top: 10px;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      min-width: min(760px, calc(100vw - 48px));
    }
    body.url-search-page .left,
    body.url-search-page .right {
      display: block;
    }
    body.url-search-page .left {
      order: 1;
    }
    body.url-search-page .right {
      order: 2;
    }
    body.url-search-page .search-console {
      border-radius: 4px;
    }
    .search-drawer > summary {
      min-height: 42px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 0 12px;
      cursor: pointer;
      font-weight: 700;
      border-bottom: 1px solid transparent;
    }
    .search-drawer[open] > summary {
      border-bottom-color: var(--line);
    }
    .search-drawer .body {
      padding-top: 12px;
    }
    .search-block {
      display: grid;
      gap: 8px;
    }
    .search-block-title {
      color: var(--muted);
      font-size: 12px;
      font-weight: 700;
    }
    body.url-search-page .right > section {
      border-radius: 4px;
    }
    .result-filter-panel {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }
    .display-filter {
      margin-top: 10px;
    }
    .display-filter .result-filter-panel {
      margin-top: 10px;
    }
    .candidate-table-wrap {
      overflow: auto;
      border: 1px solid var(--line);
      border-radius: 4px;
    }
    .candidate-table {
      min-width: 980px;
      table-layout: fixed;
    }
    .candidate-table th,
    .candidate-table td {
      vertical-align: top;
    }
    .candidate-table th {
      position: sticky;
      top: 0;
      z-index: 1;
    }
    .candidate-table td {
      background: #fff;
    }
    .candidate-table tr:hover td {
      background: #f8fbfa;
    }
    .candidate-title-cell {
      font-weight: 700;
      line-height: 1.45;
      overflow-wrap: anywhere;
    }
    .candidate-summary {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.55;
      margin-top: 5px;
      overflow-wrap: anywhere;
    }
    .num-cell {
      white-space: nowrap;
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .center-cell {
      text-align: center;
      white-space: nowrap;
    }
    .action-cell {
      white-space: nowrap;
      text-align: right;
    }
    .link-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 34px;
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 0 10px;
      background: #fff;
      color: var(--text);
      font-size: 13px;
      font-weight: 700;
      text-decoration: none;
      white-space: nowrap;
    }
    .link-button:hover {
      border-color: #b8c7d1;
      background: #f8fafb;
      text-decoration: none;
    }
    a {
      color: var(--accent);
      text-decoration: none;
    }
    a:hover { text-decoration: underline; }
    @media (max-width: 980px) {
      main, .workflow, .split, .grid-2, .detail-grid { grid-template-columns: 1fr; }
      header { padding: 0 14px; }
    }
  </style>
</head>
<body class="url-search-page">
  <header>
    <h1>URL検索</h1>
    <div class="toolbar">
      <span id="apiStatus" class="status muted">API確認中</span>
      <div class="top-nav">
        <button class="primary" onclick="location.href='/'">URL検索</button>
        <button onclick="location.href='/leads-view'">営業リスト</button>
        <button onclick="location.href='/mail-workspace'">メール作成</button>
      </div>
      <button onclick="loadAll()">更新</button>
    </div>
  </header>
  <main>
    <section class="workflow" aria-label="業務ステップ">
      <div class="workflow-step">
        <strong><span class="step-label">1</span>URL検索</strong>
        <span>手入力・検索・一覧表示・取り込み</span>
      </div>
      <div class="workflow-step">
        <strong><span class="step-label">2</span>営業リスト</strong>
        <span>状態、詳細、無料分析を確認</span>
      </div>
      <div class="workflow-step">
        <strong><span class="step-label">3</span>メール作成</strong>
        <span>生成、本文確認、レビュー、承認</span>
      </div>
    </section>

    <div class="left">
      <section class="search-console">
        <details class="search-drawer">
          <summary>
            <span>検索条件・URL取り込み</span>
            <span class="muted">開く</span>
          </summary>
          <div class="body">
            <div class="search-block">
              <div class="search-block-title">URLを直接取り込む</div>
              <div class="direct-import">
                <input id="campfireUrl" placeholder="https://camp-fire.jp/projects/.../view" />
                <button class="primary" onclick="importCampfire()">このURLを取り込む</button>
                <span id="importStatus" class="status"></span>
              </div>
            </div>
            <div class="search-block">
              <div class="search-block-title">CAMPFIREから候補を探す</div>
              <div class="quick-search">
                <input id="campfireSearchKeyword" placeholder="キーワード・商品名で候補検索" />
                <button class="primary" onclick="searchCampfireCandidates()">検索</button>
                <button onclick="clearCampfireSearch()">クリア</button>
                <span id="campfireSearchStatusText" class="status"></span>
              </div>
              <div class="search-filter-row">
                <select id="campfireSearchCategory">
                  <option value="">カテゴリを取得中</option>
                </select>
                <select id="campfireFetchLimit">
                  <option value="10">取得上限 10件</option>
                  <option value="50">取得上限 50件</option>
                  <option value="100">取得上限 100件</option>
                </select>
                <select id="campfireSearchProfileProjectRange">
                  <option value="">過去プロジェクト すべて</option>
                  <option value="0:0">初回のみ</option>
                  <option value="1:3">1〜3件</option>
                  <option value="4:9">4〜9件</option>
                  <option value="10:29">10〜29件</option>
                  <option value="30:99">30〜99件</option>
                  <option value="100:">100件以上</option>
                </select>
              </div>
            </div>
          </div>
        </details>
      </section>

      <section class="mail-lead-filter">
        <div class="section-head">
          <h2>対象検索</h2>
        </div>
        <div class="body">
          <div class="mail-filter-row">
            <input id="mailLeadKeyword" placeholder="会社・案件・理由で検索" oninput="renderLeads()" />
            <select id="mailLeadStatusFilter" onchange="renderLeads()">
              <option value="">状態 すべて</option>
              <option value="discovered">発見</option>
              <option value="qualified">候補</option>
              <option value="drafted">下書き済み</option>
              <option value="reviewing">確認中</option>
              <option value="approved">承認済み</option>
              <option value="queued">送信待ち</option>
              <option value="rejected">対象外</option>
            </select>
          </div>
        </div>
      </section>

      <section>
        <div class="section-head">
          <h2>対象を選ぶ</h2>
        </div>
        <div class="body" style="padding:0">
          <table>
            <thead>
              <tr>
                <th style="width:24%">会社</th>
                <th>案件</th>
                <th style="width:90px">状態</th>
                <th style="width:76px">点数</th>
                <th style="width:76px">優先度</th>
                <th style="width:76px">URL</th>
              </tr>
            </thead>
            <tbody id="leadRows"></tbody>
          </table>
        </div>
      </section>
    </div>

    <div class="right">
      <section>
        <div class="section-head">
          <h2>CAMPFIRE候補一覧</h2>
          <div class="toolbar">
            <span id="campfireCandidateCount" class="status muted">未検索</span>
            <button onclick="bulkImportVisibleCandidates()" id="bulkImportButton" disabled>表示中を一括取り込み</button>
          </div>
        </div>
        <div class="body">
          <div id="campfireCandidates">
            <div class="muted">検索すると候補URLがここに表示されます。</div>
          </div>
          <details class="display-filter">
            <summary>一覧の表示条件</summary>
            <div class="result-filter-panel">
              <select id="campfireResultLimit" onchange="renderCampfireCandidates()">
                <option value="10">最大表示 10件</option>
                <option value="50">最大表示 50件</option>
                <option value="100">最大表示 100件</option>
              </select>
              <select id="campfireDisplayStatus" onchange="renderCampfireCandidates()">
                <option value="">公開状態 すべて</option>
                <option value="active">現在公開中</option>
                <option value="endingSoon">終了間近</option>
              </select>
              <select id="campfireDisplayAmountRange" onchange="renderCampfireCandidates()">
                <option value="">支援額 すべて</option>
                <option value="0:500000">50万円未満</option>
                <option value="500000:1000000">50万〜100万円</option>
                <option value="1000000:3000000">100万〜300万円</option>
                <option value="3000000:5000000">300万〜500万円</option>
                <option value="5000000:10000000">500万〜1,000万円</option>
                <option value="10000000:">1,000万円以上</option>
              </select>
              <select id="campfireDisplaySupporterRange" onchange="renderCampfireCandidates()">
                <option value="">サポーター すべて</option>
                <option value="0:30">30人未満</option>
                <option value="30:50">30〜50人</option>
                <option value="50:100">50〜100人</option>
                <option value="100:300">100〜300人</option>
                <option value="300:500">300〜500人</option>
                <option value="500:">500人以上</option>
              </select>
              <select id="campfireDisplayProfileProjectRange" onchange="renderCampfireCandidates()">
                <option value="">過去プロジェクト すべて</option>
                <option value="0:0">初回のみ</option>
                <option value="1:3">1〜3件</option>
                <option value="4:9">4〜9件</option>
                <option value="10:29">10〜29件</option>
                <option value="30:99">30〜99件</option>
                <option value="100:">100件以上</option>
              </select>
            </div>
          </details>
        </div>
      </section>

      <div class="tabs" aria-label="機能タブ">
        <button class="tab-button" data-tab-button="detail" data-active="true" onclick="switchTab('detail')">案件詳細</button>
        <button class="tab-button" data-tab-button="ai" onclick="switchTab('ai')">無料分析</button>
        <button class="tab-button" data-tab-button="mail" onclick="switchTab('mail')">メール確認</button>
      </div>

      <section class="tab-panel" data-tab-panel="detail" data-active="true">
        <div class="section-head">
          <h2>3. 案件詳細</h2>
          <div class="toolbar">
            <button id="openProjectButton" onclick="openSelectedProject()" disabled>URLを開く</button>
          </div>
        </div>
        <div class="body" id="leadDetail">
          <div class="muted">営業リストから案件を選択してください</div>
        </div>
      </section>

      <section class="tab-panel" data-tab-panel="ai">
        <div class="section-head">
          <h2>4. 無料分析</h2>
          <div class="toolbar">
            <button onclick="analyzeLead()" id="analysisButton" disabled>無料分析を再実行</button>
          </div>
        </div>
        <div class="body" id="aiAnalysis">
          <div class="muted">営業リストから案件を選択してください</div>
        </div>
      </section>

      <section class="tab-panel" data-tab-panel="mail">
        <div class="section-head">
          <h2>メール作成・確認</h2>
          <div class="toolbar">
            <select id="templateKey">
              <option value="normal">通常版</option>
              <option value="sns_video_ad">SNS動画・広告版</option>
            </select>
            <button class="primary" id="generateButton" onclick="generateMail()" disabled>新規メール生成</button>
            <button onclick="requestReview()" id="reviewButton" disabled>レビュー依頼</button>
            <button onclick="requestReReview()" id="reReviewButton" disabled>再レビュー依頼</button>
            <button onclick="rejectMail()" id="rejectButton" disabled>棄却</button>
            <button onclick="approveMail()" id="approveButton" disabled>承認</button>
            <button onclick="queueMail()" id="queueButton" disabled>キュー投入</button>
          </div>
        </div>
        <div class="body">
          <div class="row">
            <label>選択案件情報</label>
            <div id="mailLeadSummary">対象を選択してください</div>
          </div>
          <div class="row">
            <label>メール作成履歴</label>
            <table>
              <thead>
                <tr>
                  <th>作成履歴</th>
                  <th style="width:92px">状態</th>
                  <th style="width:120px">作成日</th>
                </tr>
              </thead>
              <tbody id="mailRows"></tbody>
            </table>
          </div>
          <div class="split">
            <div>
              <div id="rejectReasonBox"></div>
              <div class="row">
                <label for="subject">件名</label>
                <input id="subject" />
              </div>
              <div class="row">
                <label for="body">本文</label>
                <textarea id="body"></textarea>
              </div>
              <div class="toolbar">
                <button class="primary" onclick="saveMail()" id="saveButton" disabled>保存</button>
                <span id="mailStatus" class="status"></span>
              </div>
            </div>
            <div>
              <div class="grid-2">
                <div class="row">
                  <label>選択リード</label>
                  <div id="selectedLead" class="muted">未選択</div>
                </div>
                <div class="row">
                  <label>選択メール</label>
                  <div id="selectedMail" class="muted">未選択</div>
                </div>
              </div>
              <div class="row">
                <label>送信前チェック</label>
                <ul class="checklist" id="checklistRows">
                  <li class="muted">メールを選択してください</li>
                </ul>
                <div id="checklistStatus" class="status muted" style="margin-top:8px"></div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </main>

  <script>
    const state = {
      leads: [],
      mails: [],
      checklist: [],
      aiGenerations: [],
      checklistComplete: false,
      selectedLeadId: null,
      selectedMailId: null,
      campfireCategories: [],
      campfireCandidates: []
    };

    async function api(path, options = {}) {
      const response = await fetch(path, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || payload.error?.message || 'APIエラー');
      }
      return payload.data;
    }

    function setStatus(id, message, type = '') {
      const element = document.getElementById(id);
      element.textContent = message;
      element.className = 'status ' + type;
    }

    async function loadAll() {
      try {
        const [leads, mails] = await Promise.all([
          api('/api/leads?limit=200'),
          api('/api/mails?limit=200')
        ]);
        state.leads = leads.items || [];
        state.mails = mails.items || [];
        const selectedMail = ensureSelectedMailForLead();
        renderLeads();
        renderMailLeadSummary();
        renderMails();
        populateMailEditor(selectedMail);
        renderLeadDetail();
        if (state.selectedLeadId) void loadAiAnalysis();
        if (!state.campfireCategories.length) void loadCampfireCategories();
        setStatus('apiStatus', 'API接続OK', 'ok');
      } catch (error) {
        setStatus('apiStatus', error.message, 'error');
      }
    }

    async function loadCampfireCategories() {
      const select = document.getElementById('campfireSearchCategory');
      try {
        const result = await api('/api/projects/categories/campfire');
        state.campfireCategories = result.items || [];
        select.innerHTML = '<option value="">すべてのカテゴリ</option>' +
          state.campfireCategories.map((item) => {
            const label = typeof item === 'string' ? item : item.label;
            const value = typeof item === 'string' ? item : item.value;
            return '<option value="' + escapeHtml(value) + '">' + escapeHtml(label) + '</option>';
          }).join('');
      } catch (error) {
        select.innerHTML = '<option value="">カテゴリ取得失敗</option>';
      }
    }

    async function importCampfire() {
      const url = document.getElementById('campfireUrl').value.trim();
      if (!url) return setStatus('importStatus', 'URLを入力してください', 'warn');
      setStatus('importStatus', '取り込み中', 'warn');
      try {
        const result = await api('/api/projects/import/campfire', {
          method: 'POST',
          body: JSON.stringify({ url })
        });
        state.selectedLeadId = result.lead.id;
        setStatus('importStatus', '取り込み完了。AI分析中', 'warn');
        await loadAll();
        await analyzeLead({ automatic: true });
      } catch (error) {
        setStatus('importStatus', error.message, 'error');
      }
    }

    async function searchCampfireCandidates() {
      const profileProjectRange = rangeFieldValue('campfireSearchProfileProjectRange');
      const hasProfileProjectSearch = profileProjectRange.min !== null || profileProjectRange.max !== null;
      setStatus('campfireSearchStatusText', hasProfileProjectSearch ? '検索中（プロジェクトページ上部の過去件数を確認中）' : '検索中', 'warn');
      document.getElementById('campfireCandidateCount').textContent = '検索中';
      try {
        const result = await api('/api/projects/search/campfire', {
          method: 'POST',
          body: JSON.stringify(compactPayload({
            keyword: fieldValue('campfireSearchKeyword'),
            category: fieldValue('campfireSearchCategory'),
            profileProjectMin: profileProjectRange.min,
            profileProjectMax: profileProjectRange.max,
            limit: numberFieldValue('campfireFetchLimit') || 10
          }))
        });
        state.campfireCandidates = result.items || [];
        renderCampfireCandidates();
        const countText = '取得 ' + state.campfireCandidates.length + '件';
        setStatus('campfireSearchStatusText', countText, 'ok');
        if (!state.campfireCandidates.length) {
          document.getElementById('campfireCandidateCount').textContent = countText;
        }
      } catch (error) {
        setStatus('campfireSearchStatusText', error.message, 'error');
        document.getElementById('campfireCandidateCount').textContent = '検索失敗';
      }
    }

    function clearCampfireSearch() {
      ['campfireSearchKeyword', 'campfireSearchCategory'].forEach((id) => {
        document.getElementById(id).value = '';
      });
      document.getElementById('campfireFetchLimit').value = '10';
      document.getElementById('campfireSearchProfileProjectRange').value = '';
      document.getElementById('campfireResultLimit').value = '10';
      document.getElementById('campfireDisplayStatus').value = '';
      document.getElementById('campfireDisplayAmountRange').value = '';
      document.getElementById('campfireDisplaySupporterRange').value = '';
      document.getElementById('campfireDisplayProfileProjectRange').value = '';
      state.campfireCandidates = [];
      renderCampfireCandidates();
      setStatus('campfireSearchStatusText', '', '');
      document.getElementById('campfireCandidateCount').textContent = '未検索';
    }

    async function importCampfireCandidate(index) {
      const candidate = state.campfireCandidates[index];
      if (!candidate?.url) return;
      document.getElementById('campfireUrl').value = candidate.url;
      await importCampfire();
    }

    async function bulkImportVisibleCandidates() {
      const entries = getVisibleCandidateEntries();
      if (!entries.length) return;
      const ok = window.confirm('表示中の' + entries.length + '件を取り込みます。よろしいですか？');
      if (!ok) return;
      setStatus('importStatus', '一括取り込み中 0/' + entries.length, 'warn');
      for (let index = 0; index < entries.length; index += 1) {
        const candidate = entries[index].item;
        try {
          document.getElementById('campfireUrl').value = candidate.url;
          const result = await api('/api/projects/import/campfire', {
            method: 'POST',
            body: JSON.stringify({ url: candidate.url })
          });
          state.selectedLeadId = result.lead.id;
          await api('/api/ai/leads/' + result.lead.id + '/analyze', { method: 'POST' });
          setStatus('importStatus', '一括取り込み中 ' + (index + 1) + '/' + entries.length, 'warn');
        } catch (error) {
          setStatus('importStatus', '一括取り込みで停止: ' + error.message, 'error');
          await loadAll();
          return;
        }
      }
      setStatus('importStatus', '一括取り込み完了 ' + entries.length + '件', 'ok');
      await loadAll();
    }

    async function analyzeLead(options = {}) {
      if (!state.selectedLeadId) return;
      document.getElementById('aiAnalysis').innerHTML = '<div class="status warn">無料分析中</div>';
      try {
        await api('/api/ai/leads/' + state.selectedLeadId + '/analyze', { method: 'POST' });
        await loadAiAnalysis();
        switchTab('ai');
        if (options.automatic) {
          setStatus('importStatus', '取り込みとAI分析が完了しました。問題なければメール生成へ進んでください。', 'ok');
        }
      } catch (error) {
        if (options.automatic) {
          setStatus('importStatus', '取り込みは完了。AI分析で停止しました: ' + error.message, 'error');
        }
        document.getElementById('aiAnalysis').innerHTML = '<div class="status error">' + escapeHtml(error.message) + '</div>';
      }
    }

    async function generateMail() {
      if (!state.selectedLeadId) return;
      setStatus('mailStatus', '生成中', 'warn');
      try {
        const templateKey = document.getElementById('templateKey').value;
        const result = await api('/api/ai/leads/' + state.selectedLeadId + '/email-draft', {
          method: 'POST',
          body: JSON.stringify({ templateKey, tone: 'low_sales_pressure' })
        });
        state.selectedMailId = result.email.id;
        setStatus('mailStatus', 'メール生成完了', 'ok');
        await loadAll();
        await loadAiAnalysis();
        selectMail(state.selectedMailId);
        switchTab('mail');
      } catch (error) {
        setStatus('mailStatus', error.message, 'error');
      }
    }

    async function saveMail() {
      if (!state.selectedMailId) return;
      setStatus('mailStatus', '保存中', 'warn');
      try {
        await api('/api/mails/' + state.selectedMailId, {
          method: 'PATCH',
          body: JSON.stringify({
            subject: document.getElementById('subject').value,
            body: document.getElementById('body').value
          })
        });
        setStatus('mailStatus', '保存しました', 'ok');
        await loadAll();
      } catch (error) {
        setStatus('mailStatus', error.message, 'error');
      }
    }

    async function loadChecklist() {
      if (!state.selectedMailId) {
        state.checklist = [];
        state.checklistComplete = false;
        renderChecklist();
        return;
      }
      try {
        const result = await api('/api/mails/' + state.selectedMailId + '/checklist');
        state.checklist = result.items || [];
        state.checklistComplete = Boolean(result.complete);
        renderChecklist();
        renderMails();
      } catch (error) {
        setStatus('checklistStatus', error.message, 'error');
      }
    }

    async function loadAiAnalysis() {
      if (!state.selectedLeadId) {
        state.aiGenerations = [];
        renderAiAnalysis();
        return;
      }
      try {
        const result = await api('/api/ai/leads/' + state.selectedLeadId + '/generations');
        state.aiGenerations = result.items || [];
        renderAiAnalysis();
      } catch (error) {
        document.getElementById('aiAnalysis').innerHTML = '<div class="status error">' + escapeHtml(error.message) + '</div>';
      }
    }

    async function toggleChecklist(key, checked) {
      const item = state.checklist.find((entry) => entry.key === key);
      if (!item || !state.selectedMailId) return;
      item.checked = checked;
      renderChecklist();
      try {
        const result = await api('/api/mails/' + state.selectedMailId + '/checklist', {
          method: 'PATCH',
          body: JSON.stringify({
            items: state.checklist.map((entry) => ({
              key: entry.key,
              label: entry.label,
              checked: entry.checked
            }))
          })
        });
        state.checklist = result.items || [];
        state.checklistComplete = Boolean(result.complete);
        renderChecklist();
        renderMails();
      } catch (error) {
        setStatus('checklistStatus', error.message, 'error');
      }
    }

    async function requestReview() {
      await transitionMail('request-review', 'レビュー依頼済み');
    }

    async function requestReReview() {
      await transitionMail('request-rereview', '再レビュー依頼済み');
    }

    async function approveMail() {
      await transitionMail('approve', '承認済み');
    }

    async function rejectMail() {
      if (!state.selectedMailId) return;
      const reason = window.prompt('棄却理由を入力してください', '内容確認後に再作成');
      if (reason === null) return;
      setStatus('mailStatus', '棄却中', 'warn');
      try {
        await api('/api/mails/' + state.selectedMailId + '/reject', {
          method: 'POST',
          body: JSON.stringify({ reason })
        });
        setStatus('mailStatus', '棄却しました', 'ok');
        await loadAll();
        selectMail(state.selectedMailId);
      } catch (error) {
        setStatus('mailStatus', error.message, 'error');
      }
    }

    async function queueMail() {
      await transitionMail('queue', 'キュー投入済み');
    }

    async function transitionMail(action, message) {
      if (!state.selectedMailId) return;
      setStatus('mailStatus', '更新中', 'warn');
      try {
        await api('/api/mails/' + state.selectedMailId + '/' + action, { method: 'POST' });
        setStatus('mailStatus', message, 'ok');
        await loadAll();
        selectMail(state.selectedMailId);
      } catch (error) {
        setStatus('mailStatus', error.message, 'error');
      }
    }

    function renderLeads() {
      const keywordField = document.getElementById('mailLeadKeyword');
      const statusField = document.getElementById('mailLeadStatusFilter');
      const keyword = keywordField ? keywordField.value.trim().toLowerCase() : '';
      const status = statusField ? statusField.value : '';
      const leads = state.leads.filter((lead) => {
        const project = lead.project || {};
        const company = lead.company?.name || lead.companyId;
        const haystack = [company, project.title, project.url, lead.reason].filter(Boolean).join(' ').toLowerCase();
        if (keyword && !haystack.includes(keyword)) return false;
        if (status && lead.status !== status) return false;
        return true;
      });
      const rows = leads.map((lead) => {
        const company = lead.company?.name || lead.companyId;
        const project = lead.project?.title || '案件名なし';
        const projectUrl = lead.project?.url || '';
        return '<tr data-selected="' + (lead.id === state.selectedLeadId) + '" onclick="selectLead(\\'' + lead.id + '\\')">' +
          '<td><div class="clip">' + escapeHtml(company) + '</div></td>' +
          '<td><div class="clip">' + escapeHtml(project) + '</div><div class="muted clip">' + escapeHtml(lead.reason || '') + '</div></td>' +
          '<td><span class="badge">' + escapeHtml(labelLeadStatus(lead.status)) + '</span></td>' +
          '<td>' + Number(lead.score || 0) + '</td>' +
          '<td>' + escapeHtml(labelPriority(lead.priority)) + '</td>' +
          '<td>' + (projectUrl ? '<a href="' + escapeAttr(projectUrl) + '" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">開く</a>' : '-') + '</td>' +
        '</tr>';
      }).join('');
      document.getElementById('leadRows').innerHTML = rows || '<tr><td colspan="6" class="muted">まだリードがありません</td></tr>';
      document.getElementById('generateButton').disabled = !state.selectedLeadId;
      document.getElementById('analysisButton').disabled = !state.selectedLeadId;
      const selected = state.leads.find((lead) => lead.id === state.selectedLeadId);
      document.getElementById('selectedLead').textContent = selected ? (selected.company?.name || selected.id) : '未選択';
    }

    function renderMailLeadSummary() {
      const container = document.getElementById('mailLeadSummary');
      if (!container) return;
      const lead = state.leads.find((item) => item.id === state.selectedLeadId);
      if (!lead) {
        container.innerHTML = '対象を選択してください';
        return;
      }
      const company = lead.company || {};
      const project = lead.project || {};
      const mail = selectedLeadMails()[0];
      container.innerHTML =
        '<div class="detail-grid">' +
          detailItem('企業名', company.name || lead.companyId) +
          detailItem('案件名', project.title || '未取得') +
          detailItem('状態', labelLeadStatus(lead.status)) +
          detailItem('最新メール', mail ? labelMailStatus(mail.status) : '未生成') +
          detailItem('支援額', formatCurrency(project.amount)) +
          detailItem('支援者数', formatNumber(project.supporterCount) + '人') +
          detailItem('連絡先', mailContactSummary(lead)) +
          detailItem('次にやること', mail ? labelMailStatus(mail.status) : '新規メール生成') +
        '</div>' +
        rowBlock('URL', project.url ? renderLink(project.url) : '未取得', true) +
        rowBlock('商品説明', project.description || '未取得');
    }

    function renderCampfireCandidates() {
      const container = document.getElementById('campfireCandidates');
      if (!state.campfireCandidates.length) {
        container.innerHTML = '<div class="muted">検索すると候補URLがここに表示されます。</div>';
        document.getElementById('bulkImportButton').disabled = true;
        return;
      }
      const visibleCandidates = getVisibleCandidateEntries();
      document.getElementById('bulkImportButton').disabled = !visibleCandidates.length;
      document.getElementById('campfireCandidateCount').textContent =
        '表示 ' + visibleCandidates.length + '件 / 取得 ' + state.campfireCandidates.length + '件';
      if (!visibleCandidates.length) {
        container.innerHTML = '<div class="muted">表示条件に合う候補がありません。条件をゆるめてください。</div>';
        return;
      }
      const rows = visibleCandidates.map(({ item, originalIndex }) => {
        const projectUrl = escapeAttr(item.url);
        const pastProjects = item.profileProjectCount === null
          ? '-'
          : item.profileProjectCount === 0
            ? '初回'
            : item.profileProjectCount + '件';
        return '<tr>' +
          '<td>' +
            '<div class="candidate-title-cell"><a href="' + projectUrl + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(item.title || '案件名なし') + '</a></div>' +
            (item.summary ? '<div class="candidate-summary">' + escapeHtml(truncateText(item.summary, 90)) + '</div>' : '') +
          '</td>' +
          '<td class="num-cell">' + formatCurrency(item.amount) + '</td>' +
          '<td class="num-cell">' + formatNumber(item.supporterCount) + '人</td>' +
          '<td class="center-cell">' + (item.daysLeft === null ? '-' : escapeHtml(item.daysLeft + '日')) + '</td>' +
          '<td class="center-cell">' + escapeHtml(pastProjects) + '</td>' +
          '<td>' + escapeHtml(item.category || '-') + '</td>' +
          '<td class="center-cell"><a class="link-button" href="' + projectUrl + '" target="_blank" rel="noopener noreferrer">開く</a></td>' +
          '<td class="action-cell"><button class="primary" onclick="importCampfireCandidate(' + originalIndex + ')">取り込む</button></td>' +
        '</tr>';
      }).join('');
      container.innerHTML =
        '<div class="candidate-table-wrap">' +
          '<table class="candidate-table">' +
            '<thead>' +
              '<tr>' +
                '<th style="width:34%">案件</th>' +
                '<th style="width:110px">支援額</th>' +
                '<th style="width:96px">支援者</th>' +
                '<th style="width:76px">残り</th>' +
                '<th style="width:96px">過去PJ</th>' +
                '<th style="width:130px">カテゴリ</th>' +
                '<th style="width:76px">URL</th>' +
                '<th style="width:104px">操作</th>' +
              '</tr>' +
            '</thead>' +
            '<tbody>' + rows + '</tbody>' +
          '</table>' +
        '</div>';
    }

    function getVisibleCandidateEntries() {
      const limit = numberFieldValue('campfireResultLimit') || 10;
      return state.campfireCandidates
        .map((item, originalIndex) => ({ item, originalIndex }))
        .filter(({ item }) => matchesCampfireDisplayFilters(item))
        .slice(0, limit);
    }

    function matchesCampfireDisplayFilters(item) {
      const amountRange = rangeFieldValue('campfireDisplayAmountRange');
      const supporterRange = rangeFieldValue('campfireDisplaySupporterRange');
      const profileProjectRange = rangeFieldValue('campfireDisplayProfileProjectRange');
      const status = fieldValue('campfireDisplayStatus');

      if (amountRange.min !== null && item.amount < amountRange.min) return false;
      if (amountRange.max !== null && item.amount > amountRange.max) return false;
      if (supporterRange.min !== null && item.supporterCount < supporterRange.min) return false;
      if (supporterRange.max !== null && item.supporterCount > supporterRange.max) return false;
      if ((profileProjectRange.min !== null || profileProjectRange.max !== null) && item.profileProjectCount === null) return false;
      if (profileProjectRange.min !== null && item.profileProjectCount < profileProjectRange.min) return false;
      if (profileProjectRange.max !== null && item.profileProjectCount > profileProjectRange.max) return false;
      if (status === 'active' && !item.isActive) return false;
      if (status === 'endingSoon' && (item.daysLeft === null || item.daysLeft > 7)) return false;
      return true;
    }

    function numberFieldValue(id) {
      const value = fieldValue(id);
      if (!value) return null;
      const number = Number(value);
      return Number.isFinite(number) ? number : null;
    }

    function rangeFieldValue(id) {
      const value = fieldValue(id);
      const [min, max] = value.split(':');
      const minNumber = min === '' || min === undefined ? null : Number(min);
      const maxNumber = max === '' || max === undefined ? null : Number(max);
      return {
        min: Number.isFinite(minNumber) ? minNumber : null,
        max: Number.isFinite(maxNumber) ? maxNumber : null
      };
    }

    function renderAiAnalysis() {
      const container = document.getElementById('aiAnalysis');
      if (!state.selectedLeadId) {
        container.innerHTML = '<div class="muted">営業リストから案件を選択してください</div>';
        return;
      }
      if (!state.aiGenerations.length) {
        container.innerHTML = '<div class="muted">まだAI分析・生成結果がありません</div>';
        return;
      }

      const latest = state.aiGenerations[0];
      const output = latest.outputJson || {};
      const isMailDraft = latest.type === 'email_draft';
      const readiness = output.readiness || {};
      container.innerHTML =
        '<div class="detail-grid">' +
          detailItem('種別', labelAiGenerationType(latest.type)) +
          detailItem('モデル', latest.model) +
          detailItem('生成日時', formatDate(latest.createdAt)) +
          detailItem('トークン', formatTokenUsage(latest)) +
          (!isMailDraft ? detailItem('メール生成判断', (readiness.label || '未判定') + (typeof readiness.score === 'number' ? ' / ' + readiness.score + '点' : '')) : '') +
        '</div>' +
        (!isMailDraft && readiness.reason ? '<div class="notice"><strong>' + escapeHtml(readiness.label || 'メール生成判断') + '</strong>' + escapeHtml(readiness.reason) + '</div>' : '') +
        (!isMailDraft ? '<div class="row"><label>分析まとめ</label><div class="detail-text">' + escapeHtml(output.summary || '未生成') + '</div></div>' : '') +
        (!isMailDraft ? renderListSection('不足している情報', output.missingInfo) : '') +
        (!isMailDraft ? renderListSection('次に確認すること', output.nextChecks) : '') +
        (!isMailDraft ? renderListSection('商品の魅力・強み', output.productStrengths) : '') +
        (!isMailDraft ? renderListSection('使う人', output.targetUsers) : '') +
        (!isMailDraft ? renderListSection('営業の切り口', output.salesAngles) : '') +
        (!isMailDraft ? renderListSection('SNSでの見せ方', output.snsIdeas) : '') +
        (!isMailDraft ? renderListSection('メール作成の注意', output.mailAdvice) : '') +
        renderListSection('使用した事実', output.factsUsed) +
        renderListSection(isMailDraft ? 'AIの推測' : '補足', output.assumptions) +
        renderListSection('注意点', output.riskFlags) +
        (isMailDraft ?
        '<div class="row">' +
          '<label>生成件名</label>' +
          '<div class="detail-value">' + escapeHtml(output.subject || latest.email?.subject || '未生成') + '</div>' +
        '</div>' +
        '<div class="row">' +
          '<label>生成本文</label>' +
          '<div class="detail-text">' + escapeHtml(truncateText(output.body || '', 900) || '未生成') + '</div>' +
        '</div>' : '') +
        '<div class="row">' +
          '<label>履歴</label>' +
          '<div class="ai-history">' + renderAiHistory() + '</div>' +
        '</div>';
    }

    function renderLeadDetail() {
      const lead = state.leads.find((item) => item.id === state.selectedLeadId);
      const container = document.getElementById('leadDetail');
      const openButton = document.getElementById('openProjectButton');
      if (!lead) {
        container.innerHTML = '<div class="muted">営業リストから案件を選択してください</div>';
        openButton.disabled = true;
        return;
      }

      const company = lead.company || {};
      const project = lead.project || {};
      openButton.disabled = !project.url;
      container.innerHTML =
        renderLeadAlerts(lead) +
        '<div class="detail-grid">' +
          detailItem('企業名', company.name || lead.companyId) +
          detailItem('カテゴリ', project.category || '未取得') +
          detailItem('支援額', formatCurrency(project.amount)) +
          detailItem('支援者数', formatNumber(project.supporterCount) + '人') +
          detailItem('Lead状態', labelLeadStatus(lead.status)) +
          detailItem('優先度', labelPriority(lead.priority)) +
          detailItem('スコア', String(Number(lead.score || 0))) +
          detailItem('作成日', formatDate(lead.createdAt)) +
        '</div>' +
        '<div class="row">' +
          '<label>案件名</label>' +
          '<div class="detail-value">' + escapeHtml(project.title || '案件名なし') + '</div>' +
        '</div>' +
        '<div class="row">' +
          '<label>CAMPFIRE URL</label>' +
          '<div class="detail-value">' + renderLink(project.url) + '</div>' +
        '</div>' +
        '<div class="row">' +
          '<label>リード理由</label>' +
          '<div class="detail-text">' + escapeHtml(lead.reason || '未入力') + '</div>' +
        '</div>' +
        '<div class="row">' +
          '<label>プロジェクト説明</label>' +
          '<div class="detail-text">' + escapeHtml(project.description || '未取得') + '</div>' +
        '</div>' +
        renderLeadManagementForm(lead);
    }

    function renderLeadAlerts(lead) {
      const memo = lead.brandAnalysisMemo || '';
      if (!memo.includes('過去プロジェクト')) return '';
      return '<div class="notice"><strong>過去プロジェクト多数の可能性</strong>' + escapeHtml(memo) + '</div>';
    }

    function renderLeadManagementForm(lead) {
      return '<div class="row">' +
          '<label>連絡先確認</label>' +
          '<div class="grid-2">' +
            formInput('leadContactEmail', 'メールアドレス', lead.contactEmail) +
            formInput('leadContactFormUrl', '問い合わせフォームURL', lead.contactFormUrl) +
            formInput('leadSiteMessageUrl', 'サイト内メッセージURL', lead.siteMessageUrl) +
            formInput('leadSendMethod', '送信手段', lead.sendMethod, 'メール / フォーム / サイト内メッセージ') +
          '</div>' +
        '</div>' +
        '<div class="row">' +
          '<label>送信記録</label>' +
          '<div class="grid-2">' +
            formInput('leadSentAt', '送信日', toDateTimeLocal(lead.sentAt), '', 'datetime-local') +
            formInput('leadNextFollowUpAt', '次回確認日', toDateTimeLocal(lead.nextFollowUpAt || lead.nextActionAt), '', 'datetime-local') +
          '</div>' +
        '</div>' +
        '<div class="row">' +
          '<label>ブランド/SNS分析</label>' +
          '<div class="grid-2">' +
            formInput('leadBrandWebsiteUrl', '公式サイト', lead.brandWebsiteUrl) +
            formInput('leadInstagramUrl', 'Instagram', lead.instagramUrl) +
            formInput('leadTiktokUrl', 'TikTok', lead.tiktokUrl) +
            formInput('leadXUrl', 'X', lead.xUrl) +
          '</div>' +
        '</div>' +
        '<div class="row">' +
          '<label for="leadContactMemo">連絡先メモ</label>' +
          '<textarea id="leadContactMemo" style="min-height:80px">' + escapeHtml(lead.contactMemo || '') + '</textarea>' +
        '</div>' +
        '<div class="row">' +
          '<label for="leadBrandAnalysisMemo">ブランド分析メモ</label>' +
          '<textarea id="leadBrandAnalysisMemo" style="min-height:100px">' + escapeHtml(lead.brandAnalysisMemo || '') + '</textarea>' +
        '</div>' +
        '<div class="row">' +
          '<label for="leadSnsAnalysisMemo">SNS分析メモ</label>' +
          '<textarea id="leadSnsAnalysisMemo" style="min-height:100px">' + escapeHtml(lead.snsAnalysisMemo || '') + '</textarea>' +
        '</div>' +
        '<div class="toolbar">' +
          '<button class="primary" onclick="saveLeadManagement()">営業情報を保存</button>' +
          '<span id="leadSaveStatus" class="status"></span>' +
        '</div>';
    }

    function renderMails() {
      const mails = selectedLeadMails();
      if (!state.selectedLeadId) {
        document.getElementById('mailRows').innerHTML = '<tr><td colspan="3" class="muted">対象を選択すると、その企業・案件のメール作成履歴が表示されます</td></tr>';
        document.getElementById('selectedMail').textContent = '未選択';
        populateMailEditor(null);
        renderRejectReason(null);
        updateMailButtons(null);
        return;
      }
      if (state.selectedMailId && !mails.some((mail) => mail.id === state.selectedMailId)) {
        state.selectedMailId = null;
      }
      if (!state.selectedMailId && mails.length) {
        state.selectedMailId = mails[0].id;
      }
      const rows = mails.map((mail) => {
        return '<tr data-selected="' + (mail.id === state.selectedMailId) + '" onclick="selectMail(\\'' + mail.id + '\\')">' +
          '<td><div class="clip">' + escapeHtml(mail.subject) + '</div><div class="muted clip">' + escapeHtml(mail.company?.name || '') + '</div></td>' +
          '<td><span class="badge">' + escapeHtml(labelMailStatus(mail.status)) + '</span></td>' +
          '<td>' + formatDate(mail.createdAt) + '</td>' +
        '</tr>';
      }).join('');
      document.getElementById('mailRows').innerHTML = rows || '<tr><td colspan="3" class="muted">この対象のメール作成履歴はまだありません。メール生成で新規作成できます。</td></tr>';
      const selected = mails.find((mail) => mail.id === state.selectedMailId);
      document.getElementById('selectedMail').textContent = selected ? labelMailStatus(selected.status) : '未選択';
      populateMailEditor(selected);
      renderRejectReason(selected);
      updateMailButtons(selected);
    }

    function mailContactSummary(lead) {
      if (lead.contactEmail) return 'メール';
      if (lead.contactFormUrl) return 'フォーム';
      if (lead.siteMessageUrl) return 'サイト内';
      return '未確認';
    }

    function selectedLeadMails() {
      if (!state.selectedLeadId) return [];
      return state.mails
        .filter((mail) => mail.leadId === state.selectedLeadId || mail.lead?.id === state.selectedLeadId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    function ensureSelectedMailForLead() {
      if (!state.selectedLeadId) {
        state.selectedMailId = null;
        return null;
      }
      const mails = selectedLeadMails();
      const current = mails.find((mail) => mail.id === state.selectedMailId);
      if (current) return current;
      const latest = mails[0] || null;
      state.selectedMailId = latest?.id || null;
      return latest;
    }

    function populateMailEditor(mail) {
      const subject = document.getElementById('subject');
      const body = document.getElementById('body');
      if (subject) subject.value = mail?.subject || '';
      if (body) body.value = mail?.body || '';
    }

    function clearMailEditor() {
      state.selectedMailId = null;
      state.checklist = [];
      state.checklistComplete = false;
      populateMailEditor(null);
      document.getElementById('selectedMail').textContent = '未選択';
      renderRejectReason(null);
      renderChecklist();
      updateMailButtons(null);
    }

    function renderRejectReason(mail) {
      const container = document.getElementById('rejectReasonBox');
      if (!mail || mail.status !== 'rejected') {
        container.innerHTML = '';
        return;
      }
      container.innerHTML = '<div class="notice"><strong>棄却理由</strong>' + escapeHtml(mail.failedReason || '理由未入力') + '<div class="muted" style="margin-top:6px">本文を修正して保存したあと、再レビュー依頼を押してください。</div></div>';
    }

    function renderChecklist() {
      const container = document.getElementById('checklistRows');
      if (!state.selectedMailId) {
        container.innerHTML = '<li class="muted">メールを選択してください</li>';
        setStatus('checklistStatus', '', '');
        return;
      }
      const rows = sortedChecklistItems().map((item) => {
        return '<li><label><input type="checkbox" data-key="' + escapeHtml(item.key) + '" ' + (item.checked ? 'checked' : '') + ' onchange="toggleChecklist(\\'' + item.key + '\\', this.checked)" />' + escapeHtml(item.label) + '</label></li>';
      }).join('');
      container.innerHTML = rows || '<li class="muted">チェック項目を読み込み中</li>';
      const checkedCount = state.checklist.filter((item) => item.checked).length;
      const totalCount = state.checklist.length;
      const message = totalCount ? checkedCount + ' / ' + totalCount + ' 完了' : '';
      setStatus('checklistStatus', message, state.checklistComplete ? 'ok' : 'warn');
    }

    function sortedChecklistItems() {
      return state.checklist
        .map((item, index) => ({ ...item, index }))
        .sort((a, b) => Number(b.checked) - Number(a.checked) || a.index - b.index);
    }

    function selectLead(id) {
      state.selectedLeadId = id;
      state.aiGenerations = [];
      const latestMail = ensureSelectedMailForLead();
      state.checklist = [];
      state.checklistComplete = false;
      renderLeads();
      renderLeadDetail();
      renderMailLeadSummary();
      renderAiAnalysis();
      if (latestMail) {
        selectMail(latestMail.id);
      } else {
        clearMailEditor();
        renderMails();
      }
      void loadAiAnalysis();
    }

    function switchTab(tab) {
      document.querySelectorAll('[data-tab-button]').forEach((button) => {
        button.dataset.active = button.dataset.tabButton === tab ? 'true' : 'false';
      });
      document.querySelectorAll('[data-tab-panel]').forEach((panel) => {
        panel.dataset.active = panel.dataset.tabPanel === tab ? 'true' : 'false';
      });
    }

    async function saveLeadManagement() {
      if (!state.selectedLeadId) return;
      setStatus('leadSaveStatus', '保存中', 'warn');
      const payload = compactPayload({
        contactEmail: fieldValue('leadContactEmail'),
        contactFormUrl: fieldValue('leadContactFormUrl'),
        siteMessageUrl: fieldValue('leadSiteMessageUrl'),
        contactMemo: fieldValue('leadContactMemo'),
        sendMethod: fieldValue('leadSendMethod'),
        sentAt: dateTimeValue('leadSentAt'),
        nextFollowUpAt: dateTimeValue('leadNextFollowUpAt'),
        nextActionAt: dateTimeValue('leadNextFollowUpAt'),
        brandWebsiteUrl: fieldValue('leadBrandWebsiteUrl'),
        instagramUrl: fieldValue('leadInstagramUrl'),
        tiktokUrl: fieldValue('leadTiktokUrl'),
        xUrl: fieldValue('leadXUrl'),
        brandAnalysisMemo: fieldValue('leadBrandAnalysisMemo'),
        snsAnalysisMemo: fieldValue('leadSnsAnalysisMemo')
      });
      try {
        await api('/api/leads/' + state.selectedLeadId, {
          method: 'PATCH',
          body: JSON.stringify(payload)
        });
        setStatus('leadSaveStatus', '保存しました', 'ok');
        await loadAll();
        renderLeadDetail();
      } catch (error) {
        setStatus('leadSaveStatus', error.message, 'error');
      }
    }

    function openSelectedProject() {
      const lead = state.leads.find((item) => item.id === state.selectedLeadId);
      const url = lead?.project?.url;
      if (url) window.open(url, '_blank', 'noopener');
    }

    function selectMail(id) {
      state.selectedMailId = id;
      state.checklist = [];
      state.checklistComplete = false;
      const mail = selectedLeadMails().find((item) => item.id === id) || state.mails.find((item) => item.id === id);
      if (!mail) {
        clearMailEditor();
        return;
      }
      populateMailEditor(mail);
      renderMails();
      renderChecklist();
      void loadChecklist();
    }

    function updateMailButtons(mail) {
      document.getElementById('saveButton').disabled = !mail;
      document.getElementById('reviewButton').disabled = !mail || mail.status !== 'draft';
      document.getElementById('reReviewButton').disabled = !mail || mail.status !== 'rejected';
      document.getElementById('rejectButton').disabled = !mail || !['in_review', 'approved'].includes(mail.status);
      document.getElementById('approveButton').disabled = !mail || mail.status !== 'in_review' || !state.checklistComplete;
      document.getElementById('queueButton').disabled = !mail || mail.status !== 'approved' || !state.checklistComplete;
    }

    function formatDate(value) {
      if (!value) return '';
      return new Date(value).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
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
        project_summary: '無料分析',
        email_draft: 'メール生成',
        lead_scoring: 'スコア分析',
        subject_generation: '件名生成',
        reply_classification: '返信分類',
        next_action: '次アクション'
      })[type] || type || '未設定';
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
        rejected: '対象外',
        no_response: '返信なし',
        archived: 'アーカイブ'
      })[status] || status || '未設定';
    }

    function labelPriority(priority) {
      return ({
        high: '高',
        medium: '中',
        low: '低'
      })[priority] || priority || '未設定';
    }

    function formatNumber(value) {
      const number = Number(value || 0);
      return Number.isFinite(number) ? number.toLocaleString('ja-JP') : '0';
    }

    function formatCurrency(value) {
      const number = Number(value || 0);
      return Number.isFinite(number) ? number.toLocaleString('ja-JP') + '円' : '0円';
    }

    function formatTokenUsage(item) {
      const input = Number(item.tokenInput || 0);
      const output = Number(item.tokenOutput || 0);
      return (input + output).toLocaleString('ja-JP');
    }

    function detailItem(label, value) {
      return '<div class="detail-item"><div class="detail-label">' + escapeHtml(label) + '</div><div class="detail-value">' + escapeHtml(value || '未取得') + '</div></div>';
    }

    function formInput(id, label, value, placeholder = '', type = 'text') {
      return '<div class="row">' +
        '<label for="' + escapeHtml(id) + '">' + escapeHtml(label) + '</label>' +
        '<input id="' + escapeHtml(id) + '" type="' + escapeHtml(type) + '" value="' + escapeAttr(value || '') + '" placeholder="' + escapeAttr(placeholder) + '" />' +
      '</div>';
    }

    function fieldValue(id) {
      return document.getElementById(id)?.value.trim() || '';
    }

    function dateTimeValue(id) {
      const value = fieldValue(id);
      return value ? new Date(value).toISOString() : '';
    }

    function compactPayload(payload) {
      return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== '' && value !== null && value !== undefined));
    }

    function toDateTimeLocal(value) {
      if (!value) return '';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '';
      const offsetMs = date.getTimezoneOffset() * 60000;
      return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
    }

    function renderLink(value) {
      if (!value) return '<span class="muted">未取得</span>';
      return '<a href="' + escapeHtml(value) + '" target="_blank" rel="noopener">' + escapeHtml(value) + '</a>';
    }

    function renderListSection(label, values) {
      const items = Array.isArray(values) ? values.filter(Boolean) : [];
      const content = items.length
        ? '<ul class="list-block">' + items.map((item) => '<li>' + escapeHtml(item) + '</li>').join('') + '</ul>'
        : '<div class="muted">なし</div>';
      return '<div class="row"><label>' + escapeHtml(label) + '</label>' + content + '</div>';
    }

    function renderAiHistory() {
      return state.aiGenerations.map((item, index) => {
        const title = formatDate(item.createdAt) + ' / ' + labelAiGenerationType(item.type) + ' / ' + item.model;
        return '<button onclick="showAiGeneration(' + index + ')">' + escapeHtml(title) + '</button>';
      }).join('');
    }

    function showAiGeneration(index) {
      const item = state.aiGenerations[index];
      if (!item) return;
      state.aiGenerations = [item].concat(state.aiGenerations.filter((_, itemIndex) => itemIndex !== index));
      renderAiAnalysis();
    }

    function truncateText(value, maxLength) {
      const text = String(value || '');
      return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
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
}
