import { renderLeadsPageDocument } from './leads-page-static';

export function renderLeadsPage() {
    return renderLeadsPageDocument(`    const SELECTED_LEAD_STORAGE_KEY = 'salesAiSystem.selectedLeadId';
    const state = { leads: [], mails: [], aiGenerations: [], tasks: [], assignees: [], companyContacts: [], contactsCompanyId: null, selectedContactId: null, contactsLoading: false, selectedLeadId: null, selectedLeadRecord: null, editingTaskId: null, listPage: 1, pageSize: 20, leadListMeta: { page: 1, limit: 20, total: 0, summary: { total: 0, noContact: 0, draft: 0, review: 0, queued: 0 } }, leadListRequestId: 0, leadFilterTimerId: null, summaryFilter: 'all', sort: { table: 'lead', key: 'createdAt', direction: 'desc' }, opportunitiesByLeadId: {}, opportunity: null, opportunityHistory: [], opportunityLoading: false, opportunityError: '', opportunityNotice: null, opportunityRequestId: 0 };

    async function api(path, options = {}) {
      return window.SalesAiApi.request(path, options, { includeOperatorEmail: true });
    }

    async function loadAll() {
      setPageStatus('読み込み中', 'loading');
      const requestId = ++state.leadListRequestId;
      try {
        applyUrlFilters();
        const leads = await api(buildLeadListPath());
        if (requestId !== state.leadListRequestId) return;
        applyLeadListResponse(leads);
        await restoreSelectedLead();
        if (requestId !== state.leadListRequestId) return;
        render();
        void loadCompanyContacts();
        void loadTaskAssignees();
        void loadLeadTasks();
        void loadSelectedOpportunity();
        setPageStatus(state.leads.length ? '読み込み完了' : '営業案件は0件です', state.leads.length ? 'ok' : 'empty');
      } catch (error) {
        setPageStatus('読み込みに失敗しました: ' + error.message + '。更新を押して再試行してください。', 'error');
      }
    }

    function buildLeadListPath(overrides = {}) {
      const params = new URLSearchParams({
        page: String(overrides.page || state.listPage),
        limit: String(overrides.limit || state.pageSize),
        sort: state.sort.key || 'createdAt',
        sortDirection: state.sort.direction || 'desc'
      });
      const directFilters = {
        keyword: value('keyword'),
        source: value('sourceFilter'),
        status: value('statusFilter'),
        priority: value('priorityFilter'),
        contactState: value('contactFilter'),
        mailStatus: value('mailFilter'),
        nextAction: value('nextActionFilter')
      };
      if (state.summaryFilter === 'noContact') directFilters.contactState = 'none';
      if (state.summaryFilter === 'draft') directFilters.mailStatus = 'draft';
      if (state.summaryFilter === 'review') directFilters.mailStatus = 'in_review';
      if (state.summaryFilter === 'queued') directFilters.mailStatus = 'queued';
      Object.entries(directFilters).forEach(([key, filterValue]) => {
        if (filterValue && filterValue !== 'any') params.set(key, filterValue);
      });
      return '/api/leads?' + params.toString();
    }

    function applyLeadListResponse(response) {
      state.leads = response.items || [];
      state.leadListMeta = {
        page: Number(response.page || state.listPage),
        limit: Number(response.limit || state.pageSize),
        total: Number(response.total || 0),
        summary: response.summary || state.leadListMeta.summary
      };
      state.listPage = state.leadListMeta.page;
      const selectedOnPage = state.leads.find((lead) => lead.id === state.selectedLeadId);
      if (selectedOnPage) state.selectedLeadRecord = selectedOnPage;
    }

    async function loadLeadPage(options = {}) {
      const requestId = ++state.leadListRequestId;
      if (!options.silent) setPageStatus('営業案件を読み込み中', 'loading');
      try {
        const response = await api(buildLeadListPath());
        if (requestId !== state.leadListRequestId) return;
        applyLeadListResponse(response);
        render();
        setPageStatus(state.leadListMeta.total ? '読み込み完了' : '条件に合う営業案件は0件です', state.leadListMeta.total ? 'ok' : 'empty');
      } catch (error) {
        if (requestId !== state.leadListRequestId) return;
        setPageStatus('読み込みに失敗しました: ' + error.message, 'error');
      }
    }

    function scheduleLeadListReload(debounce = true) {
      if (state.leadFilterTimerId) clearTimeout(state.leadFilterTimerId);
      state.leadListRequestId += 1;
      state.summaryFilter = 'all';
      state.listPage = 1;
      const run = () => {
        state.leadFilterTimerId = null;
        void loadLeadPage();
      };
      if (debounce) state.leadFilterTimerId = setTimeout(run, 300);
      else run();
    }

    function setLeadListSortFromControls() {
      state.sort = {
        table: 'lead',
        key: value('leadSortSelect') || 'createdAt',
        direction: value('leadSortDirection') || 'desc'
      };
      state.listPage = 1;
      void loadLeadPage();
    }

    function setPageStatus(message, stateType) {
      const element = document.getElementById('pageStatus');
      element.textContent = message;
      element.className = stateType === 'ok' ? 'status ok' : 'status ui-state-' + stateType;
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
      renderTaskWorkspace();
      updateExportPreview();
    }

    function renderStats() {
      const counts = state.leadListMeta.summary || { total: state.leadListMeta.total, noContact: 0, draft: 0, review: 0, queued: 0 };
      document.getElementById('stats').innerHTML =
        statCard('all', '総案件', Number(counts.total || 0)) +
        statCard('noContact', '連絡先なし', Number(counts.noContact || 0)) +
        statCard('draft', '下書き', Number(counts.draft || 0)) +
        statCard('review', '確認待ち', Number(counts.review || 0)) +
        statCard('queued', '送信待ち', Number(counts.queued || 0));
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
      ['keyword', 'sourceFilter', 'statusFilter', 'priorityFilter', 'contactFilter', 'mailFilter', 'nextActionFilter'].forEach((id) => {
        const element = document.getElementById(id);
        if (element) element.value = id === 'nextActionFilter' ? 'any' : '';
      });
      state.listPage = 1;
      void loadLeadPage();
    }

    function renderRows() {
      const listScroll = document.querySelector('[data-ui="lead-list-workspace"] .lead-list-scroll');
      const listScrollTop = listScroll ? listScroll.scrollTop : 0;
      const rows = state.leads.map((lead) => {
        const mail = latestMail(lead.id);
        const project = lead.project || {};
        const contact = contactSummary(lead);
        const sendMethod = lead.sendMethod || suggestSendMethod(lead);
        return '<tr data-selected="' + (lead.id === state.selectedLeadId) + '" data-lead-id="' + escapeAttr(lead.id) + '" tabindex="0" onclick="selectLead(this.dataset.leadId)" onkeydown="selectLeadFromKeyboard(event)">' +
          '<td><div class="clip">' + escapeHtml(lead.company?.name || lead.companyId) + '</div></td>' +
          '<td><div class="clip">' + escapeHtml(project.title || '案件名なし') + '</div><div class="muted clip">' + escapeHtml(project.url || '') + '</div></td>' +
          '<td><span class="badge">' + escapeHtml(projectPlatformLabel(project)) + '</span></td>' +
          '<td><span class="badge">' + escapeHtml(labelLeadStatus(lead.status)) + '</span></td>' +
          '<td><span class="badge ' + opportunityBadgeClass(opportunityForLead(lead)?.stage) + '">' + escapeHtml(labelOpportunityStage(opportunityForLead(lead)?.stage)) + '</span></td>' +
          '<td>' + escapeHtml(labelPriority(lead.priority)) + '</td>' +
          '<td>' + escapeHtml(Number(lead.score || 0)) + '</td>' +
          '<td><span class="badge ' + (contact === '未確認' ? 'danger' : 'ok') + '">' + escapeHtml(contact) + '</span><div class="muted clip">' + escapeHtml(sendMethod || '手段未定') + '</div></td>' +
          '<td>' + (mail ? '<span class="badge ' + mailBadgeClass(mail.status) + '">' + escapeHtml(labelMailStatus(mail.status)) + '</span>' : '<span class="badge warn">未生成</span>') + '</td>' +
          '<td data-ui="lead-attention-reason"><div class="attention-reason">' + escapeHtml(attentionReason(lead, mail)) + '</div><div class="muted">' + escapeHtml(nextActionDateLabel(lead)) + '</div></td>' +
        '</tr>';
      }).join('');
      document.getElementById('leadRows').innerHTML = rows || '<tr><td colspan="10" class="ui-state-empty">条件に合う営業案件がありません</td></tr>';
      if (listScroll) listScroll.scrollTop = listScrollTop;
      document.getElementById('listCount').textContent = state.leadListMeta.total + '件';
      renderLeadPagination(state.leadListMeta.total);
      renderSortMarks('lead', ['company', 'project', 'priority', 'score']);
    }

    function renderLeadPagination(total) {
      const container = document.getElementById('leadPagination');
      if (!container) return;
      const pageCount = Math.max(1, Math.ceil(total / state.pageSize));
      if (pageCount <= 1) {
        container.innerHTML = '';
        return;
      }
      container.innerHTML =
        '<button type="button" onclick="changeLeadPage(-1)"' + (state.listPage <= 1 ? ' disabled' : '') + '>前へ</button>' +
        '<span aria-live="polite">' + state.listPage + ' / ' + pageCount + '</span>' +
        '<button type="button" onclick="changeLeadPage(1)"' + (state.listPage >= pageCount ? ' disabled' : '') + '>次へ</button>';
    }

    function changeLeadPage(delta) {
      const pageCount = Math.max(1, Math.ceil(state.leadListMeta.total / state.pageSize));
      state.listPage = Math.min(pageCount, Math.max(1, state.listPage + delta));
      void loadLeadPage();
    }

    function renderDetail() {
      const lead = selectedLead();
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
          detailItem('商談状況', labelOpportunityStage(opportunityForLead(lead)?.stage)) +
        '</div>' +
        rowBlock('案件名', project.title || '未取得') +
        rowBlock('URL', project.url ? renderLink(project.url) : '未取得', true) +
        rowBlock('商品説明', project.description || '未取得') +
        rowBlock('営業理由', lead.reason || '未入力') +
        rowBlock('連絡先メモ', contactDetail(lead), true) +
        rowBlock('ブランド/SNS', snsDetail(lead), true) +
        rowBlock('次にやること', nextActionLabel(lead, mail)) +
        rowBlock('最新メール件名', mail?.subject || '未生成') +
        renderOpportunityWorkspace(lead) +
        renderCompanyContactManager(lead) +
        renderLeadEditPanel(lead);
    }

    function renderCompanyContactManager(lead) {
      const matchesSelectedCompany = state.contactsCompanyId === lead.companyId;
      return '<div class="row"><label>連絡先管理</label><div class="detail-text">' +
        window.SalesAiContacts.renderContactManager({
          contacts: matchesSelectedCompany ? state.companyContacts : [],
          selectedId: matchesSelectedCompany ? state.selectedContactId : null,
          loading: state.contactsLoading || !matchesSelectedCompany
        }) +
      '</div></div>';
    }

    function opportunityForLead(lead) {
      return state.opportunitiesByLeadId[lead?.id] ||
        (state.opportunity?.leadId === lead?.id ? state.opportunity : null) ||
        lead?.opportunity || null;
    }

    async function loadSelectedOpportunity() {
      const leadId = state.selectedLeadId;
      const requestId = ++state.opportunityRequestId;
      state.opportunity = null;
      state.opportunityHistory = [];
      state.opportunityError = '';
      state.opportunityLoading = Boolean(leadId);
      if (leadId) renderDetail();
      if (!leadId) return;
      try {
        const [opportunity, history] = await Promise.all([
          api('/api/leads/' + leadId + '/opportunity'),
          api('/api/leads/' + leadId + '/opportunity/history?limit=50')
        ]);
        if (requestId !== state.opportunityRequestId || leadId !== state.selectedLeadId) return;
        state.opportunity = opportunity;
        state.opportunitiesByLeadId[leadId] = opportunity;
        state.opportunityHistory = history.items || opportunity.history || [];
      } catch (error) {
        if (requestId !== state.opportunityRequestId || leadId !== state.selectedLeadId) return;
        state.opportunityError = error.message || '商談情報を読み込めませんでした。';
      } finally {
        if (requestId !== state.opportunityRequestId || leadId !== state.selectedLeadId) return;
        state.opportunityLoading = false;
        renderRows();
        renderDetail();
      }
    }

    function renderOpportunityWorkspace(lead) {
      const opportunity = opportunityForLead(lead);
      if (state.opportunityLoading && state.selectedLeadId === lead.id) {
        return '<section class="row opportunity-workspace" data-ui="opportunity-workspace"><label>商談状況</label><div class="detail-text ui-state-loading">商談情報を読み込み中</div></section>';
      }
      if (!opportunity) {
        const message = state.opportunityError || '商談情報を読み込めませんでした。';
        return '<section class="row opportunity-workspace" data-ui="opportunity-workspace"><label>商談状況</label><div class="detail-text"><span class="status error">' + escapeHtml(message) + '</span><button type="button" onclick="loadSelectedOpportunity()">再読み込み</button></div></section>';
      }
      const terminal = ['won', 'lost', 'excluded'].includes(opportunity.stage);
      const transitionOptions = opportunityNextStages(opportunity.stage);
      const ownerOptions = opportunityOwnerOptions(opportunity);
      return '<section class="row opportunity-workspace" data-ui="opportunity-workspace">' +
        '<label>商談状況</label>' +
        '<div class="detail-text">' +
          '<div class="detail-grid">' +
            detailItem('段階', labelOpportunityStage(opportunity.stage)) +
            detailItem('担当者', opportunityOwnerLabel(opportunity.owner)) +
            detailItem('確度', Number(opportunity.probability || 0) + '%') +
            detailItem('見込額', opportunity.expectedAmount === null || opportunity.expectedAmount === undefined ? '未入力' : formatCurrency(opportunity.expectedAmount)) +
            detailItem('受注額', opportunity.wonAmount === null || opportunity.wonAmount === undefined ? '未入力' : formatCurrency(opportunity.wonAmount)) +
            detailItem('商談予定', formatOpportunityDate(opportunity.meetingScheduledAt)) +
            detailItem('受注見込日', formatOpportunityDate(opportunity.expectedCloseDate)) +
            detailItem('バージョン', Number(opportunity.version || 0)) +
          '</div>' +
          (opportunity.lossReason ? rowBlock('失注理由', labelOpportunityLossReason(opportunity.lossReason) + (opportunity.lossReasonDetail ? ' / ' + opportunity.lossReasonDetail : '')) : '') +
          '<div class="form-grid">' +
            '<div class="row"><label for="opportunityOwnerEdit">担当者</label><select id="opportunityOwnerEdit">' + ownerOptions + '</select></div>' +
            inputField('opportunityProbabilityEdit', '確度（%）', opportunity.probability, '', 'number') +
            inputField('opportunityExpectedAmountEdit', '見込額（円）', opportunity.expectedAmount ?? '', '', 'number') +
            inputField('opportunityMeetingScheduledAtEdit', '商談予定日時', toDateTimeLocal(opportunity.meetingScheduledAt), '', 'datetime-local') +
            inputField('opportunityExpectedCloseDateEdit', '受注見込日', toDateTimeLocal(opportunity.expectedCloseDate), '', 'datetime-local') +
          '</div>' +
          '<div class="toolbar"><button type="button" onclick="saveOpportunityDetails()">商談情報を保存</button><span id="opportunityStatus" class="status ' + escapeAttr(state.opportunityNotice?.type || 'muted') + '">' + escapeHtml(state.opportunityNotice?.message || '') + '</span></div>' +
          (terminal ? renderOpportunityReopenForm(opportunity) : renderOpportunityTransitionForm(opportunity, transitionOptions)) +
          renderOpportunityHistory() +
        '</div>' +
      '</section>';
    }

    function renderOpportunityTransitionForm(opportunity, options) {
      if (!options.length) return '<div class="notice">この商談段階から進められる次の段階はありません。</div>';
      return '<div class="row"><label>次の商談段階</label><div class="detail-text">' +
        '<div class="form-grid">' +
          '<div class="row"><label for="opportunityTransitionStage">遷移先</label><select id="opportunityTransitionStage">' + options.map((stage) => '<option value="' + escapeAttr(stage) + '">' + escapeHtml(labelOpportunityStage(stage)) + '</option>').join('') + '</select></div>' +
          inputField('opportunityTransitionProbability', '遷移後の確度（任意）', '', '', 'number') +
          inputField('opportunityTransitionExpectedAmount', '遷移後の見込額（任意）', '', '', 'number') +
          inputField('opportunityTransitionWonAmount', '受注額（受注時は必須）', '', '', 'number') +
          '<div class="row"><label for="opportunityTransitionLossReason">失注理由（失注時は必須）</label><select id="opportunityTransitionLossReason">' + opportunityLossReasonOptions() + '</select></div>' +
          inputField('opportunityTransitionLossReasonDetail', '失注理由の補足（その他の場合は必須）') +
          inputField('opportunityTransitionMeetingScheduledAt', '商談予定日時（任意）', '', '', 'datetime-local') +
          inputField('opportunityTransitionExpectedCloseDate', '受注見込日（任意）', '', '', 'datetime-local') +
        '</div>' +
        '<div class="row"><label for="opportunityTransitionReason">理由・補足</label><textarea id="opportunityTransitionReason" maxlength="2000" placeholder="例: 初回提案書を送付"></textarea></div>' +
        '<div class="toolbar"><button type="button" class="primary" onclick="transitionOpportunity()">段階を更新</button></div>' +
      '</div></div>';
    }

    function renderOpportunityReopenForm(opportunity) {
      return '<div class="row"><label>商談を再開</label><div class="detail-text">' +
        '<div class="form-grid"><div class="row"><label for="opportunityReopenStage">再開先</label><select id="opportunityReopenStage">' +
          ['uncontacted', 'contacted', 'replied', 'meeting', 'proposal'].map((stage) => '<option value="' + stage + '">' + labelOpportunityStage(stage) + '</option>').join('') +
        '</select></div></div>' +
        '<div class="row"><label for="opportunityReopenReason">再開理由</label><textarea id="opportunityReopenReason" maxlength="2000" placeholder="再開する理由を入力"></textarea></div>' +
        '<div class="toolbar"><button type="button" onclick="reopenOpportunity()">再開する</button></div>' +
      '</div></div>';
    }

    function renderOpportunityHistory() {
      const items = state.opportunityHistory || [];
      const rows = items.map((item) => '<tr><td>' + escapeHtml(formatDate(item.createdAt)) + '</td><td>' +
        escapeHtml(item.fromStage ? labelOpportunityStage(item.fromStage) + ' → ' + labelOpportunityStage(item.toStage) : labelOpportunityStage(item.toStage)) +
        '</td><td>' + escapeHtml(item.changedBy?.name || item.changedBy?.email || (item.source === 'system' ? 'システム' : '手動')) + '</td><td>' + escapeHtml(item.reason || '—') + '</td></tr>').join('');
      return '<div class="row"><label>商談履歴</label><div class="detail-text table-scroll"><table><thead><tr><th>日時</th><th>変更</th><th>実行者</th><th>理由</th></tr></thead><tbody>' +
        (rows || '<tr><td colspan="4" class="muted">履歴はまだありません</td></tr>') +
      '</tbody></table></div></div>';
    }

    function opportunityNextStages(stage) {
      return ({
        uncontacted: ['contacted', 'excluded'],
        contacted: ['replied', 'meeting', 'proposal', 'lost', 'excluded'],
        replied: ['meeting', 'proposal', 'lost', 'excluded'],
        meeting: ['proposal', 'won', 'lost'],
        proposal: ['won', 'lost']
      })[stage] || [];
    }

    function opportunityOwnerOptions(opportunity) {
      const users = state.assignees.slice();
      if (opportunity.owner && !users.some((user) => user.id === opportunity.owner.id)) users.unshift(opportunity.owner);
      return '<option value="">未担当</option>' + users.map((user) => '<option value="' + escapeAttr(user.id) + '"' + (user.id === opportunity.ownerId ? ' selected' : '') + '>' + escapeHtml(opportunityOwnerLabel(user)) + '</option>').join('');
    }

    function opportunityOwnerLabel(owner) {
      return owner?.name || owner?.email || '未担当';
    }

    function opportunityLossReasonOptions() {
      return '<option value="">選択してください</option>' + [
        'no_interest', 'no_budget', 'timing', 'no_response', 'competitor', 'service_mismatch', 'contact_unavailable', 'duplicate', 'other'
      ].map((reason) => '<option value="' + reason + '">' + escapeHtml(labelOpportunityLossReason(reason)) + '</option>').join('');
    }

    function formatOpportunityDate(value) {
      return value ? formatDate(value) : '未入力';
    }

    async function saveOpportunityDetails() {
      const leadId = state.selectedLeadId;
      const opportunity = state.opportunity;
      if (!leadId || !opportunity) return;
      state.opportunityNotice = { message: '保存中', type: 'warn' };
      renderDetail();
      try {
        await api('/api/leads/' + leadId + '/opportunity', {
          method: 'PATCH',
          body: JSON.stringify({
            expectedVersion: opportunity.version,
            ownerId: nullableValue('opportunityOwnerEdit'),
            probability: numberValue('opportunityProbabilityEdit'),
            expectedAmount: nullableNumberValue('opportunityExpectedAmountEdit'),
            meetingScheduledAt: nullableDateTimeValue('opportunityMeetingScheduledAtEdit'),
            expectedCloseDate: nullableDateTimeValue('opportunityExpectedCloseDateEdit')
          })
        });
        state.opportunityNotice = { message: '保存しました', type: 'ok' };
        await loadSelectedOpportunity();
      } catch (error) {
        state.opportunityNotice = { message: error.message, type: 'error' };
        renderDetail();
      }
    }

    async function transitionOpportunity() {
      const leadId = state.selectedLeadId;
      const opportunity = state.opportunity;
      if (!leadId || !opportunity) return;
      const toStage = value('opportunityTransitionStage');
      const payload = compactPayload({
        expectedVersion: opportunity.version,
        operationKey: newOperationKey(),
        toStage,
        reason: nullableValue('opportunityTransitionReason'),
        probability: optionalNumberValue('opportunityTransitionProbability'),
        expectedAmount: optionalNumberValue('opportunityTransitionExpectedAmount'),
        wonAmount: optionalNumberValue('opportunityTransitionWonAmount'),
        lossReason: nullableValue('opportunityTransitionLossReason'),
        lossReasonDetail: nullableValue('opportunityTransitionLossReasonDetail'),
        meetingScheduledAt: nullableDateTimeValue('opportunityTransitionMeetingScheduledAt'),
        expectedCloseDate: nullableDateTimeValue('opportunityTransitionExpectedCloseDate')
      });
      if (toStage !== 'won') delete payload.wonAmount;
      if (toStage !== 'lost') {
        delete payload.lossReason;
        delete payload.lossReasonDetail;
      }
      if (['won', 'lost', 'excluded'].includes(toStage)) {
        if (!payload.reason) {
          setInlineStatus('opportunityStatus', '受注・失注・対象外へ変更する理由を入力してください', 'warn');
          return;
        }
        const label = labelOpportunityStage(toStage);
        if (!window.confirm('商談段階を「' + label + '」へ変更します。よろしいですか？')) return;
      }
      state.opportunityNotice = { message: '段階を更新中', type: 'warn' };
      renderDetail();
      try {
        await api('/api/leads/' + leadId + '/opportunity/transitions', { method: 'POST', body: JSON.stringify(payload) });
        state.opportunityNotice = { message: '商談段階を更新しました', type: 'ok' };
        await loadSelectedOpportunity();
        void refreshSelectedLead(leadId);
      } catch (error) {
        state.opportunityNotice = { message: error.message, type: 'error' };
        renderDetail();
      }
    }

    async function reopenOpportunity() {
      const leadId = state.selectedLeadId;
      const opportunity = state.opportunity;
      if (!leadId || !opportunity) return;
      const reason = value('opportunityReopenReason');
      if (!reason) {
        setInlineStatus('opportunityStatus', '再開理由を入力してください', 'warn');
        return;
      }
      state.opportunityNotice = { message: '再開中', type: 'warn' };
      renderDetail();
      try {
        await api('/api/leads/' + leadId + '/opportunity/reopen', {
          method: 'POST',
          body: JSON.stringify({ expectedVersion: opportunity.version, operationKey: newOperationKey(), toStage: value('opportunityReopenStage'), reason })
        });
        state.opportunityNotice = { message: '商談を再開しました', type: 'ok' };
        await loadSelectedOpportunity();
      } catch (error) {
        state.opportunityNotice = { message: error.message, type: 'error' };
        renderDetail();
      }
    }

    function newOperationKey() {
      if (window.crypto?.randomUUID) return window.crypto.randomUUID();
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
        const value = Math.floor(Math.random() * 16);
        return (character === 'x' ? value : ((value & 3) | 8)).toString(16);
      });
    }

    async function loadCompanyContacts(successMessage = '') {
      const lead = selectedLead();
      if (!lead) {
        state.companyContacts = [];
        state.contactsCompanyId = null;
        state.selectedContactId = null;
        state.contactsLoading = false;
        return;
      }
      const companyId = lead.companyId;
      state.contactsCompanyId = companyId;
      state.contactsLoading = true;
      renderDetail();
      try {
        const result = await api('/api/companies/' + companyId + '/contacts');
        if (state.contactsCompanyId !== companyId) return;
        state.companyContacts = Array.isArray(result) ? result : (result.items || []);
        if (!state.companyContacts.some((contact) => contact.id === state.selectedContactId)) {
          state.selectedContactId = window.SalesAiContacts.primaryContact(state.companyContacts)?.id || null;
        }
        state.contactsLoading = false;
        renderDetail();
        if (successMessage) setInlineStatus('companyContactStatus', successMessage, 'ok');
      } catch (error) {
        if (state.contactsCompanyId !== companyId) return;
        state.contactsLoading = false;
        state.companyContacts = [];
        renderDetail();
        setInlineStatus('companyContactStatus', '連絡先を読み込めません: ' + error.message, 'error');
      }
    }

    function selectCompanyContact(id) {
      state.selectedContactId = id;
      renderDetail();
    }

    function newCompanyContact() {
      state.selectedContactId = null;
      renderDetail();
    }

    async function saveCompanyContact() {
      const lead = selectedLead();
      if (!lead) return;
      setInlineStatus('companyContactStatus', '保存中', 'warn');
      const payload = {
        name: nullableValue('companyContactName'),
        roleTitle: nullableValue('companyContactRoleTitle'),
        email: nullableValue('companyContactEmail'),
        inquiryUrl: nullableValue('companyContactInquiryUrl'),
        isPrimary: document.getElementById('companyContactPrimary').checked
      };
      try {
        const path = state.selectedContactId
          ? '/api/contacts/' + state.selectedContactId
          : '/api/companies/' + lead.companyId + '/contacts';
        const contact = await api(path, { method: state.selectedContactId ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
        state.selectedContactId = contact.id || state.selectedContactId;
        await loadCompanyContacts('連絡先を保存しました');
      } catch (error) {
        setInlineStatus('companyContactStatus', error.message, 'error');
      }
    }

    async function archiveCompanyContact() {
      if (!state.selectedContactId || !window.confirm('この連絡先をアーカイブしますか？')) return;
      try {
        await api('/api/contacts/' + state.selectedContactId + '/archive', { method: 'POST', body: '{}' });
        state.selectedContactId = null;
        await loadCompanyContacts('連絡先をアーカイブしました');
      } catch (error) {
        setInlineStatus('companyContactStatus', error.message, 'error');
      }
    }

    async function toggleCompanyContactUnsubscribe() {
      const contact = state.companyContacts.find((item) => item.id === state.selectedContactId);
      if (!contact) return;
      if (!contact.isUnsubscribed && !window.confirm('この連絡先を配信停止にしますか？')) return;
      try {
        if (contact.isUnsubscribed) {
          await api('/api/contacts/' + contact.id, { method: 'PATCH', body: JSON.stringify({ isUnsubscribed: false }) });
        } else {
          await api('/api/contacts/' + contact.id + '/unsubscribe', { method: 'POST', body: '{}' });
        }
        await loadCompanyContacts(contact.isUnsubscribed ? '配信停止を解除しました' : '配信停止にしました');
      } catch (error) {
        setInlineStatus('companyContactStatus', error.message, 'error');
      }
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

    async function loadTaskAssignees() {
      try {
        const assignees = await api('/api/task-assignees');
        state.assignees = Array.isArray(assignees) ? assignees : [];
        renderTaskWorkspace();
        renderDetail();
      } catch (error) {
        state.assignees = [];
        setInlineStatus('taskWorkspaceStatus', '担当候補を読み込めませんでした', 'warn');
      }
    }

    async function loadLeadTasks() {
      const leadId = state.selectedLeadId;
      state.tasks = [];
      renderTaskWorkspace();
      if (!leadId) return;
      setInlineStatus('taskWorkspaceStatus', '読み込み中', 'warn');
      try {
        const tasks = await api('/api/leads/' + leadId + '/tasks?scope=all');
        if (leadId !== state.selectedLeadId) return;
        state.tasks = Array.isArray(tasks) ? tasks : [];
        renderTaskWorkspace();
      } catch (error) {
        if (leadId !== state.selectedLeadId) return;
        state.tasks = [];
        renderTaskWorkspace();
        setInlineStatus('taskWorkspaceStatus', '次回対応を読み込めませんでした', 'error');
      }
    }

    function renderTaskWorkspace() {
      const container = document.getElementById('leadTaskWorkspace');
      if (!container) return;
      const lead = selectedLead();
      if (!lead) {
        container.innerHTML = '<div class="ui-state-empty">案件を選択すると次回対応を管理できます</div>';
        return;
      }
      const editing = state.tasks.find((task) => task.id === state.editingTaskId) || null;
      const draft = editing ? {
        title: editing.title,
        description: editing.description || '',
        dueAt: toTokyoDateTimeLocal(editing.dueAt),
        assigneeId: editing.assignee?.id || ''
      } : { title: '', description: '', dueAt: '', assigneeId: '' };
      const assigneeOptions = '<option value="">担当未設定</option>' + state.assignees.map((assignee) => {
        const label = assignee.name || assignee.email || '担当未設定';
        return '<option value="' + escapeAttr(assignee.id) + '"' + (assignee.id === draft.assigneeId ? ' selected' : '') + '>' + escapeHtml(label) + '</option>';
      }).join('');
      const taskRows = state.tasks.map((task) => {
        const assignee = task.assignee?.name || task.assignee?.email || '担当未設定';
        const due = task.dueAt ? formatTaskDate(task.dueAt) : '日付未定';
        const actions = task.status === 'done' || task.status === 'cancelled'
          ? '<button type="button" data-task-id="' + escapeAttr(task.id) + '" onclick="editTask(this.dataset.taskId)">編集</button><button type="button" data-task-id="' + escapeAttr(task.id) + '" data-task-status="todo" onclick="updateTaskStatus(this.dataset.taskId, this.dataset.taskStatus)">再開</button>'
          : '<button type="button" data-task-id="' + escapeAttr(task.id) + '" onclick="editTask(this.dataset.taskId)">編集</button>' +
            (task.status === 'todo' ? '<button type="button" data-task-id="' + escapeAttr(task.id) + '" data-task-status="doing" onclick="updateTaskStatus(this.dataset.taskId, this.dataset.taskStatus)">着手</button>' : '<button type="button" data-task-id="' + escapeAttr(task.id) + '" data-task-status="todo" onclick="updateTaskStatus(this.dataset.taskId, this.dataset.taskStatus)">未着手</button>') +
            '<button type="button" data-task-id="' + escapeAttr(task.id) + '" data-task-status="done" onclick="updateTaskStatus(this.dataset.taskId, this.dataset.taskStatus)">完了</button><button type="button" data-task-id="' + escapeAttr(task.id) + '" data-task-status="cancelled" onclick="updateTaskStatus(this.dataset.taskId, this.dataset.taskStatus)">取消</button>';
        return '<div class="task-row"><div class="task-row-main"><strong>' + escapeHtml(task.title) + '</strong><span class="task-row-meta">' + escapeHtml(taskStatusLabel(task.status)) + ' / ' + escapeHtml(due) + ' / ' + escapeHtml(assignee) + '</span>' + (task.description ? '<span class="task-row-description">' + escapeHtml(task.description) + '</span>' : '') + '</div><div class="toolbar">' + actions + '</div></div>';
      }).join('');
      container.innerHTML =
        '<div class="section-head"><h3>次回対応</h3><div class="toolbar"><span class="status muted" aria-live="polite">未完了 ' + escapeHtml(lead.activeTaskCount || 0) + '件</span></div></div>' +
        '<div class="body"><div class="task-list">' + (taskRows || '<div class="ui-state-empty">次回対応はありません</div>') + '</div>' +
        '<div class="task-form">' +
          '<label class="full" for="taskTitle">対応内容<input id="taskTitle" maxlength="120" value="' + escapeAttr(draft.title) + '" placeholder="例: 資料を送る"></label>' +
          '<label for="taskDueAt">次回対応日時<input id="taskDueAt" type="datetime-local" value="' + escapeAttr(draft.dueAt) + '"></label>' +
          '<label for="taskAssignee">担当<select id="taskAssignee">' + assigneeOptions + '</select></label>' +
          '<label class="full" for="taskDescription">補足<textarea id="taskDescription" maxlength="5000" placeholder="返信内容や確認事項">' + escapeHtml(draft.description) + '</textarea></label>' +
          '<div class="task-form-actions"><button type="button" class="primary" id="taskSaveButton" onclick="saveTask()">' + (editing ? '次回対応を更新' : '次回対応を保存') + '</button><button type="button" onclick="resetTaskForm()"' + (editing ? '' : ' disabled') + '>入力をクリア</button><span id="taskWorkspaceStatus" class="status muted" aria-live="polite"></span></div>' +
        '</div></div>';
    }

    function taskStatusLabel(status) {
      return ({ todo: '未着手', doing: '対応中', done: '完了', cancelled: '取消' })[status] || status || '未設定';
    }

    function formatTaskDate(value) {
      if (!value) return '日付未定';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '日付未定';
      return date.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    }

    function toTokyoDateTimeLocal(value) {
      if (!value) return '';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '';
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(date);
      const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
      return values.year + '-' + values.month + '-' + values.day + 'T' + values.hour + ':' + values.minute;
    }

    function taskDueAtValue(id) {
      const raw = value(id);
      return raw ? new Date(raw + ':00+09:00').toISOString() : null;
    }

    function editTask(taskId) {
      state.editingTaskId = taskId;
      renderTaskWorkspace();
    }

    function resetTaskForm() {
      state.editingTaskId = null;
      renderTaskWorkspace();
    }

    async function saveTask() {
      const leadId = state.selectedLeadId;
      if (!leadId) return;
      const title = value('taskTitle');
      if (!title) {
        setInlineStatus('taskWorkspaceStatus', '対応内容を入力してください', 'warn');
        return;
      }
      const taskId = state.editingTaskId;
      const payload = {
        title,
        description: value('taskDescription') || null,
        dueAt: taskDueAtValue('taskDueAt'),
        assigneeId: value('taskAssignee') || null
      };
      setInlineStatus('taskWorkspaceStatus', taskId ? '更新中' : '保存中', 'warn');
      try {
        await api(taskId ? '/api/tasks/' + taskId : '/api/leads/' + leadId + '/tasks', { method: taskId ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
        state.editingTaskId = null;
        await refreshSelectedLead(leadId);
        setInlineStatus('taskWorkspaceStatus', '保存しました', 'ok');
      } catch (error) {
        setInlineStatus('taskWorkspaceStatus', '保存に失敗しました: ' + error.message, 'error');
      }
    }

    async function updateTaskStatus(taskId, status) {
      setInlineStatus('taskWorkspaceStatus', '更新中', 'warn');
      try {
        await api('/api/tasks/' + taskId, { method: 'PATCH', body: JSON.stringify({ status }) });
        state.editingTaskId = null;
        await refreshSelectedLead(state.selectedLeadId);
        setInlineStatus('taskWorkspaceStatus', '保存しました', 'ok');
      } catch (error) {
        setInlineStatus('taskWorkspaceStatus', '保存に失敗しました: ' + error.message, 'error');
      }
    }

    async function refreshSelectedLead(leadId) {
      if (!leadId || leadId !== state.selectedLeadId) return;
      const [lead, tasks] = await Promise.all([
        api('/api/leads/' + leadId),
        api('/api/leads/' + leadId + '/tasks?scope=all')
      ]);
      if (leadId !== state.selectedLeadId) return;
      state.leads = state.leads.map((item) => item.id === leadId ? lead : item);
      state.selectedLeadRecord = lead;
      state.tasks = Array.isArray(tasks) ? tasks : [];
      render();
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
      return state.leads;
    }

    function updateExportPreview() {
      const preview = document.getElementById('exportPreview');
      if (!preview) return;
      const scope = value('exportScope') || 'visible';
      const format = value('exportFormat') || 'csv';
      const columns = value('exportColumns') || 'summary';
      const count = scope === 'all' ? state.leadListMeta.total : state.leads.length;
      const scopeLabel = scope === 'all' ? '現在の条件に合う全件' : '現在ページ';
      const columnLabel = columns === 'detail' ? '詳細用' : '一覧用';
      preview.textContent = scopeLabel + ' ' + count + '件を' + format.toUpperCase() + '・' + columnLabel + 'で出力します';
    }

    async function exportLeads() {
      const scope = value('exportScope') || 'visible';
      const format = value('exportFormat') || 'csv';
      const columns = value('exportColumns') || 'summary';
      const button = document.getElementById('exportButton');
      button.disabled = true;
      setInlineStatus('exportStatus', scope === 'all' ? '条件に合う全件を準備中' : '現在ページを準備中', 'warn');
      try {
        const leads = scope === 'all'
          ? await window.SalesAiLeadExport.collectAllLeadPages(
              (page, limit) => api(buildLeadListPath({ page, limit })),
              { pageSize: 100, concurrency: 4 }
            )
          : [...state.leads];
        if (!leads.length) {
          setInlineStatus('exportStatus', '出力する営業案件がありません', 'warn');
          return;
        }
        const rows = buildLeadExportRows(leads, columns);
        const text = window.SalesAiLeadExport.serializeLeadExportRows(rows, format);
        const blob = new Blob([text], { type: format === 'tsv' ? 'text/tab-separated-values;charset=utf-8' : 'text/csv;charset=utf-8' });
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
      } catch (error) {
        setInlineStatus('exportStatus', '出力に失敗しました: ' + error.message, 'error');
      } finally {
        button.disabled = false;
      }
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
        ['最新メール', (lead) => latestMailForLead(lead) ? labelMailStatus(latestMailForLead(lead).status) : '未生成'],
        ['次にやること', (lead) => nextActionLabel(lead, latestMailForLead(lead))],
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

    function toggleSort(table, key) {
      if (state.sort.table === table && state.sort.key === key) {
        state.sort.direction = state.sort.direction === 'asc' ? 'desc' : 'asc';
      } else {
        state.sort = { table, key, direction: defaultSortDirection(key) };
      }
      state.listPage = 1;
      const sortSelect = document.getElementById('leadSortSelect');
      const directionSelect = document.getElementById('leadSortDirection');
      if (sortSelect) sortSelect.value = state.sort.key;
      if (directionSelect) directionSelect.value = state.sort.direction;
      void loadLeadPage();
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
      return window.SalesAiViewRules.sortItems(items, sort, valueGetter, window.SalesAiViewRules.compareValues);
    }

    function compareValues(left, right) {
      return window.SalesAiViewRules.compareValues(left, right);
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
        opportunity: labelOpportunityStage(opportunityForLead(lead)?.stage),
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

    function latestMail(leadId) {
      const lead = state.leads.find((item) => item.id === leadId) || (state.selectedLeadRecord?.id === leadId ? state.selectedLeadRecord : null);
      return latestMailForLead(lead, leadId);
    }

    function latestMailForLead(lead, leadId = lead?.id) {
      const embeddedMails = Array.isArray(lead?.mails) ? lead.mails : [];
      const candidates = embeddedMails.concat(state.mails)
        .filter((mail) => {
          if (mail.leadId === leadId || mail.lead?.id === leadId) return true;
          if (lead && mail.companyId === lead.companyId) return true;
          if (lead && mail.company?.id === lead.companyId) return true;
          return false;
        });
      return Array.from(new Map(candidates.map((mail) => [mail.id, mail])).values())
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
    }

    function selectedLead() {
      return state.leads.find((item) => item.id === state.selectedLeadId) ||
        (state.selectedLeadRecord?.id === state.selectedLeadId ? state.selectedLeadRecord : null);
    }

    function selectLead(id) {
      state.selectedLeadId = id;
      state.selectedLeadRecord = state.leads.find((lead) => lead.id === id) || state.selectedLeadRecord;
      persistSelectedLead(id);
      state.aiGenerations = [];
      state.opportunity = null;
      state.opportunityHistory = [];
      state.opportunityError = '';
      state.opportunityNotice = null;
      renderRows();
      renderDetail();
      renderLeadAnalysis();
      renderTaskWorkspace();
      void loadCompanyContacts();
      void loadLeadTasks();
      void loadLeadAnalysis();
      void loadSelectedOpportunity();
    }

    function selectLeadFromKeyboard(event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      selectLead(event.currentTarget.dataset.leadId);
    }

    function persistSelectedLead(id) {
      if (!id) return;
      localStorage.setItem(SELECTED_LEAD_STORAGE_KEY, id);
    }

    async function restoreSelectedLead() {
      const savedId = localStorage.getItem(SELECTED_LEAD_STORAGE_KEY);
      if (!savedId) return;
      state.selectedLeadId = savedId;
      const savedOnPage = state.leads.find((lead) => lead.id === savedId);
      if (savedOnPage) {
        state.selectedLeadRecord = savedOnPage;
        return;
      }
      try {
        state.selectedLeadRecord = await api('/api/leads/' + savedId);
      } catch {
        state.selectedLeadId = null;
        state.selectedLeadRecord = null;
        localStorage.removeItem(SELECTED_LEAD_STORAGE_KEY);
      }
    }

    function openProject() {
      const lead = selectedLead();
      const url = lead?.project?.url;
      if (url) window.open(url, '_blank', 'noopener');
    }

    function nextActionLabel(lead, mail) {
      return window.SalesAiViewRules.nextActionLabel(lead, mail, hasContact(lead));
    }

    function attentionReason(lead, mail, now = new Date()) {
      const nextActionReason = dueDateReason(lead.nextTask?.dueAt || lead.nextActionAt, '次対応', now);
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
      return Boolean(lead.contactEmail || lead.contactFormUrl || lead.siteMessageUrl || activeCompanyContacts(lead).some((contact) => contact.email || contact.inquiryUrl));
    }

    function contactSummary(lead) {
      if (lead.contactEmail) return 'メール';
      if (lead.contactFormUrl) return 'フォーム';
      if (lead.siteMessageUrl) return 'サイト内';
      const companyContact = activeCompanyContacts(lead).find((contact) => contact.email || contact.inquiryUrl);
      if (companyContact?.email) return 'メール';
      if (companyContact?.inquiryUrl) return 'フォーム';
      return '未確認';
    }

    function activeCompanyContacts(lead) {
      return Array.isArray(lead?.company?.contacts)
        ? lead.company.contacts.filter((contact) => !contact.deletedAt && !contact.isUnsubscribed)
        : [];
    }

    function suggestSendMethod(lead) {
      if (lead.contactEmail) return 'メール';
      if (lead.contactFormUrl) return '問い合わせフォーム';
      if (lead.siteMessageUrl) return 'サイト内メッセージ';
      const companyContact = activeCompanyContacts(lead).find((contact) => contact.email || contact.inquiryUrl);
      if (companyContact?.email) return 'メール';
      if (companyContact?.inquiryUrl) return '問い合わせフォーム';
      return '';
    }

    function nextActionDateLabel(lead) {
      const value = lead.nextTask?.dueAt || lead.nextActionAt || lead.nextFollowUpAt;
      return value ? formatDate(value) : '日付未定';
    }

    function contactDetail(lead) {
      const managedContacts = activeCompanyContacts(lead).flatMap((contact) => [
        contact.email ? 'メール: ' + escapeHtml(contact.email) : '',
        contact.inquiryUrl ? 'フォーム: ' + renderLink(contact.inquiryUrl) : ''
      ]);
      const entries = [
        lead.contactEmail ? 'メール: ' + escapeHtml(lead.contactEmail) : '',
        lead.contactFormUrl ? 'フォーム: ' + renderLink(lead.contactFormUrl) : '',
        lead.siteMessageUrl ? 'サイト内: ' + renderLink(lead.siteMessageUrl) : '',
        ...managedContacts,
        lead.contactMemo ? 'メモ: ' + escapeHtml(lead.contactMemo) : ''
      ].filter(Boolean);
      return Array.from(new Set(entries)).join('<br>') || '未確認';
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

    function renderLeadMemoSuggestions(memo) {
      const suggestions = [
        memo.ownerMemo ? '<strong>営業メモ案</strong><br>' + escapeHtml(memo.ownerMemo) : '',
        memo.brandAnalysisMemo ? '<strong>ブランド分析案</strong><br>' + escapeHtml(memo.brandAnalysisMemo) : '',
        memo.snsAnalysisMemo ? '<strong>SNS分析案</strong><br>' + escapeHtml(memo.snsAnalysisMemo) : ''
      ].filter(Boolean);
      if (!suggestions.length) return '';
      return '<details class="row"><summary>AI分析からの提案（未保存）</summary><div class="detail-text">' +
        suggestions.join('<hr>') +
      '</div></details>';
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
      const company = lead.company || {};
      return '<div class="row">' +
        '<label>選択案件の詳細</label>' +
        '<div class="form-grid">' +
          inputField('leadCompanyNameEdit', '企業名', company.name || '') +
          inputField('leadCompanyWebsiteUrlEdit', '会社HP', company.websiteUrl) +
          inputField('leadCompanyInquiryUrlEdit', '会社問い合わせURL', company.inquiryUrl) +
          inputField('leadCompanyIndustryEdit', '業種', company.industry) +
          inputField('leadCompanyLocationEdit', '会社所在地', company.location) +
          inputField('leadCompanySourceTotalAmountEdit', '実行者累計金額', company.sourceTotalAmount ?? '', '', 'number') +
          inputField('leadCompanySourceProjectCountEdit', '実行者PJ数', company.sourceProjectCount ?? '', '', 'number') +
          inputField('leadCompanySourceSupporterCountEdit', '実行者累計支援者', company.sourceSupporterCount ?? '', '', 'number') +
        '</div>' +
        '<div class="row">' +
          '<label for="leadCompanyMemoEdit">会社メモ</label>' +
          '<textarea id="leadCompanyMemoEdit">' + escapeHtml(company.memo || '') + '</textarea>' +
        '</div>' +
        (lead.project ? '<div class="form-grid">' +
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
          inputField('leadProjectTargetAmountEdit', '目標金額', project.targetAmount ?? '', '', 'number') +
          inputField('leadProjectStartDateEdit', '開始日時', toDateTimeLocal(project.startDate), '', 'datetime-local') +
          inputField('leadProjectEndDateEdit', '終了日時', toDateTimeLocal(project.endDate), '', 'datetime-local') +
          inputField('leadProjectLocationEdit', '案件地域', project.location) +
        '</div>' +
        '<div class="row">' +
          '<label for="leadProjectDescriptionEdit">プロジェクト説明</label>' +
          '<textarea id="leadProjectDescriptionEdit">' + escapeHtml(project.description || '') + '</textarea>' +
        '</div>' : '<div class="notice">この営業対象には案件が紐づいていないため、会社情報と営業情報だけ編集できます。</div>') +
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
          inputField('leadNextActionAtEdit', '次対応日時', toDateTimeLocal(lead.nextActionAt), '', 'datetime-local') +
          inputField('leadSentAtEdit', '送信日時', toDateTimeLocal(lead.sentAt), '', 'datetime-local') +
          inputField('leadNextFollowUpAtEdit', '次回確認日時', toDateTimeLocal(lead.nextFollowUpAt), '', 'datetime-local') +
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
          '<label for="leadReasonEdit">営業対象にした理由</label>' +
          '<textarea id="leadReasonEdit">' + escapeHtml(lead.reason || '') + '</textarea>' +
        '</div>' +
        '<div class="row">' +
          '<label for="leadOwnerMemoEdit">営業メモ</label>' +
          '<textarea id="leadOwnerMemoEdit">' + escapeHtml(lead.ownerMemo || '') + '</textarea>' +
        '</div>' +
        '<div class="row">' +
          '<label for="leadBrandAnalysisMemoEdit">ブランド分析メモ</label>' +
          '<textarea id="leadBrandAnalysisMemoEdit">' + escapeHtml(lead.brandAnalysisMemo || '') + '</textarea>' +
        '</div>' +
        '<div class="row">' +
          '<label for="leadSnsAnalysisMemoEdit">SNS分析メモ</label>' +
          '<textarea id="leadSnsAnalysisMemoEdit">' + escapeHtml(lead.snsAnalysisMemo || '') + '</textarea>' +
        '</div>' +
        renderLeadMemoSuggestions(memo) +
        '<div class="toolbar">' +
          '<button class="primary" onclick="saveLeadEdit()">営業情報を保存</button>' +
          '<span id="leadEditStatus" class="status"></span>' +
        '</div>' +
      '</div>';
    }

    async function saveLeadEdit() {
      if (!state.selectedLeadId) return;
      const lead = selectedLead();
      if (!lead) return;
      setInlineStatus('leadEditStatus', '保存中', 'warn');
      try {
        const payload = {
          companyName: value('leadCompanyNameEdit'),
          companyWebsiteUrl: nullableValue('leadCompanyWebsiteUrlEdit'),
          companyInquiryUrl: nullableValue('leadCompanyInquiryUrlEdit'),
          companyIndustry: nullableValue('leadCompanyIndustryEdit'),
          companyLocation: nullableValue('leadCompanyLocationEdit'),
          companySourceTotalAmount: nullableNumberValue('leadCompanySourceTotalAmountEdit'),
          companySourceProjectCount: nullableNumberValue('leadCompanySourceProjectCountEdit'),
          companySourceSupporterCount: nullableNumberValue('leadCompanySourceSupporterCountEdit'),
          companyMemo: nullableValue('leadCompanyMemoEdit'),
          status: value('leadStatusEdit'),
          priority: value('leadPriorityEdit'),
          sendMethod: nullableValue('leadSendMethodEdit'),
          nextActionAt: nullableDateTimeValue('leadNextActionAtEdit'),
          sentAt: nullableDateTimeValue('leadSentAtEdit'),
          nextFollowUpAt: nullableDateTimeValue('leadNextFollowUpAtEdit'),
          contactEmail: nullableValue('leadContactEmailEdit'),
          contactFormUrl: nullableValue('leadContactFormUrlEdit'),
          siteMessageUrl: nullableValue('leadSiteMessageUrlEdit'),
          brandWebsiteUrl: nullableValue('leadBrandWebsiteUrlEdit'),
          instagramUrl: nullableValue('leadInstagramUrlEdit'),
          tiktokUrl: nullableValue('leadTiktokUrlEdit'),
          xUrl: nullableValue('leadXUrlEdit'),
          leadReason: nullableValue('leadReasonEdit'),
          ownerMemo: nullableValue('leadOwnerMemoEdit'),
          contactMemo: nullableValue('leadContactMemoEdit'),
          brandAnalysisMemo: nullableValue('leadBrandAnalysisMemoEdit'),
          snsAnalysisMemo: nullableValue('leadSnsAnalysisMemoEdit')
        };
        if (lead.project) Object.assign(payload, {
          projectSource: value('leadProjectSourceEdit'),
          projectTitle: value('leadProjectTitleEdit'),
          projectUrl: value('leadProjectUrlEdit'),
          projectStatus: value('leadProjectStatusEdit'),
          projectAmount: numberValue('leadProjectAmountEdit'),
          projectSupporterCount: numberValue('leadProjectSupporterCountEdit'),
          projectTargetAmount: nullableNumberValue('leadProjectTargetAmountEdit'),
          projectStartDate: nullableDateTimeValue('leadProjectStartDateEdit'),
          projectEndDate: nullableDateTimeValue('leadProjectEndDateEdit'),
          projectCategory: nullableValue('leadProjectCategoryEdit'),
          projectLocation: nullableValue('leadProjectLocationEdit'),
          projectDescription: nullableValue('leadProjectDescriptionEdit')
        });
        await api('/api/leads/' + state.selectedLeadId, {
          method: 'PATCH',
          body: JSON.stringify(payload)
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

    function nullableValue(id) {
      const raw = value(id);
      return raw || null;
    }

    function nullableDateTimeValue(id) {
      const raw = value(id);
      return raw ? new Date(raw).toISOString() : null;
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

    function nullableNumberValue(id) {
      const raw = value(id);
      if (!raw) return null;
      const number = Number(raw);
      return Number.isFinite(number) ? number : null;
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
      return '<div class="row"><label for="' + escapeHtml(id) + '">' + escapeHtml(label) + '</label><input id="' + escapeHtml(id) + '" type="' + escapeHtml(type) + '" value="' + escapeAttr(fieldValue ?? '') + '" placeholder="' + escapeAttr(placeholder) + '" /></div>';
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
      return date.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
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
      return window.SalesAiViewRules.labelLeadStatus(status);
    }

    function labelPriority(priority) {
      return window.SalesAiViewRules.labelPriority(priority);
    }

    function labelMailStatus(status) {
      return window.SalesAiViewRules.labelMailStatus(status);
    }

    function labelOpportunityStage(stage) {
      return window.SalesAiViewRules.labelOpportunityStage(stage);
    }

    function labelOpportunityLossReason(reason) {
      return window.SalesAiViewRules.labelOpportunityLossReason(reason);
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

    function opportunityBadgeClass(stage) {
      if (stage === 'won') return 'ok';
      if (['lost', 'excluded'].includes(stage)) return 'danger';
      if (['meeting', 'proposal'].includes(stage)) return 'warn';
      return '';
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

    loadAll();`);
}
