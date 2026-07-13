import { renderLeadsPageDocument } from './leads-page-static';

export function renderLeadsPage() {
    return renderLeadsPageDocument(`    const SELECTED_LEAD_STORAGE_KEY = 'salesAiSystem.selectedLeadId';
    const state = { leads: [], mails: [], aiGenerations: [], tasks: [], assignees: [], selectedLeadId: null, editingTaskId: null, listPage: 1, pageSize: 20, leadFilterSignature: '', summaryFilter: 'all', sort: { table: 'lead', key: '', direction: 'asc' } };

    async function api(path, options = {}) {
      return window.SalesAiApi.request(path, options, { includeOperatorEmail: true });
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
        restoreSelectedLead();
        applyUrlFilters();
        populateSourceFilterOptions('sourceFilter');
        render();
        void loadTaskAssignees();
        void loadLeadTasks();
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
      syncLeadPaginationState();
      renderStats();
      renderRows();
      renderDetail();
      renderLeadAnalysis();
      renderTaskWorkspace();
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
      const allVisibleLeads = filteredLeads();
      const pageCount = Math.max(1, Math.ceil(allVisibleLeads.length / state.pageSize));
      state.listPage = Math.min(state.listPage, pageCount);
      const pageStart = (state.listPage - 1) * state.pageSize;
      const visibleLeads = allVisibleLeads.slice(pageStart, pageStart + state.pageSize);
      const rows = visibleLeads.map((lead) => {
        const mail = latestMail(lead.id);
        const project = lead.project || {};
        const contact = contactSummary(lead);
        const sendMethod = lead.sendMethod || suggestSendMethod(lead);
        return '<tr data-selected="' + (lead.id === state.selectedLeadId) + '" data-lead-id="' + escapeAttr(lead.id) + '" tabindex="0" onclick="selectLead(this.dataset.leadId)" onkeydown="selectLeadFromKeyboard(event)">' +
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
      document.getElementById('listCount').textContent = allVisibleLeads.length + '件';
      renderLeadPagination(allVisibleLeads.length);
      renderSortMarks('lead', ['company', 'project', 'source', 'status', 'priority', 'score', 'contact', 'mail', 'attentionReason']);
    }

    function syncLeadPaginationState() {
      const signature = leadFilterSignature();
      if (state.leadFilterSignature !== signature) {
        state.leadFilterSignature = signature;
        state.listPage = 1;
      }
    }

    function leadFilterSignature() {
      return ['keyword', 'sourceFilter', 'statusFilter', 'priorityFilter', 'contactFilter', 'mailFilter']
        .map((id) => value(id)).join('|') + '|' + state.summaryFilter + '|' +
        state.sort.table + '|' + state.sort.key + '|' + state.sort.direction;
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
      const pageCount = Math.max(1, Math.ceil(filteredLeads().length / state.pageSize));
      state.listPage = Math.min(pageCount, Math.max(1, state.listPage + delta));
      render();
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

    async function loadTaskAssignees() {
      try {
        const assignees = await api('/api/task-assignees');
        state.assignees = Array.isArray(assignees) ? assignees : [];
        renderTaskWorkspace();
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
      const lead = state.leads.find((item) => item.id === state.selectedLeadId);
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
      renderTaskWorkspace();
      void loadLeadTasks();
      void loadLeadAnalysis();
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
      const value = lead.nextTask?.dueAt || lead.nextActionAt || lead.nextFollowUpAt;
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

    loadAll();`);
}
