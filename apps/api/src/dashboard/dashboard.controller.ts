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
      .filters, .stats, .split, .detail-grid, .detail-shell, .form-grid { grid-template-columns: 1fr; }
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
        <div class="body table-scroll lead-list-scroll" style="padding:0">
          <table>
            <thead>
              <tr>
                <th style="width:18%">会社</th>
                <th>案件</th>
                <th style="width:90px">状態</th>
                <th style="width:70px">優先度</th>
                <th style="width:70px">点数</th>
                <th style="width:130px">連絡/手段</th>
                <th style="width:110px">最新メール</th>
                <th style="width:150px">次対応</th>
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
        <div class="body lead-detail-stack">
          <div id="leadDetail">
            <div class="muted">営業リストから案件を選択してください</div>
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
  <footer>Sales AI System</footer>
  <script>
    const SELECTED_LEAD_STORAGE_KEY = 'salesAiSystem.selectedLeadId';
    const state = { leads: [], mails: [], aiGenerations: [], selectedLeadId: null };

    async function api(path, options = {}) {
      const response = await fetch(path, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
      });
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
        restoreSelectedLead();
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
      renderLeadAnalysis();
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
        const sendMethod = lead.sendMethod || suggestSendMethod(lead);
        return '<tr data-selected="' + (lead.id === state.selectedLeadId) + '" onclick="selectLead(\\'' + lead.id + '\\')">' +
          '<td><div class="clip">' + escapeHtml(lead.company?.name || lead.companyId) + '</div></td>' +
          '<td><div class="clip">' + escapeHtml(project.title || '案件名なし') + '</div><div class="muted clip">' + escapeHtml(project.url || '') + '</div></td>' +
          '<td><span class="badge">' + escapeHtml(labelLeadStatus(lead.status)) + '</span></td>' +
          '<td>' + escapeHtml(labelPriority(lead.priority)) + '</td>' +
          '<td>' + escapeHtml(Number(lead.score || 0)) + '</td>' +
          '<td><span class="badge ' + (contact === '未確認' ? 'danger' : 'ok') + '">' + escapeHtml(contact) + '</span><div class="muted clip">' + escapeHtml(sendMethod || '手段未定') + '</div></td>' +
          '<td>' + (mail ? '<span class="badge ' + mailBadgeClass(mail.status) + '">' + escapeHtml(labelMailStatus(mail.status)) + '</span>' : '<span class="badge warn">未生成</span>') + '</td>' +
          '<td><div>' + escapeHtml(nextActionLabel(lead, mail)) + '</div><div class="muted">' + escapeHtml(nextActionDateLabel(lead)) + '</div></td>' +
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
        document.getElementById('leadAnalysis').innerHTML = '<div class="muted">案件を選択すると分析結果が表示されます</div>';
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
      document.getElementById('leadAnalysis').innerHTML = '<div class="muted">分析結果を読み込み中</div>';
      try {
        const result = await api('/api/ai/leads/' + state.selectedLeadId + '/generations');
        state.aiGenerations = result.items || [];
        renderDetail();
        renderLeadAnalysis();
      } catch (error) {
        document.getElementById('leadAnalysis').innerHTML = '<div class="status error">' + escapeHtml(error.message) + '</div>';
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
        container.innerHTML = '<section style="border-radius:4px"><div class="section-head"><h2>分析</h2></div><div class="body muted">まだ分析結果がありません。URL取り込み時の自動分析、または無料分析を実行してください。</div></section>';
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
              detailItem('費用', latest.provider === 'local' ? '無料分析' : 'AI生成') +
            '</div>' +
            rowBlock('分析まとめ', output.summary || '未生成') +
            renderPlaceholderAnalysis(output.mailPlaceholders) +
            listBlock('商品の魅力・強み', output.productStrengths) +
            listBlock('SNSでの見せ方', output.snsIdeas) +
            listBlock('次に確認すること', output.nextChecks) +
          '</div>' +
        '</section>';
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
      return {
        ownerMemo: [
          output.summary,
          output.readiness?.label ? '判断: ' + output.readiness.label + (typeof output.readiness.score === 'number' ? ' / ' + output.readiness.score + '点' : '') : '',
          memoList('次に確認', output.nextChecks)
        ].filter(Boolean).join('\\n\\n'),
        brandAnalysisMemo: [
          memoList('商品の魅力・強み', output.productStrengths),
          placeholders.appeal ? 'メールで触れる魅力: ' + placeholders.appeal : '',
          placeholders.targetUser ? '想定する相手: ' + placeholders.targetUser : '',
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

    function renderLeadEditPanel(lead) {
      const memo = suggestedLeadMemos(lead);
      return '<div class="row">' +
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
        project_summary: '無料分析',
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
      min-height: 56px;
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
    h1 { font-size: 18px; margin: 0; letter-spacing: 0; }
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
      grid-template-columns: minmax(0, 1fr);
      gap: 10px;
      padding: 12px;
      min-height: calc(100vh - 56px);
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
    .left, .right { display: grid; gap: 10px; align-content: start; min-width: 0; }
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
    textarea { min-height: 300px; resize: vertical; line-height: 1.8; }
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
      padding: 9px 10px;
      text-align: left;
      vertical-align: top;
    }
    th {
      color: var(--muted);
      font-size: 12px;
      font-weight: 600;
      background: #fafbfc;
    }
    .table-scroll {
      overflow: auto;
      border-top: 0;
    }
    .table-scroll table {
      margin: 0;
    }
    .table-scroll thead th {
      position: sticky;
      top: 0;
      z-index: 2;
      border-bottom: 1px solid var(--line);
    }
    .lead-list-scroll {
      max-height: 280px;
    }
    .mail-history-scroll {
      max-height: 220px;
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
      grid-template-columns: minmax(0, 1fr);
      gap: 12px;
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
    .info-columns {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }
    .info-card {
      border: 1px solid var(--line);
      border-radius: 4px;
      background: #fbfcfd;
      padding: 10px;
      min-width: 0;
    }
    .info-card h3 {
      margin: 0 0 8px;
      font-size: 13px;
    }
    .info-card ul {
      margin: 0;
      padding-left: 18px;
      line-height: 1.7;
    }
    .info-card li + li {
      margin-top: 4px;
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
    .mail-lead-filter { display: none; }
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
      gap: 8px;
      padding: 10px 12px;
    }
    .direct-import,
    .quick-search,
    .source-selector {
      display: grid;
      gap: 8px;
      align-items: center;
      max-width: 980px;
    }
    .source-selector {
      grid-template-columns: minmax(220px, 320px) minmax(0, 1fr);
      justify-content: start;
    }
    .direct-import {
      grid-template-columns: minmax(320px, 720px) 180px;
      justify-content: start;
    }
    .quick-search {
      grid-template-columns: minmax(320px, 720px);
      justify-content: start;
    }
    .search-filter-row {
      display: grid;
      grid-template-columns: repeat(3, minmax(180px, 240px));
      gap: 8px;
      padding-top: 0;
      justify-content: start;
    }
    .search-actions {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 8px;
      max-width: 980px;
    }
    .search-actions .status {
      min-width: 180px;
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
    .search-drawer > summary,
    .mail-filter-drawer > summary {
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
    .search-drawer[open] > summary,
    .mail-filter-drawer[open] > summary {
      border-bottom-color: var(--line);
    }
    .search-drawer .body,
    .mail-filter-drawer .body {
      padding-top: 10px;
    }
    .search-block {
      display: grid;
      grid-template-columns: 150px minmax(0, 1fr);
      gap: 8px 12px;
      align-items: center;
    }
    .search-block-title {
      color: var(--muted);
      font-size: 12px;
      font-weight: 700;
    }
    .search-block .direct-import,
    .search-block .quick-search,
    .search-block .source-selector,
    .search-block .search-filter-row,
    .search-block .search-actions {
      grid-column: 2;
    }
    details[open] .when-closed,
    details:not([open]) .when-open {
      display: none;
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
      position: relative;
      margin-top: 0;
    }
    .display-filter .result-filter-panel {
      position: absolute;
      right: 0;
      top: 40px;
      z-index: 20;
      width: min(760px, calc(100vw - 48px));
      padding: 12px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: #fff;
      box-shadow: 0 12px 28px rgba(23, 32, 38, .14);
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
    .compact-summary {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
    }
    .mail-actions {
      border-top: 1px solid var(--line);
      margin-top: 12px;
      padding-top: 12px;
    }
    .mail-flow {
      display: grid;
      gap: 12px;
    }
    .mail-context {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 10px;
    }
    .mail-stage {
      border: 1px solid var(--line);
      border-radius: 4px;
      background: #fff;
      overflow: hidden;
    }
    .mail-stage-head {
      min-height: 42px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 8px 12px;
      border-bottom: 1px solid var(--line);
      background: #fbfcfd;
    }
    .mail-stage-head h3 {
      margin: 0;
      font-size: 14px;
    }
    .mail-stage-body {
      padding: 12px;
    }
    .mail-create-bar {
      display: grid;
      grid-template-columns: minmax(180px, 240px) auto minmax(240px, 1fr);
      gap: 8px;
      align-items: center;
    }
    .mail-editor-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.35fr) minmax(360px, .65fr);
      gap: 12px;
      align-items: start;
    }
    .next-action-strip {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px;
    }
    .next-action-card {
      border: 1px solid var(--line);
      border-radius: 4px;
      padding: 8px 10px;
      background: #fbfcfd;
    }
    .next-action-card strong {
      display: block;
      font-size: 13px;
      margin-bottom: 4px;
    }
    footer {
      max-width: 1240px;
      margin: 0 auto;
      padding: 0 12px 14px;
      color: var(--muted);
      font-size: 12px;
    }
    a {
      color: var(--accent);
      text-decoration: none;
    }
    a:hover { text-decoration: underline; }
    @media (max-width: 980px) {
      main, .workflow, .split, .grid-2, .detail-grid, .compact-summary, .mail-create-bar, .mail-editor-grid, .next-action-strip, .info-columns { grid-template-columns: 1fr; }
      header { padding: 0 14px; }
      .direct-import, .quick-search, .source-selector, .search-filter-row, .mail-filter-row, .result-filter-panel, .search-block { grid-template-columns: 1fr; }
      .search-actions { flex-wrap: wrap; }
      .display-filter .result-filter-panel {
        position: static;
        width: auto;
        margin-top: 8px;
        box-shadow: none;
      }
      .search-block .direct-import,
      .search-block .quick-search,
      .search-block .source-selector,
      .search-block .search-filter-row,
      .search-block .search-actions {
        grid-column: 1;
      }
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
            <span>取得元・URL取り込み</span>
            <span class="muted"><span class="when-closed">開く</span><span class="when-open">閉じる</span></span>
          </summary>
          <div class="body">
            <div class="search-block">
              <div class="search-block-title">取得元</div>
              <div class="source-selector">
                <select id="sourcePlatform" onchange="onSourcePlatformChange()">
                  <option value="campfire">CAMPFIRE</option>
                  <option value="makuake">Makuake（準備中）</option>
                  <option value="greenfunding">GREEN FUNDING（準備中）</option>
                </select>
                <span id="sourcePlatformStatus" class="status muted">CAMPFIREの募集中プロジェクトに対応</span>
              </div>
            </div>
            <div class="search-block">
              <div class="search-block-title">URL直接取り込み</div>
              <div class="direct-import">
                <input id="campfireUrl" placeholder="https://camp-fire.jp/projects/.../view" />
                <button class="primary" onclick="importCampfire()">このURLを取り込む</button>
                <span id="importStatus" class="status"></span>
              </div>
            </div>
            <div class="search-block">
              <div class="search-block-title">候補を探す</div>
              <div class="quick-search">
                <input id="campfireSearchKeyword" placeholder="キーワード・商品名で候補検索" />
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
              <div class="search-actions">
                <button class="primary" onclick="searchCampfireCandidates()">検索</button>
                <button onclick="clearCampfireSearch()">クリア</button>
                <span id="campfireSearchStatusText" class="status"></span>
              </div>
            </div>
          </div>
        </details>
      </section>

      <section class="mail-lead-filter">
        <details class="mail-filter-drawer">
          <summary>
            <span>対象検索</span>
            <span class="muted"><span class="when-closed">開く</span><span class="when-open">閉じる</span></span>
          </summary>
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
        </details>
      </section>

      <section>
        <div class="section-head">
          <h2>営業対象一覧</h2>
          <span id="mailLeadCount" class="status muted">0件</span>
        </div>
        <div class="body table-scroll lead-list-scroll" style="padding:0">
          <table>
            <thead>
              <tr>
                <th style="width:24%">会社</th>
                <th>案件</th>
                <th style="width:90px">状態</th>
                <th style="width:76px">点数</th>
                <th style="width:76px">優先度</th>
                <th style="width:76px">URL</th>
                <th style="width:90px">選択</th>
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
          <h2>候補URL一覧</h2>
          <div class="toolbar">
            <span id="campfireCandidateCount" class="status muted">未検索</span>
            <details class="display-filter">
              <summary>表示条件</summary>
              <div class="result-filter-panel">
                <select id="campfireResultLimit" onchange="renderCampfireCandidates()">
                  <option value="10">最大表示 10件</option>
                  <option value="50">最大表示 50件</option>
                  <option value="100">最大表示 100件</option>
                </select>
                <select id="campfireDisplayStatus" onchange="renderCampfireCandidates()">
                  <option value="">公開状態 すべて</option>
                  <option value="active">募集中のみ</option>
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
            <button onclick="bulkImportVisibleCandidates()" id="bulkImportButton" disabled>表示中を一括取り込み</button>
            <span id="bulkImportStatus" class="status"></span>
          </div>
        </div>
        <div class="body">
          <div id="campfireCandidates">
            <div class="muted">検索すると候補URLがここに表示されます。</div>
          </div>
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
          <span id="mailStatus" class="status"></span>
        </div>
        <div class="body mail-flow">
          <div class="mail-stage">
            <div class="mail-stage-head">
              <h3>選択中の営業対象</h3>
              <span id="mailNextAction" class="status muted"></span>
            </div>
            <div class="mail-stage-body">
              <div id="mailLeadSummary">上の営業対象一覧から、メールを作成・確認する案件を選択してください。</div>
            </div>
          </div>

          <div class="mail-stage">
            <div class="mail-stage-head">
              <h3>2. 作成履歴</h3>
              <div class="mail-create-bar">
                <select id="templateKey">
                  <option value="normal">通常版</option>
                  <option value="sns_video_ad">SNS動画・広告版</option>
                </select>
                <button class="primary" id="generateButton" onclick="generateMail()" disabled>無料メール生成</button>
                <span id="generateHelp" class="status muted">対象を選択してください</span>
              </div>
            </div>
            <div class="mail-stage-body table-scroll mail-history-scroll" style="padding:0">
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
          </div>

          <div class="mail-stage">
            <div class="mail-stage-head">
              <h3>3. 本文編集</h3>
              <div class="toolbar">
                <button onclick="polishMail()" id="polishButton" disabled>AIで整える</button>
                <button class="primary" onclick="saveMail()" id="saveButton" disabled>保存</button>
              </div>
            </div>
            <div class="mail-stage-body mail-editor-grid">
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
              </div>
              <div>
                <div class="compact-summary">
                  <div class="detail-item">
                    <div class="detail-label">選択リード</div>
                  <div id="selectedLead" class="detail-value muted">未選択</div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">選択メール</div>
                  <div id="selectedMail" class="detail-value muted">未選択</div>
                  </div>
                </div>
                <div class="row">
                  <label>次に押すボタン</label>
                  <div id="mailActionGuide" class="detail-text">メールを選択してください</div>
                </div>
              </div>
            </div>
          </div>

          <div class="mail-stage">
            <div class="mail-stage-head">
              <h3>4. 送信前チェック・レビュー</h3>
              <span id="checklistStatus" class="status muted"></span>
            </div>
            <div class="mail-stage-body">
              <div class="next-action-strip" id="mailStageCards"></div>
              <div class="row">
                <label>送信前チェック</label>
                <ul class="checklist" id="checklistRows">
                  <li class="muted">メールを選択してください</li>
                </ul>
              </div>
              <div class="toolbar mail-actions">
                <button onclick="requestReview()" id="reviewButton" disabled>レビュー依頼</button>
                <button onclick="requestReReview()" id="reReviewButton" disabled>再レビュー依頼</button>
                <button onclick="rejectMail()" id="rejectButton" disabled>棄却</button>
                <button onclick="approveMail()" id="approveButton" disabled>承認</button>
                <button onclick="queueMail()" id="queueButton" disabled>キュー投入</button>
                <button onclick="markMailSent()" id="markSentButton" disabled>送信済みにする</button>
              </div>
            </div>
          </div>

          <div class="mail-stage">
            <div class="mail-stage-head">
              <h3>5. 返信メモ</h3>
              <span class="status muted">送信後に使う欄</span>
            </div>
            <div class="mail-stage-body">
              <div class="row">
                <label for="replyBody">返信記録</label>
                <input id="replyFromEmail" placeholder="返信元メールアドレス 任意" />
                <textarea id="replyBody" style="min-height:110px" placeholder="返信内容を貼り付け"></textarea>
                <div class="toolbar">
                  <button onclick="recordReply()" id="replyButton" disabled>返信を記録</button>
                  <span id="replyStatus" class="status"></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </main>
  <footer>
    <span>Sales AI System</span>
  </footer>

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
      campfireCandidates: [],
      candidateImportStatus: {},
      campfireSearchTimerId: null,
      campfireSearchStartedAt: null
    };
    const SELECTED_LEAD_STORAGE_KEY = 'salesAiSystem.selectedLeadId';

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

    function selectedSourcePlatform() {
      return document.getElementById('sourcePlatform')?.value || 'campfire';
    }

    function sourcePlatformLabel(value = selectedSourcePlatform()) {
      const labels = {
        campfire: 'CAMPFIRE',
        makuake: 'Makuake',
        greenfunding: 'GREEN FUNDING'
      };
      return labels[value] || value;
    }

    function onSourcePlatformChange() {
      const platform = selectedSourcePlatform();
      const urlInput = document.getElementById('campfireUrl');
      if (urlInput) {
        urlInput.placeholder = platform === 'campfire'
          ? 'https://camp-fire.jp/projects/.../view'
          : sourcePlatformLabel(platform) + 'のプロジェクトURL（準備中）';
      }
      if (platform === 'campfire') {
        setStatus('sourcePlatformStatus', 'CAMPFIREの募集中プロジェクトに対応', 'muted');
        return;
      }
      setStatus('sourcePlatformStatus', sourcePlatformLabel(platform) + 'は取得元として準備中です', 'warn');
    }

    function ensureSupportedSourcePlatform(statusId) {
      if (selectedSourcePlatform() === 'campfire') return true;
      setStatus(statusId, sourcePlatformLabel() + 'は準備中です。現在はCAMPFIREのみ検索・取り込みできます。', 'warn');
      return false;
    }

    function startCampfireSearchTimer(hasProfileProjectSearch) {
      stopCampfireSearchTimer();
      state.campfireSearchStartedAt = Date.now();
      const note = hasProfileProjectSearch ? ' / 過去PJ条件あり' : '';
      const render = () => {
        setStatus('campfireSearchStatusText', '検索中 ' + formatElapsed(Date.now() - state.campfireSearchStartedAt) + note, 'warn');
      };
      render();
      state.campfireSearchTimerId = window.setInterval(render, 1000);
    }

    function stopCampfireSearchTimer() {
      if (state.campfireSearchTimerId) {
        window.clearInterval(state.campfireSearchTimerId);
        state.campfireSearchTimerId = null;
      }
    }

    function currentSearchElapsedText() {
      if (!state.campfireSearchStartedAt) return '';
      return formatElapsed(Date.now() - state.campfireSearchStartedAt);
    }

    function formatElapsed(milliseconds) {
      const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      if (!minutes) return seconds + '秒';
      return minutes + '分' + String(seconds).padStart(2, '0') + '秒';
    }

    async function loadAll() {
      try {
        const [leads, mails] = await Promise.all([
          api('/api/leads?limit=200'),
          api('/api/mails?limit=200')
        ]);
        state.leads = leads.items || [];
        state.mails = mails.items || [];
        restoreSelectedLead();
        syncCandidateImportStatuses();
        const selectedMail = ensureSelectedMailForLead();
        renderLeads();
        renderMailLeadSummary();
        renderMails();
        populateMailEditor(selectedMail);
        renderLeadDetail();
        if (state.selectedLeadId) void loadAiAnalysis();
        if (!state.campfireCategories.length) void loadCampfireCategories();
        onSourcePlatformChange();
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
      if (!ensureSupportedSourcePlatform('importStatus')) return;
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
      if (!ensureSupportedSourcePlatform('campfireSearchStatusText')) return;
      const profileProjectRange = rangeFieldValue('campfireSearchProfileProjectRange');
      const hasProfileProjectSearch = profileProjectRange.min !== null || profileProjectRange.max !== null;
      const desiredLimit = numberFieldValue('campfireFetchLimit') || 10;
      startCampfireSearchTimer(hasProfileProjectSearch);
      document.getElementById('campfireCandidateCount').textContent = '検索中';
      try {
        const result = await api('/api/projects/search/campfire', {
          method: 'POST',
          body: JSON.stringify(compactPayload({
            keyword: fieldValue('campfireSearchKeyword'),
            category: fieldValue('campfireSearchCategory'),
            profileProjectMin: profileProjectRange.min,
            profileProjectMax: profileProjectRange.max,
            limit: desiredLimit,
            status: 'active',
            excludeUrls: knownCampfireUrls()
          }))
        });
        state.campfireCandidates = result.items || [];
        syncCandidateImportStatuses();
        renderCampfireCandidates();
        const countText = '新規候補 ' + state.campfireCandidates.length + '件';
        const elapsed = currentSearchElapsedText();
        stopCampfireSearchTimer();
        setStatus('campfireSearchStatusText', countText + ' / ' + elapsed, 'ok');
        if (!state.campfireCandidates.length) {
          document.getElementById('campfireCandidateCount').textContent = countText;
        }
      } catch (error) {
        const elapsed = currentSearchElapsedText();
        stopCampfireSearchTimer();
        setStatus('campfireSearchStatusText', error.message + (elapsed ? ' / ' + elapsed : ''), 'error');
        document.getElementById('campfireCandidateCount').textContent = '検索失敗';
      }
    }

    function knownCampfireUrls() {
      const leadUrls = state.leads.map((lead) => lead.project?.url).filter(Boolean);
      const importedCandidateUrls = Object.entries(state.candidateImportStatus)
        .filter(([, value]) => value?.status === 'imported' || value?.status === 'existing')
        .map(([key]) => key)
        .filter(Boolean);
      return Array.from(new Set([...leadUrls, ...importedCandidateUrls]));
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
      state.candidateImportStatus = {};
      stopCampfireSearchTimer();
      state.campfireSearchStartedAt = null;
      renderCampfireCandidates();
      setStatus('campfireSearchStatusText', '', '');
      document.getElementById('campfireCandidateCount').textContent = '未検索';
    }

    async function importCampfireCandidate(index) {
      const candidate = state.campfireCandidates[index];
      if (!candidate?.url) return;
      const importState = getCandidateImportState(candidate);
      if (importState.status === 'existing' || importState.status === 'imported' || importState.status === 'importing') return;
      document.getElementById('campfireUrl').value = candidate.url;
      setCandidateImportStatus(candidate, 'importing', '取り込み中');
      renderCampfireCandidates();
      setStatus('importStatus', '取り込み中', 'warn');
      try {
        const result = await api('/api/projects/import/campfire', {
          method: 'POST',
          body: JSON.stringify({ url: candidate.url })
        });
        state.selectedLeadId = result.lead.id;
        setCandidateImportStatus(candidate, 'imported', '取り込み済み', result.lead.id);
        renderCampfireCandidates();
        setStatus('importStatus', '取り込み完了。AI分析中', 'warn');
        await loadAll();
        await analyzeLead({ automatic: true });
      } catch (error) {
        setCandidateImportStatus(candidate, 'failed', error.message);
        renderCampfireCandidates();
        setStatus('importStatus', error.message, 'error');
      }
    }

    async function bulkImportVisibleCandidates() {
      const entries = getVisibleCandidateEntries();
      const importableEntries = entries.filter(({ item }) => isCandidateImportable(item));
      if (!importableEntries.length) {
        return setStatus('bulkImportStatus', '表示中に取り込める候補はありません', 'warn');
      }
      const ok = window.confirm('表示中の未取込候補 ' + importableEntries.length + '件を取り込みます。登録済み・取込済みは取り込みません。よろしいですか？');
      if (!ok) return;
      let successCount = 0;
      let failedCount = 0;
      let completedCount = 0;
      let analyzedCount = 0;
      let analysisFailedCount = 0;
      const importResults = [];
      const importConcurrency = Math.min(4, importableEntries.length);
      const analysisConcurrency = Math.min(6, importableEntries.length);
      setStatus('bulkImportStatus', '一括取り込み中 0/' + importableEntries.length, 'warn');
      await runWithConcurrency(importableEntries, importConcurrency, async ({ item: candidate }) => {
        try {
          document.getElementById('campfireUrl').value = candidate.url;
          setCandidateImportStatus(candidate, 'importing', '取り込み中');
          renderCampfireCandidates();
          const result = await api('/api/projects/import/campfire', {
            method: 'POST',
            body: JSON.stringify({ url: candidate.url })
          });
          state.selectedLeadId = result.lead.id;
          importResults.push({ candidate, leadId: result.lead.id });
          setCandidateImportStatus(candidate, 'imported', '取り込み済み・分析待ち', result.lead.id);
          successCount += 1;
        } catch (error) {
          setCandidateImportStatus(candidate, 'failed', error.message);
          failedCount += 1;
        }
        completedCount += 1;
        setStatus('bulkImportStatus', '一括取り込み中 ' + completedCount + '/' + importableEntries.length + (failedCount ? '（失敗 ' + failedCount + '件）' : ''), 'warn');
        renderCampfireCandidates();
      });

      if (importResults.length) {
        setStatus('bulkImportStatus', 'AI分析中 0/' + importResults.length, 'warn');
        await runWithConcurrency(importResults, analysisConcurrency, async ({ candidate, leadId }) => {
          try {
            setCandidateImportStatus(candidate, 'imported', 'AI分析中', leadId);
            renderCampfireCandidates();
            await api('/api/ai/leads/' + leadId + '/analyze', { method: 'POST' });
            setCandidateImportStatus(candidate, 'imported', '取り込み・AI分析済み', leadId);
            analyzedCount += 1;
          } catch (error) {
            setCandidateImportStatus(candidate, 'imported', '取り込み済み / AI分析失敗: ' + error.message, leadId);
            analysisFailedCount += 1;
          }
          setStatus('bulkImportStatus', 'AI分析中 ' + (analyzedCount + analysisFailedCount) + '/' + importResults.length + (analysisFailedCount ? '（分析失敗 ' + analysisFailedCount + '件）' : ''), 'warn');
          renderCampfireCandidates();
        });
      }
      setStatus(
        'bulkImportStatus',
        '一括取り込み完了: 取込 ' + successCount + '件 / 取込失敗 ' + failedCount + '件 / AI分析 ' + analyzedCount + '件' + (analysisFailedCount ? ' / AI分析失敗 ' + analysisFailedCount + '件' : ''),
        failedCount || analysisFailedCount ? 'warn' : 'ok'
      );
      await loadAll();
      renderCampfireCandidates();
    }

    async function runWithConcurrency(items, concurrency, worker) {
      let nextIndex = 0;
      const safeConcurrency = Math.max(1, Math.min(concurrency, items.length));
      const runNext = async () => {
        const index = nextIndex;
        nextIndex += 1;
        if (index >= items.length) return;
        await worker(items[index], index);
        await runNext();
      };
      await Promise.all(Array.from({ length: safeConcurrency }, () => runNext()));
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
      if (!canGenerateMail()) {
        const message = state.selectedLeadId
          ? '既存メールがあります。履歴からメールを選択して状態に応じた操作をしてください。'
          : '先に営業対象一覧から対象を選択してください。';
        setStatus('mailStatus', message, 'warn');
        return;
      }
      setStatus('mailStatus', '無料メール生成中（OpenAI API未使用）', 'warn');
      try {
        const templateKey = document.getElementById('templateKey').value;
        const result = await api('/api/ai/leads/' + state.selectedLeadId + '/email-draft', {
          method: 'POST',
          body: JSON.stringify({ templateKey, tone: 'low_sales_pressure' })
        });
        state.selectedMailId = result.email.id;
        setStatus('mailStatus', '無料メール生成完了（OpenAI API未使用）', 'ok');
        await loadAll();
        await loadAiAnalysis();
        selectMail(state.selectedMailId);
        switchTab('mail');
      } catch (error) {
        setStatus('mailStatus', error.message, 'error');
      }
    }

    async function polishMail() {
      const mail = currentSelectedMail();
      if (!mail) return;
      if (!['draft', 'rejected'].includes(mail.status)) {
        setStatus('mailStatus', 'AIで整えられるのは下書きまたは棄却後のメールだけです。', 'warn');
        return;
      }
      const confirmed = window.confirm('OpenAI APIを使って本文を整えます。少額のAPI料金が発生します。実行しますか？');
      if (!confirmed) return;
      setStatus('mailStatus', 'AIで本文を整えています（OpenAI API使用）', 'warn');
      try {
        const result = await api('/api/ai/mails/' + mail.id + '/polish', { method: 'POST' });
        state.selectedMailId = result.email.id;
        setStatus('mailStatus', 'AI整形が完了しました。本文を確認してください。', 'ok');
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
        renderLeadDetail();
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

    async function markMailSent() {
      if (!state.selectedMailId) return;
      setStatus('mailStatus', '送信済みに更新中', 'warn');
      try {
        await api('/api/mails/' + state.selectedMailId + '/mark-sent', {
          method: 'POST',
          body: JSON.stringify({})
        });
        setStatus('mailStatus', '送信済みにしました', 'ok');
        await loadAll();
        selectMail(state.selectedMailId);
      } catch (error) {
        setStatus('mailStatus', error.message, 'error');
      }
    }

    async function recordReply() {
      if (!state.selectedMailId) return;
      const body = fieldValue('replyBody');
      if (!body) return setStatus('replyStatus', '返信内容を入力してください', 'warn');
      setStatus('replyStatus', '返信を記録中', 'warn');
      try {
        const result = await api('/api/mails/' + state.selectedMailId + '/replies', {
          method: 'POST',
          body: JSON.stringify({
            fromEmail: fieldValue('replyFromEmail') || undefined,
            body
          })
        });
        document.getElementById('replyBody').value = '';
        setStatus('replyStatus', '返信を記録しました: ' + labelReplyCategory(result.classification.category), 'ok');
        await loadAll();
        selectMail(state.selectedMailId);
      } catch (error) {
        setStatus('replyStatus', error.message, 'error');
      }
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
          '<td><button class="primary" onclick="selectLeadFromButton(event, \\'' + lead.id + '\\')">' + (lead.id === state.selectedLeadId ? '選択中' : '選択') + '</button></td>' +
        '</tr>';
      }).join('');
      document.getElementById('leadRows').innerHTML = rows || '<tr><td colspan="7" class="muted">まだリードがありません</td></tr>';
      const mailLeadCount = document.getElementById('mailLeadCount');
      if (mailLeadCount) mailLeadCount.textContent = leads.length + '件';
      document.getElementById('generateButton').disabled = !canGenerateMail();
      document.getElementById('analysisButton').disabled = !state.selectedLeadId;
      const selected = state.leads.find((lead) => lead.id === state.selectedLeadId);
      document.getElementById('selectedLead').textContent = selected ? (selected.company?.name || selected.id) : '未選択';
    }

    function renderMailLeadSummary() {
      const container = document.getElementById('mailLeadSummary');
      if (!container) return;
      const lead = state.leads.find((item) => item.id === state.selectedLeadId);
      if (!lead) {
        container.innerHTML = '<div class="muted">上の営業対象一覧から、メールを作成・確認する案件を選択してください。</div>';
        const next = document.getElementById('mailNextAction');
        if (next) next.textContent = '';
        return;
      }
      const company = lead.company || {};
      const project = lead.project || {};
      const mails = selectedLeadMails();
      const mail = mails[0];
      const next = document.getElementById('mailNextAction');
      if (next) next.textContent = mailNextActionText(lead, mail);
      container.innerHTML =
        '<div class="detail-grid">' +
          detailItem('企業名', company.name || lead.companyId) +
          detailItem('案件名', project.title || '未取得') +
          detailItem('状態', labelLeadStatus(lead.status)) +
          detailItem('メール履歴', mails.length + '件') +
          detailItem('最新メール', mail ? labelMailStatus(mail.status) : '未生成') +
          detailItem('支援額', formatCurrency(project.amount)) +
          detailItem('支援者数', formatNumber(project.supporterCount) + '人') +
          detailItem('連絡先', mailContactSummary(lead)) +
          detailItem('次にやること', mailNextActionText(lead, mail)) +
        '</div>' +
        rowBlock('URL', project.url ? renderLink(project.url) : '未取得', true) +
        renderPlaceholderAnalysis(latestProjectAnalysisOutput().mailPlaceholders) +
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
      const importableCount = visibleCandidates.filter(({ item }) => isCandidateImportable(item)).length;
      document.getElementById('bulkImportButton').disabled = !importableCount;
      document.getElementById('campfireCandidateCount').textContent =
        '表示 ' + visibleCandidates.length + '件 / 取得 ' + state.campfireCandidates.length + '件 / 取込可能 ' + importableCount + '件';
      if (!visibleCandidates.length) {
        container.innerHTML = '<div class="muted">表示条件に合う候補がありません。条件をゆるめてください。</div>';
        return;
      }
      const rows = visibleCandidates.map(({ item, originalIndex }) => {
        const projectUrl = escapeAttr(item.url);
        const importState = getCandidateImportState(item);
        const importDisabled = importState.status === 'existing' || importState.status === 'imported' || importState.status === 'importing';
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
          '<td>' +
            '<span class="badge ' + candidateImportBadgeClass(importState.status) + '">' + escapeHtml(labelCandidateImportStatus(importState.status)) + '</span>' +
            (importState.message ? '<div class="muted clip" title="' + escapeAttr(importState.message) + '">' + escapeHtml(importState.message) + '</div>' : '') +
          '</td>' +
          '<td class="center-cell"><a class="link-button" href="' + projectUrl + '" target="_blank" rel="noopener noreferrer">開く</a></td>' +
          '<td class="action-cell"><button class="primary" onclick="importCampfireCandidate(' + originalIndex + ')" ' + (importDisabled ? 'disabled' : '') + '>' + escapeHtml(candidateImportButtonLabel(importState.status)) + '</button></td>' +
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
                '<th style="width:130px">取込状態</th>' +
                '<th style="width:76px">URL</th>' +
                '<th style="width:104px">操作</th>' +
              '</tr>' +
            '</thead>' +
            '<tbody>' + rows + '</tbody>' +
          '</table>' +
        '</div>';
    }

    function syncCandidateImportStatuses() {
      state.campfireCandidates.forEach((candidate) => {
        const existing = findExistingLeadForCandidate(candidate);
        if (!existing) return;
        const key = candidateImportKey(candidate);
        const current = state.candidateImportStatus[key];
        if (!current || current.status === 'not_imported' || current.status === 'importing') {
          state.candidateImportStatus[key] = {
            status: current?.status === 'importing' ? 'imported' : 'existing',
            message: existing.company?.name ? existing.company.name + 'で登録済み' : '営業リストに登録済み',
            leadId: existing.id
          };
        }
      });
    }

    function setCandidateImportStatus(candidate, status, message = '', leadId = null) {
      const key = candidateImportKey(candidate);
      if (!key) return;
      state.candidateImportStatus[key] = { status, message, leadId };
    }

    function getCandidateImportState(candidate) {
      const key = candidateImportKey(candidate);
      const current = key ? state.candidateImportStatus[key] : null;
      if (current && (current.status === 'importing' || current.status === 'imported' || current.status === 'failed')) return current;
      const existing = findExistingLeadForCandidate(candidate);
      if (existing) {
        return {
          status: 'existing',
          message: existing.company?.name ? existing.company.name + 'で登録済み' : '営業リストに登録済み',
          leadId: existing.id
        };
      }
      return current || { status: 'not_imported', message: '', leadId: null };
    }

    function isCandidateImportable(candidate) {
      const status = getCandidateImportState(candidate).status;
      return status === 'not_imported' || status === 'failed';
    }

    function findExistingLeadForCandidate(candidate) {
      const candidateProjectId = campfireProjectId(candidate?.url);
      const candidateUrl = normalizeComparableUrl(candidate?.url);
      return state.leads.find((lead) => {
        const projectUrl = lead.project?.url;
        if (!projectUrl) return false;
        const leadProjectId = campfireProjectId(projectUrl);
        if (candidateProjectId && leadProjectId && candidateProjectId === leadProjectId) return true;
        return candidateUrl && normalizeComparableUrl(projectUrl) === candidateUrl;
      });
    }

    function candidateImportKey(candidate) {
      return campfireProjectId(candidate?.url) || normalizeComparableUrl(candidate?.url);
    }

    function campfireProjectId(value) {
      const match = String(value || '').match(/camp-fire\\.jp\\/projects\\/(\\d+)/);
      return match ? match[1] : '';
    }

    function normalizeComparableUrl(value) {
      if (!value) return '';
      try {
        const url = new URL(value);
        url.hash = '';
        url.search = '';
        return url.toString().replace(/\\/$/, '');
      } catch (_) {
        return String(value).split('#')[0].split('?')[0].replace(/\\/$/, '');
      }
    }

    function labelCandidateImportStatus(status) {
      const labels = {
        not_imported: '未取込',
        existing: '登録済み',
        importing: '取込中',
        imported: '取込済み',
        failed: '失敗'
      };
      return labels[status] || '未取込';
    }

    function candidateImportButtonLabel(status) {
      const labels = {
        existing: '登録済み',
        importing: '取込中',
        imported: '取込済み',
        failed: '再取込'
      };
      return labels[status] || '取り込む';
    }

    function candidateImportBadgeClass(status) {
      if (status === 'existing' || status === 'imported') return 'ok';
      if (status === 'importing') return 'warn';
      if (status === 'failed') return 'danger';
      return '';
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
      if (!container) return;
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
        (!isMailDraft ? renderPlaceholderAnalysis(output.mailPlaceholders) : '') +
        (!isMailDraft ? renderAnalysisCards(output) : '') +
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
      if (!container) return;
      if (!lead) {
        container.innerHTML = '<div class="muted">営業リストから案件を選択してください</div>';
        if (openButton) openButton.disabled = true;
        return;
      }

      const company = lead.company || {};
      const project = lead.project || {};
      if (openButton) openButton.disabled = !project.url;
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
          '<label>プロジェクトURL</label>' +
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

    function renderAnalysisCards(output) {
      return '<div class="info-columns">' +
        infoCard('商品の魅力', output.productStrengths) +
        infoCard('SNS訴求', output.snsIdeas) +
        infoCard('メール材料', output.mailAdvice) +
        infoCard('使う人', output.targetUsers) +
        infoCard('次に確認', output.nextChecks) +
        infoCard('不足情報', output.missingInfo) +
      '</div>';
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

    function infoCard(title, items) {
      const values = Array.isArray(items) ? items : [];
      return '<div class="info-card"><h3>' + escapeHtml(title) + '</h3>' +
        (values.length ? '<ul>' + values.map((item) => '<li>' + escapeHtml(item) + '</li>').join('') + '</ul>' : '<div class="muted">未生成</div>') +
      '</div>';
    }

    function renderLeadAlerts(lead) {
      const memo = lead.brandAnalysisMemo || '';
      if (!memo.includes('過去プロジェクト')) return '';
      return '<div class="notice"><strong>過去プロジェクト多数の可能性</strong>' + escapeHtml(memo) + '</div>';
    }

    function latestProjectAnalysisOutput() {
      const latest = state.aiGenerations.find((item) => item.type === 'project_summary');
      return latest?.outputJson || {};
    }

    function suggestedLeadMemos(lead) {
      const output = latestProjectAnalysisOutput();
      if (!Object.keys(output).length) {
        return { contactMemo: '', brandAnalysisMemo: '', snsAnalysisMemo: '' };
      }
      const placeholders = output.mailPlaceholders || {};
      return {
        contactMemo: [
          output.readiness?.label ? '判断: ' + output.readiness.label + (typeof output.readiness.score === 'number' ? ' / ' + output.readiness.score + '点' : '') : '',
          memoList('次に確認', output.nextChecks)
        ].filter(Boolean).join('\\n\\n'),
        brandAnalysisMemo: [
          output.summary,
          memoList('商品の魅力・強み', output.productStrengths),
          placeholders.appeal ? 'メールで触れる魅力: ' + placeholders.appeal : '',
          placeholders.targetUser ? '想定する相手: ' + placeholders.targetUser : '',
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

    function renderLeadManagementForm(lead) {
      const memo = suggestedLeadMemos(lead);
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
          '<textarea id="leadContactMemo" style="min-height:80px">' + escapeHtml(lead.contactMemo || memo.contactMemo || '') + '</textarea>' +
        '</div>' +
        '<div class="row">' +
          '<label for="leadBrandAnalysisMemo">ブランド分析メモ</label>' +
          '<textarea id="leadBrandAnalysisMemo" style="min-height:100px">' + escapeHtml(lead.brandAnalysisMemo || memo.brandAnalysisMemo || '') + '</textarea>' +
        '</div>' +
        '<div class="row">' +
          '<label for="leadSnsAnalysisMemo">SNS分析メモ</label>' +
          '<textarea id="leadSnsAnalysisMemo" style="min-height:100px">' + escapeHtml(lead.snsAnalysisMemo || memo.snsAnalysisMemo || '') + '</textarea>' +
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
        renderMailStageCards(null);
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
      document.getElementById('mailRows').innerHTML = rows || '<tr><td colspan="3" class="muted">この対象のメール作成履歴は0件です。メール生成で新規作成できます。</td></tr>';
      const selected = mails.find((mail) => mail.id === state.selectedMailId);
      document.getElementById('selectedMail').textContent = selected ? labelMailStatus(selected.status) : '未選択';
      populateMailEditor(selected);
      renderRejectReason(selected);
      updateMailButtons(selected);
      renderMailStageCards(selected);
    }

    function mailContactSummary(lead) {
      if (lead.contactEmail) return 'メール';
      if (lead.contactFormUrl) return 'フォーム';
      if (lead.siteMessageUrl) return 'サイト内';
      return '未確認';
    }

    function selectedLeadMails() {
      if (!state.selectedLeadId) return [];
      const lead = state.leads.find((item) => item.id === state.selectedLeadId);
      return state.mails
        .filter((mail) => {
          if (sameId(mail.leadId, state.selectedLeadId) || sameId(mail.lead?.id, state.selectedLeadId)) return true;
          if (lead && sameId(mail.companyId, lead.companyId)) return true;
          if (lead && sameId(mail.company?.id, lead.companyId)) return true;
          return false;
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    function sameId(left, right) {
      return String(left || '').trim().toLowerCase() === String(right || '').trim().toLowerCase();
    }

    function canGenerateMail() {
      return Boolean(state.selectedLeadId && selectedLeadMails().length === 0);
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

    function currentSelectedMail() {
      if (!state.selectedMailId) return null;
      return selectedLeadMails().find((mail) => mail.id === state.selectedMailId) || state.mails.find((mail) => mail.id === state.selectedMailId) || null;
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
      renderMailStageCards(currentSelectedMail());
    }

    function sortedChecklistItems() {
      return state.checklist
        .map((item, index) => ({ ...item, index }))
        .sort((a, b) => Number(b.checked) - Number(a.checked) || a.index - b.index);
    }

    function selectLeadFromButton(event, id) {
      event.stopPropagation();
      selectLead(id);
    }

    function selectLead(id) {
      state.selectedLeadId = id;
      persistSelectedLead(id);
      state.aiGenerations = [];
      state.checklist = [];
      state.checklistComplete = false;
      const latestMail = ensureSelectedMailForLead();
      renderLeads();
      renderSelectedMailWorkspace();
      if (latestMail) {
        selectMail(latestMail.id);
      } else {
        clearMailEditor();
        renderMails();
      }
      renderSelectedMailWorkspace();
      renderLeadDetail();
      renderAiAnalysis();
      void loadAiAnalysis();
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

    function renderSelectedMailWorkspace() {
      renderMailLeadSummary();
      renderMails();
      const lead = state.leads.find((item) => item.id === state.selectedLeadId);
      const mail = currentSelectedMail();
      const selectedLead = document.getElementById('selectedLead');
      const selectedMail = document.getElementById('selectedMail');
      if (selectedLead) selectedLead.textContent = lead ? (lead.company?.name || lead.companyId || lead.id) : '未選択';
      if (selectedMail) selectedMail.textContent = mail ? labelMailStatus(mail.status) : '未選択';
      const generateHelp = document.getElementById('generateHelp');
      if (generateHelp && lead) {
        const count = selectedLeadMails().length;
        generateHelp.textContent = count ? 'メール履歴 ' + count + '件。下の履歴から選択してください' : 'メール履歴0件。新規メールを生成できます';
      }
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
      const payload = {
        contactEmail: fieldValue('leadContactEmail'),
        contactFormUrl: fieldValue('leadContactFormUrl'),
        siteMessageUrl: fieldValue('leadSiteMessageUrl'),
        contactMemo: fieldValue('leadContactMemo'),
        sendMethod: fieldValue('leadSendMethod'),
        sentAt: dateTimeValue('leadSentAt') || undefined,
        nextFollowUpAt: dateTimeValue('leadNextFollowUpAt') || undefined,
        nextActionAt: dateTimeValue('leadNextFollowUpAt') || undefined,
        brandWebsiteUrl: fieldValue('leadBrandWebsiteUrl'),
        instagramUrl: fieldValue('leadInstagramUrl'),
        tiktokUrl: fieldValue('leadTiktokUrl'),
        xUrl: fieldValue('leadXUrl'),
        brandAnalysisMemo: fieldValue('leadBrandAnalysisMemo'),
        snsAnalysisMemo: fieldValue('leadSnsAnalysisMemo')
      };
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
      const generateButton = document.getElementById('generateButton');
      const generateHelp = document.getElementById('generateHelp');
      const hasLead = Boolean(state.selectedLeadId);
      const hasExistingMails = selectedLeadMails().length > 0;
      generateButton.disabled = !canGenerateMail();
      generateButton.title = !hasLead
        ? '先に営業対象一覧から対象を選択してください'
        : hasExistingMails
          ? '既存メールがあります。履歴から選択して編集・レビューしてください'
          : 'この対象の新規メールを生成できます';
      if (generateHelp) {
        generateHelp.textContent = !hasLead
          ? '先に上の一覧から対象を選択'
          : hasExistingMails
            ? '既存メールがあります。履歴から選択してください'
            : 'メール未生成です。ここから新規作成できます';
      }
      document.getElementById('saveButton').disabled = !mail;
      document.getElementById('polishButton').disabled = !mail || !['draft', 'rejected'].includes(mail.status);
      document.getElementById('polishButton').title = !mail
        ? '先にメールを選択してください'
        : ['draft', 'rejected'].includes(mail.status)
          ? 'OpenAI APIを使って本文を整えます'
          : '承認・送信フロー中のメールはAI整形できません';
      document.getElementById('reviewButton').disabled = !mail || mail.status !== 'draft';
      document.getElementById('reReviewButton').disabled = !mail || mail.status !== 'rejected';
      document.getElementById('rejectButton').disabled = !mail || !['in_review', 'approved'].includes(mail.status);
      document.getElementById('approveButton').disabled = !mail || mail.status !== 'in_review' || !state.checklistComplete;
      document.getElementById('queueButton').disabled = !mail || mail.status !== 'approved' || !state.checklistComplete;
      document.getElementById('markSentButton').disabled = !mail || !['approved', 'queued'].includes(mail.status);
      document.getElementById('replyButton').disabled = !mail || !['queued', 'sent'].includes(mail.status);
      const guide = document.getElementById('mailActionGuide');
      if (guide) guide.textContent = mailActionGuideText(mail);
    }

    function renderMailStageCards(mail) {
      const container = document.getElementById('mailStageCards');
      if (!container) return;
      const lead = state.leads.find((item) => item.id === state.selectedLeadId);
      const checklistText = state.checklist.length
        ? state.checklist.filter((item) => item.checked).length + ' / ' + state.checklist.length
        : '未読み込み';
      container.innerHTML =
        stageCard('対象', lead ? (lead.company?.name || '選択済み') : '未選択') +
        stageCard('メール', mail ? labelMailStatus(mail.status) : '未生成') +
        stageCard('チェック', mail ? checklistText : '未選択') +
        stageCard('次操作', mailActionGuideText(mail));
    }

    function stageCard(label, value) {
      return '<div class="next-action-card"><strong>' + escapeHtml(label) + '</strong><span class="muted">' + escapeHtml(value || '-') + '</span></div>';
    }

    function mailNextActionText(lead, mail) {
      if (!lead) return '対象を選択してください';
      if (!mail) return 'メール未生成。新規メール生成へ';
      return mailActionGuideText(mail);
    }

    function mailActionGuideText(mail) {
      if (!mail) return state.selectedLeadId ? '新規メール生成' : '対象選択';
      if (mail.status === 'draft') return '本文を確認して保存後、レビュー依頼';
      if (mail.status === 'in_review') return state.checklistComplete ? '内容確認後、承認または棄却' : '送信前チェックを完了して承認';
      if (mail.status === 'rejected') return '棄却理由を直して再レビュー依頼';
      if (mail.status === 'approved') return 'キュー投入、または手動送信後に送信済み';
      if (mail.status === 'queued') return '送信待ち。送信したら送信済みに更新';
      if (mail.status === 'sent') return '返信が来たら返信メモへ記録';
      if (mail.status === 'failed') return '失敗理由を確認して再試行';
      return '状態を確認';
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

    function labelReplyCategory(category) {
      return ({
        interested: '興味あり',
        need_info: '資料・詳細希望',
        meeting_request: '商談希望',
        not_interested: '見送り',
        unsubscribe: '配信停止',
        auto_reply: '自動返信',
        complaint: 'クレーム',
        unknown: '要確認'
      })[category] || category || '要確認';
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

    function rowBlock(label, value, html = false) {
      return '<div class="row"><label>' + escapeHtml(label) + '</label><div class="detail-text">' + (html ? value : escapeHtml(value || '未取得')) + '</div></div>';
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
