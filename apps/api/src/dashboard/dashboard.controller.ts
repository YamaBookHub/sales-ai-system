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
      grid-template-columns: 380px minmax(0, 1fr);
      gap: 16px;
      padding: 16px;
      min-height: calc(100vh - 58px);
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
      gap: 8px;
      padding: 0;
      margin: 0;
      list-style: none;
    }
    .checklist label {
      display: grid;
      grid-template-columns: 18px 1fr;
      gap: 8px;
      align-items: start;
      color: var(--text);
      font-size: 13px;
    }
    .checklist input { width: 16px; margin-top: 2px; }
    .split {
      display: grid;
      grid-template-columns: minmax(0, .95fr) minmax(0, 1.05fr);
      gap: 16px;
    }
    @media (max-width: 980px) {
      main, .split, .grid-2 { grid-template-columns: 1fr; }
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
    <div class="left">
      <section>
        <div class="section-head">
          <h2>CAMPFIRE取り込み</h2>
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
        </div>
      </section>

      <section>
        <div class="section-head">
          <h2>送信前チェック</h2>
        </div>
        <div class="body">
          <ul class="checklist" id="checklistRows">
            <li class="muted">メールを選択してください</li>
          </ul>
          <div id="checklistStatus" class="status muted" style="margin-top:12px"></div>
        </div>
      </section>
    </div>

    <div class="right">
      <section>
        <div class="section-head">
          <h2>営業リスト</h2>
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
                <th style="width:80px">点数</th>
                <th style="width:90px">優先度</th>
              </tr>
            </thead>
            <tbody id="leadRows"></tbody>
          </table>
        </div>
      </section>

      <section>
        <div class="section-head">
          <h2>メール確認</h2>
          <div class="toolbar">
            <button onclick="requestReview()" id="reviewButton" disabled>レビュー依頼</button>
            <button onclick="rejectMail()" id="rejectButton" disabled>棄却</button>
            <button onclick="approveMail()" id="approveButton" disabled>承認</button>
            <button onclick="queueMail()" id="queueButton" disabled>キュー投入</button>
          </div>
        </div>
        <div class="body split">
          <div>
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
    const state = { leads: [], mails: [], checklist: [], checklistComplete: false, selectedLeadId: null, selectedMailId: null };

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
        setStatus('apiStatus', 'API接続OK', 'ok');
      } catch (error) {
        setStatus('apiStatus', error.message, 'error');
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
        selectMail(state.selectedMailId);
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
          '<td><span class="badge">' + escapeHtml(lead.status) + '</span></td>' +
          '<td>' + Number(lead.score || 0) + '</td>' +
          '<td>' + escapeHtml(lead.priority) + '</td>' +
        '</tr>';
      }).join('');
      document.getElementById('leadRows').innerHTML = rows || '<tr><td colspan="5" class="muted">まだリードがありません</td></tr>';
      document.getElementById('generateButton').disabled = !state.selectedLeadId;
      const selected = state.leads.find((lead) => lead.id === state.selectedLeadId);
      document.getElementById('selectedLead').textContent = selected ? (selected.company?.name || selected.id) : '未選択';
    }

    function renderMails() {
      const rows = state.mails.map((mail) => {
        return '<tr data-selected="' + (mail.id === state.selectedMailId) + '" onclick="selectMail(\\'' + mail.id + '\\')">' +
          '<td><div class="clip">' + escapeHtml(mail.subject) + '</div><div class="muted clip">' + escapeHtml(mail.company?.name || '') + '</div></td>' +
          '<td><span class="badge">' + escapeHtml(mail.status) + '</span></td>' +
          '<td>' + formatDate(mail.createdAt) + '</td>' +
        '</tr>';
      }).join('');
      document.getElementById('mailRows').innerHTML = rows || '<tr><td colspan="3" class="muted">まだメールがありません</td></tr>';
      const selected = state.mails.find((mail) => mail.id === state.selectedMailId);
      document.getElementById('selectedMail').textContent = selected ? selected.status : '未選択';
      updateMailButtons(selected);
    }

    function renderChecklist() {
      const container = document.getElementById('checklistRows');
      if (!state.selectedMailId) {
        container.innerHTML = '<li class="muted">メールを選択してください</li>';
        setStatus('checklistStatus', '', '');
        return;
      }
      const rows = state.checklist.map((item) => {
        return '<li><label><input type="checkbox" data-key="' + escapeHtml(item.key) + '" ' + (item.checked ? 'checked' : '') + ' onchange="toggleChecklist(\\'' + item.key + '\\', this.checked)" />' + escapeHtml(item.label) + '</label></li>';
      }).join('');
      container.innerHTML = rows || '<li class="muted">チェック項目を読み込み中</li>';
      const checkedCount = state.checklist.filter((item) => item.checked).length;
      const totalCount = state.checklist.length;
      const message = totalCount ? checkedCount + ' / ' + totalCount + ' 完了' : '';
      setStatus('checklistStatus', message, state.checklistComplete ? 'ok' : 'warn');
    }

    function selectLead(id) {
      state.selectedLeadId = id;
      renderLeads();
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
      document.getElementById('rejectButton').disabled = !mail || !['draft', 'in_review', 'approved'].includes(mail.status);
      document.getElementById('approveButton').disabled = !mail || mail.status !== 'in_review' || !state.checklistComplete;
      document.getElementById('queueButton').disabled = !mail || mail.status !== 'approved' || !state.checklistComplete;
    }

    function formatDate(value) {
      if (!value) return '';
      return new Date(value).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
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
}
