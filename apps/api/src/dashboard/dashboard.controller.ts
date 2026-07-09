import { Controller, Get, Header } from '@nestjs/common';

@Controller()
export class DashboardController {
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
      gap: 16px;
      padding: 16px;
      min-height: calc(100vh - 58px);
    }
    .workflow {
      grid-column: 1 / -1;
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 10px;
      background: transparent;
      border: 0;
    }
    .workflow-step {
      border: 1px solid var(--line);
      background: var(--panel);
      border-radius: 8px;
      padding: 12px;
      min-width: 0;
    }
    .workflow-step strong {
      display: block;
      font-size: 13px;
      margin-bottom: 4px;
    }
    .workflow-step span {
      display: block;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.5;
    }
    .step-label {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      border-radius: 999px;
      background: #e7f2f0;
      color: var(--accent);
      font-weight: 700;
      margin-right: 6px;
    }
    section {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      min-width: 0;
    }
    .left, .right { display: grid; gap: 16px; align-content: start; }
    .section-head {
      padding: 14px 16px;
      border-bottom: 1px solid var(--line);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    h2 { font-size: 15px; margin: 0; }
    .body { padding: 16px; }
    .row { display: grid; gap: 8px; margin-bottom: 12px; }
    label { color: var(--muted); font-size: 12px; }
    input, select, textarea {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 6px;
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
      padding: 10px 12px;
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
      padding: 10px 12px;
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
      border-radius: 999px;
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
    .search-panel {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      margin-top: 14px;
    }
    .search-panel .toolbar { grid-column: 1 / -1; }
    .candidate-list {
      display: grid;
      gap: 10px;
    }
    .candidate-item {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 14px;
      align-items: center;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 12px;
      background: #fbfcfd;
    }
    .candidate-title {
      font-weight: 700;
      line-height: 1.5;
      margin-bottom: 4px;
      overflow-wrap: anywhere;
    }
    .candidate-url {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.5;
      overflow-wrap: anywhere;
    }
    .candidate-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 8px;
    }
    .candidate-meta span {
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 3px 8px;
      background: white;
      color: #34424d;
      font-size: 12px;
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
<body>
  <header>
    <h1>Sales AI System</h1>
    <div class="toolbar">
      <span id="apiStatus" class="status muted">API確認中</span>
      <button onclick="loadAll()">更新</button>
    </div>
  </header>
  <main>
    <section class="workflow" aria-label="業務ステップ">
      <div class="workflow-step">
        <strong><span class="step-label">1</span>取り込む</strong>
        <span>CAMPFIRE URLを入れて案件を登録</span>
      </div>
      <div class="workflow-step">
        <strong><span class="step-label">2</span>選ぶ</strong>
        <span>営業リストから優先案件を選択</span>
      </div>
      <div class="workflow-step">
        <strong><span class="step-label">3</span>見る</strong>
        <span>商品・実行者・支援状況を確認</span>
      </div>
      <div class="workflow-step">
        <strong><span class="step-label">4</span>作る</strong>
        <span>AI分析を見てメール下書きを生成</span>
      </div>
      <div class="workflow-step">
        <strong><span class="step-label">5</span>確認する</strong>
        <span>本文チェック、レビュー、承認、キュー投入</span>
      </div>
    </section>

    <div class="left">
      <section>
        <div class="section-head">
          <h2>1. CAMPFIRE取り込み</h2>
        </div>
        <div class="body">
          <div class="row">
            <label for="campfireUrl">プロジェクトURL</label>
            <input id="campfireUrl" placeholder="https://camp-fire.jp/projects/.../view" />
          </div>
          <div class="toolbar">
            <button class="primary" onclick="importCampfire()">取り込む</button>
            <span id="importStatus" class="status"></span>
          </div>
          <div class="row" style="margin-top:16px">
            <label>CAMPFIRE候補検索</label>
            <div class="search-panel">
              <input id="campfireSearchKeyword" placeholder="キーワード・商品名" />
              <select id="campfireSearchCategory">
                <option value="">カテゴリを取得中</option>
              </select>
              <select id="campfireAmountRange">
                <option value="">支援額 すべて</option>
                <option value="0:500000">50万円未満</option>
                <option value="500000:1000000">50万〜100万円</option>
                <option value="1000000:3000000">100万〜300万円</option>
                <option value="3000000:5000000">300万〜500万円</option>
                <option value="5000000:10000000">500万〜1,000万円</option>
                <option value="10000000:">1,000万円以上</option>
              </select>
              <select id="campfireSupporterRange">
                <option value="">サポーター すべて</option>
                <option value="0:30">30人未満</option>
                <option value="30:50">30〜50人</option>
                <option value="50:100">50〜100人</option>
                <option value="100:300">100〜300人</option>
                <option value="300:500">300〜500人</option>
                <option value="500:">500人以上</option>
              </select>
              <select id="campfireProfileProjectRange">
                <option value="">過去プロジェクト すべて</option>
                <option value="0:0">初回のみ</option>
                <option value="1:3">1〜3件</option>
                <option value="4:9">4〜9件</option>
                <option value="10:29">10〜29件</option>
                <option value="30:99">30〜99件</option>
                <option value="100:">100件以上</option>
              </select>
              <select id="campfireResultLimit">
                <option value="10">最大表示 10件</option>
                <option value="50">最大表示 50件</option>
                <option value="100">最大表示 100件</option>
              </select>
              <div class="toolbar">
                <select id="campfireSearchStatus">
                  <option value="">すべて</option>
                  <option value="active">現在公開中</option>
                  <option value="endingSoon">終了間近</option>
                </select>
                <button class="primary" onclick="searchCampfireCandidates()">候補を検索</button>
                <button onclick="clearCampfireSearch()">クリア</button>
                <span id="campfireSearchStatusText" class="status"></span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div class="section-head">
          <h2>2. 営業リスト</h2>
          <div class="toolbar">
            <select id="templateKey">
              <option value="normal">通常版</option>
              <option value="sns_video_ad">SNS動画・広告版</option>
            </select>
            <button class="primary" id="generateButton" onclick="generateMail()" disabled>メール生成</button>
          </div>
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
          <h2>CAMPFIRE検索結果</h2>
          <span id="campfireCandidateCount" class="status muted">未検索</span>
        </div>
        <div class="body" id="campfireCandidates">
          <div class="muted">左の条件で候補URLを検索すると、ここに表示されます。</div>
        </div>
      </section>

      <div class="tabs" aria-label="機能タブ">
        <button class="tab-button" data-tab-button="detail" data-active="true" onclick="switchTab('detail')">案件詳細</button>
        <button class="tab-button" data-tab-button="ai" onclick="switchTab('ai')">AI分析</button>
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
          <h2>4. AI分析結果</h2>
        </div>
        <div class="body" id="aiAnalysis">
          <div class="muted">営業リストから案件を選択してください</div>
        </div>
      </section>

      <section class="tab-panel" data-tab-panel="mail">
        <div class="section-head">
          <h2>5. メール確認・承認</h2>
          <div class="toolbar">
            <button onclick="requestReview()" id="reviewButton" disabled>レビュー依頼</button>
            <button onclick="requestReReview()" id="reReviewButton" disabled>再レビュー依頼</button>
            <button onclick="rejectMail()" id="rejectButton" disabled>棄却</button>
            <button onclick="approveMail()" id="approveButton" disabled>承認</button>
            <button onclick="queueMail()" id="queueButton" disabled>キュー投入</button>
          </div>
        </div>
        <div class="body split">
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
            <div class="row">
              <label>送信前チェック</label>
              <ul class="checklist" id="checklistRows">
                <li class="muted">メールを選択してください</li>
              </ul>
              <div id="checklistStatus" class="status muted" style="margin-top:8px"></div>
            </div>
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
            <table>
              <thead>
                <tr>
                  <th>最新メール</th>
                  <th style="width:92px">状態</th>
                  <th style="width:120px">作成日</th>
                </tr>
              </thead>
              <tbody id="mailRows"></tbody>
            </table>
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
          api('/api/leads?limit=50'),
          api('/api/mails?limit=50')
        ]);
        state.leads = leads.items || [];
        state.mails = mails.items || [];
        renderLeads();
        renderMails();
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
        setStatus('importStatus', '取り込み完了', 'ok');
        await loadAll();
      } catch (error) {
        setStatus('importStatus', error.message, 'error');
      }
    }

    async function searchCampfireCandidates() {
      const hasProfileProjectFilter = Boolean(fieldValue('campfireProfileProjectRange'));
      setStatus('campfireSearchStatusText', hasProfileProjectFilter ? '検索中（過去件数確認あり）' : '検索中', 'warn');
      document.getElementById('campfireCandidateCount').textContent = '検索中';
      try {
        const amountRange = rangeFieldValue('campfireAmountRange');
        const supporterRange = rangeFieldValue('campfireSupporterRange');
        const profileProjectRange = rangeFieldValue('campfireProfileProjectRange');
        const resultLimit = numberFieldValue('campfireResultLimit');
        const result = await api('/api/projects/search/campfire', {
          method: 'POST',
          body: JSON.stringify(compactPayload({
            keyword: fieldValue('campfireSearchKeyword'),
            category: fieldValue('campfireSearchCategory'),
            amountMin: amountRange.min,
            amountMax: amountRange.max,
            supporterMin: supporterRange.min,
            supporterMax: supporterRange.max,
            profileProjectMin: profileProjectRange.min,
            profileProjectMax: profileProjectRange.max,
            limit: resultLimit,
            status: fieldValue('campfireSearchStatus')
          }))
        });
        state.campfireCandidates = result.items || [];
        renderCampfireCandidates();
        const countText = '取得 ' + state.campfireCandidates.length + '件 / 最大 ' + resultLimit + '件';
        setStatus('campfireSearchStatusText', countText, 'ok');
        document.getElementById('campfireCandidateCount').textContent = countText;
      } catch (error) {
        setStatus('campfireSearchStatusText', error.message, 'error');
        document.getElementById('campfireCandidateCount').textContent = '検索失敗';
      }
    }

    function clearCampfireSearch() {
      ['campfireSearchKeyword', 'campfireSearchCategory', 'campfireAmountRange', 'campfireSupporterRange', 'campfireProfileProjectRange'].forEach((id) => {
        document.getElementById(id).value = '';
      });
      document.getElementById('campfireResultLimit').value = '10';
      document.getElementById('campfireSearchStatus').value = '';
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
      const rows = state.leads.map((lead) => {
        const company = lead.company?.name || lead.companyId;
        const project = lead.project?.title || '案件名なし';
        return '<tr data-selected="' + (lead.id === state.selectedLeadId) + '" onclick="selectLead(\\'' + lead.id + '\\')">' +
          '<td><div class="clip">' + escapeHtml(company) + '</div></td>' +
          '<td><div class="clip">' + escapeHtml(project) + '</div><div class="muted clip">' + escapeHtml(lead.reason || '') + '</div></td>' +
          '<td><span class="badge">' + escapeHtml(labelLeadStatus(lead.status)) + '</span></td>' +
          '<td>' + Number(lead.score || 0) + '</td>' +
          '<td>' + escapeHtml(labelPriority(lead.priority)) + '</td>' +
        '</tr>';
      }).join('');
      document.getElementById('leadRows').innerHTML = rows || '<tr><td colspan="5" class="muted">まだリードがありません</td></tr>';
      document.getElementById('generateButton').disabled = !state.selectedLeadId;
      const selected = state.leads.find((lead) => lead.id === state.selectedLeadId);
      document.getElementById('selectedLead').textContent = selected ? (selected.company?.name || selected.id) : '未選択';
    }

    function renderCampfireCandidates() {
      const container = document.getElementById('campfireCandidates');
      if (!state.campfireCandidates.length) {
        container.innerHTML = '<div class="muted">左の条件で候補URLを検索すると、ここに表示されます。</div>';
        return;
      }
      const items = state.campfireCandidates.map((item, index) => {
        return '<div class="candidate-item">' +
          '<div>' +
            '<div class="candidate-title">' + escapeHtml(item.title) + '</div>' +
            '<div class="candidate-url">' + escapeHtml(item.url) + '</div>' +
            '<div class="candidate-meta">' +
              '<span>支援額 ' + formatCurrency(item.amount) + '</span>' +
              '<span>支援者 ' + formatNumber(item.supporterCount) + '人</span>' +
              '<span>残り ' + (item.daysLeft === null ? '-' : escapeHtml(item.daysLeft + '日')) + '</span>' +
              '<span>過去 ' + (item.profileProjectCount === null ? '-' : escapeHtml(item.profileProjectCount + '件')) + '</span>' +
            '</div>' +
          '</div>' +
          '<button class="primary" onclick="importCampfireCandidate(' + index + ')">取り込む</button>' +
        '</div>';
      }).join('');
      container.innerHTML = '<div class="candidate-list">' + items + '</div>';
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
      container.innerHTML =
        '<div class="detail-grid">' +
          detailItem('種別', latest.type) +
          detailItem('モデル', latest.model) +
          detailItem('生成日時', formatDate(latest.createdAt)) +
          detailItem('トークン', formatTokenUsage(latest)) +
        '</div>' +
        renderListSection('使用した事実', output.factsUsed) +
        renderListSection('AIの推測', output.assumptions) +
        renderListSection('注意点', output.riskFlags) +
        '<div class="row">' +
          '<label>生成件名</label>' +
          '<div class="detail-value">' + escapeHtml(output.subject || latest.email?.subject || '未生成') + '</div>' +
        '</div>' +
        '<div class="row">' +
          '<label>生成本文</label>' +
          '<div class="detail-text">' + escapeHtml(truncateText(output.body || '', 900) || '未生成') + '</div>' +
        '</div>' +
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
      const rows = state.mails.map((mail) => {
        return '<tr data-selected="' + (mail.id === state.selectedMailId) + '" onclick="selectMail(\\'' + mail.id + '\\')">' +
          '<td><div class="clip">' + escapeHtml(mail.subject) + '</div><div class="muted clip">' + escapeHtml(mail.company?.name || '') + '</div></td>' +
          '<td><span class="badge">' + escapeHtml(labelMailStatus(mail.status)) + '</span></td>' +
          '<td>' + formatDate(mail.createdAt) + '</td>' +
        '</tr>';
      }).join('');
      document.getElementById('mailRows').innerHTML = rows || '<tr><td colspan="3" class="muted">まだメールがありません</td></tr>';
      const selected = state.mails.find((mail) => mail.id === state.selectedMailId);
      document.getElementById('selectedMail').textContent = selected ? labelMailStatus(selected.status) : '未選択';
      renderRejectReason(selected);
      updateMailButtons(selected);
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
      renderLeads();
      renderLeadDetail();
      renderAiAnalysis();
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
      const mail = state.mails.find((item) => item.id === id);
      if (!mail) return;
      document.getElementById('subject').value = mail.subject || '';
      document.getElementById('body').value = mail.body || '';
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
        const title = formatDate(item.createdAt) + ' / ' + item.type + ' / ' + item.model;
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
