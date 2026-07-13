import { renderSharedStyles } from './shared-styles';
import { renderClientViewRulesScript } from '../client/view-rules';
import { renderClientApiScript } from '../client/api-client';

export function renderLeadsPageDocument(clientScript: string): string {
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>営業案件詳細</title>
  ${renderSharedStyles('leads')}
</head>
<body data-ui-page="leads">
  <header>
    <h1>営業案件詳細</h1>
    <div class="toolbar">
      <span id="pageStatus" class="status ui-state-loading" aria-live="polite">読み込み中</span>
      <div class="top-nav" data-ui="top-nav">
        <button onclick="location.href='/today'">今日の営業 <span class="nav-badge" data-nav-badge="today" hidden></span></button>
        <button onclick="location.href='/replies'">返信</button>
        <button class="primary" onclick="location.href='/leads-view'">営業案件 <span class="nav-badge" data-nav-badge="leads" hidden></span></button>
        <button onclick="location.href='/mail-workspace'">作成・レビュー <span class="nav-badge" data-nav-badge="mail" hidden></span></button>
        <button onclick="location.href='/'">候補を探す</button>
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
        <div id="leadPagination" class="list-pagination" aria-label="営業案件のページ"></div>
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
          <div id="leadTaskWorkspace" class="task-workspace" data-ui="lead-task-workspace">
            <div class="ui-state-empty">案件を選択すると次回対応を管理できます</div>
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
  <script>\n${renderClientViewRulesScript()}\n${renderClientApiScript()}\n${clientScript}\n  </script>
</body>
</html>`;
}
