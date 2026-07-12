export function renderMailLeadQueue(): string {
  return `<section class="mail-lead-filter">
        <details class="mail-filter-drawer">
          <summary>
            <span>対象検索</span>
            <span class="muted"><span class="when-closed">開く</span><span class="when-open">閉じる</span></span>
          </summary>
          <div class="body">
            <div class="mail-filter-row">
              <input id="mailLeadKeyword" placeholder="会社・案件・理由で検索" oninput="renderLeads()" />
              <select id="mailLeadSourceFilter" onchange="renderLeads()">
                <option value="">取得元 すべて</option>
              </select>
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

      <section data-ui="mail-lead-queue">
        <div class="section-head">
          <h2>営業対象一覧</h2>
          <span id="mailLeadCount" class="status muted">0件</span>
        </div>
        <div class="body table-scroll lead-list-scroll" style="padding:0">
          <table>
            <thead>
              <tr>
                <th class="sortable" onclick="toggleDashboardSort('lead','company')" style="width:22%">会社<span id="leadSort-company" class="sort-mark"></span></th>
                <th class="sortable" onclick="toggleDashboardSort('lead','project')">案件<span id="leadSort-project" class="sort-mark"></span></th>
                <th class="sortable" onclick="toggleDashboardSort('lead','source')" style="width:92px">取得元<span id="leadSort-source" class="sort-mark"></span></th>
                <th class="sortable" onclick="toggleDashboardSort('lead','status')" style="width:90px">状態<span id="leadSort-status" class="sort-mark"></span></th>
                <th class="sortable" onclick="toggleDashboardSort('lead','score')" style="width:76px">点数<span id="leadSort-score" class="sort-mark"></span></th>
                <th class="sortable" onclick="toggleDashboardSort('lead','priority')" style="width:76px">優先度<span id="leadSort-priority" class="sort-mark"></span></th>
                <th style="width:76px">URL</th>
                <th style="width:90px">選択</th>
              </tr>
            </thead>
            <tbody id="leadRows"></tbody>
          </table>
        </div>
      </section>`;
}

export function renderMailWorkspace(): string {
  return `<div class="tabs" aria-label="機能タブ">
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
          <div class="muted">営業案件から案件を選択してください</div>
        </div>
      </section>

      <section class="tab-panel" data-tab-panel="ai">
        <div class="section-head">
          <h2>4. AI分析</h2>
          <div class="toolbar">
            <button onclick="analyzeLead()" id="analysisButton" disabled>AI分析を再実行</button>
          </div>
        </div>
        <div class="body" id="aiAnalysis">
          <div class="muted">営業案件から案件を選択してください</div>
        </div>
      </section>

      <section class="tab-panel" data-tab-panel="mail" data-ui="mail-focus-workspace">
        <div class="section-head">
          <h2>作成・レビュー・確認</h2>
          <div class="toolbar">
            <span id="mailStatus" class="status"></span>
            <button id="nextLeadButton" type="button" onclick="selectNextLead()" disabled>次の案件へ</button>
          </div>
        </div>
        <div class="body mail-flow">
          <div class="mail-context-bar" id="mailContextBar" data-ui="mail-context-bar">
            <div class="mail-context-item"><span class="mail-context-label">会社</span><strong class="mail-context-value">未選択</strong></div>
            <div class="mail-context-item"><span class="mail-context-label">メール状態</span><strong class="mail-context-value">未生成</strong></div>
            <div class="mail-context-item"><span class="mail-context-label">チェック</span><strong class="mail-context-value">未選択</strong></div>
            <div class="mail-context-item"><span class="mail-context-label">次操作</span><strong class="mail-context-value">対象を選択してください</strong></div>
          </div>

          <div class="mail-work-tab-list" role="tablist" aria-label="メール作業">
            <button class="mail-work-tab" type="button" role="tab" data-mail-work-tab="overview" data-active="true" aria-selected="true" onclick="switchMailWorkTab('overview')">概要</button>
            <button class="mail-work-tab" type="button" role="tab" data-mail-work-tab="draft" data-active="false" aria-selected="false" tabindex="-1" onclick="switchMailWorkTab('draft')">下書き</button>
            <button class="mail-work-tab" type="button" role="tab" data-mail-work-tab="review" data-active="false" aria-selected="false" tabindex="-1" onclick="switchMailWorkTab('review')">チェック・承認</button>
            <button class="mail-work-tab" type="button" role="tab" data-mail-work-tab="history" data-active="false" aria-selected="false" tabindex="-1" onclick="switchMailWorkTab('history')">履歴</button>
          </div>

          <div class="mail-work-panel" role="tabpanel" data-mail-work-panel="overview" data-active="true">
          <div class="mail-stage">
            <div class="mail-stage-head">
              <h3>選択中の営業対象</h3>
              <span id="mailNextAction" class="status muted"></span>
            </div>
            <div class="mail-stage-body">
              <div id="mailLeadSummary" data-ui="mail-lead-summary">上の営業対象一覧から、作成・レビューする案件を選択してください。</div>
              <div id="mailMaterialEngagement" data-ui="mail-material-engagement" class="mail-material-engagement" aria-live="polite"></div>
              <div class="mail-create-bar" style="margin-top:12px">
                <select id="templateKey">
                  <option value="normal">通常版</option>
                  <option value="sns_video_ad">SNS動画・広告版</option>
                </select>
                <button id="generateButton" onclick="generateMail()" disabled>AI下書きを生成</button>
                <span id="generateHelp" class="status muted">対象を選択してください</span>
              </div>
              <details class="template-manager" data-ui="template-manager">
                <summary>定型文管理</summary>
                <div class="template-manager-body">
                  <div class="template-manager-toolbar">
                    <label for="templateManagerList">保存済み定型文<select id="templateManagerList" onchange="loadTemplateForEdit(this.value)"><option value="">新規作成</option></select></label>
                    <button type="button" onclick="clearTemplateForm()">新規作成</button>
                    <span id="templateStatus" class="status" aria-live="polite"></span>
                  </div>
                  <div class="template-manager-grid">
                    <label>Key<input id="templateManagerKey" maxlength="100" placeholder="initial_outreach"></label>
                    <label>名前<input id="templateManagerName" maxlength="120" placeholder="初回営業"></label>
                    <label>用途<select id="templateManagerChannel"><option value="email">メール</option><option value="site_message">サイト内メッセージ</option><option value="contact_form">問い合わせフォーム</option><option value="other">その他</option></select></label>
                    <label>件名<input id="templateManagerSubject" maxlength="200" placeholder="件名テンプレート 任意"></label>
                    <label class="template-manager-wide">説明<input id="templateManagerDescription" maxlength="300" placeholder="用途や注意点 任意"></label>
                    <label class="template-manager-wide">本文<textarea id="templateManagerBody" rows="8" placeholder="{{companyName}} などの変数を含む本文"></textarea></label>
                  </div>
                  <div class="template-manager-actions">
                    <label class="template-active"><input id="templateManagerActive" type="checkbox" checked>有効</label>
                    <button type="button" class="primary" onclick="saveTemplate()">定型文を保存</button>
                  </div>
                  <label class="template-import-field">JSON一括取り込み<textarea id="templateImportJson" rows="4" placeholder="[{&quot;key&quot;:&quot;initial_outreach&quot;,&quot;name&quot;:&quot;初回営業&quot;,&quot;channel&quot;:&quot;email&quot;,&quot;body&quot;:&quot;本文&quot;}]"></textarea></label>
                  <div class="template-manager-actions">
                    <button type="button" onclick="importTemplates()">JSONを取り込む</button>
                  </div>
                </div>
              </details>
            </div>
          </div>
          </div>

          <div class="mail-work-panel" role="tabpanel" data-mail-work-panel="history" data-active="false">
          <div class="mail-stage">
            <div class="mail-stage-head">
              <h3>作成履歴</h3>
            </div>
            <div class="mail-stage-body table-scroll mail-history-scroll" data-ui="mail-history" style="padding:0">
              <table>
                <thead>
                  <tr>
                    <th class="sortable" onclick="toggleDashboardSort('mail','subject')">作成履歴<span id="mailSort-subject" class="sort-mark"></span></th>
                    <th class="sortable" onclick="toggleDashboardSort('mail','status')" style="width:92px">状態<span id="mailSort-status" class="sort-mark"></span></th>
                    <th class="sortable" onclick="toggleDashboardSort('mail','createdAt')" style="width:120px">作成日<span id="mailSort-createdAt" class="sort-mark"></span></th>
                  </tr>
                </thead>
                <tbody id="mailRows"></tbody>
              </table>
            </div>
          </div>
          <div class="mail-stage">
            <div class="mail-stage-head">
              <h3>返信メモ</h3>
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

          <div class="mail-work-panel" role="tabpanel" data-mail-work-panel="draft" data-active="false">
          <div class="mail-stage">
            <div class="mail-stage-head">
              <h3>本文編集</h3>
              <div class="toolbar">
                <span id="mailEditorSaveState" class="status muted">メール未選択</span>
                <button onclick="polishMail()" id="polishButton" disabled>AIで整える</button>
                <button onclick="saveMail()" id="saveButton" disabled>保存</button>
              </div>
            </div>
            <div class="mail-stage-body mail-editor-grid" data-ui="mail-draft-editor">
              <div>
                <div id="rejectReasonBox"></div>
                <div class="row">
                  <label for="subject">件名</label>
                <input id="subject" oninput="updateMailEditorDirtyState()" />
              </div>
                <div class="row">
                  <label for="body">本文</label>
                  <textarea id="body" oninput="updateMailEditorDirtyState()"></textarea>
                </div>
                <div class="material-link-tools" data-ui="material-link-tools">
                  <label for="materialUrl">会社資料URL</label>
                  <div class="material-link-row">
                    <input id="materialUrl" type="url" placeholder="https://example.com/company.pdf" />
                    <button type="button" id="materialLinkButton" onclick="createMaterialTrackingLink()" disabled>追跡リンクを本文へ追加</button>
                  </div>
                  <span id="materialLinkStatus" class="status muted" aria-live="polite">下書きまたは棄却後のメールで利用できます</span>
                </div>
              </div>
              <div class="mail-project-comparison" id="mailProjectComparison" data-ui="mail-project-comparison">
                <h4>案件情報と見比べる</h4>
                <div class="mail-comparison-list">
                  <div class="mail-comparison-item"><span>会社名</span><span id="selectedLead">未選択</span></div>
                  <div class="mail-comparison-item"><span>メール状態</span><span id="selectedMail">未選択</span></div>
                </div>
                <div class="row">
                  <label>次に押すボタン</label>
                  <div id="mailActionGuide" class="detail-text">メールを選択してください</div>
                </div>
              </div>
            </div>
          </div>
          </div>

          <div class="mail-work-panel" role="tabpanel" data-mail-work-panel="review" data-active="false">
          <div class="mail-stage" data-ui="mail-review-panel">
            <div class="mail-stage-head">
              <h3>送信前チェック・レビュー</h3>
              <span id="checklistStatus" class="status muted"></span>
            </div>
            <div class="mail-stage-body">
              <div id="draftConsistencyWarning" class="draft-consistency-warning" hidden></div>
              <div id="semanticConsistencyResult" class="semantic-consistency-result" hidden></div>
              <div class="next-action-strip" id="mailStageCards"></div>
              <div class="row">
                <label>送信前チェック</label>
                <ul class="checklist" id="checklistRows">
                  <li class="muted">メールを選択してください</li>
                </ul>
              </div>
              <div class="toolbar mail-actions">
                <button onclick="checkMailSemanticConsistency()" id="semanticCheckButton" disabled>AIで意味を確認</button>
                <button onclick="requestReview()" id="reviewButton" disabled>レビュー依頼</button>
                <button onclick="requestReReview()" id="reReviewButton" disabled>再レビュー依頼</button>
                <button onclick="rejectMail()" id="rejectButton" disabled>棄却</button>
                <button onclick="approveMail()" id="approveButton" disabled>承認</button>
                <button onclick="queueMail()" id="queueButton" disabled>送信待ちにする</button>
                <button onclick="markMailSent()" id="markSentButton" disabled>送信済みにする</button>
              </div>
            </div>
          </div>
          </div>

        </div>
      </section>`;
}
