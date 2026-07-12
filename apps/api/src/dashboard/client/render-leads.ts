const LEADS_RENDER_SOURCE = String.raw`function renderLeads() {
      const leadQueue = document.querySelector('[data-ui="mail-lead-queue"] .lead-list-scroll');
      const leadQueueScrollTop = leadQueue ? leadQueue.scrollTop : 0;
      const sortedLeads = visibleMailLeads();
      const rows = sortedLeads.map((lead) => {
        const company = lead.company?.name || lead.companyId;
        const project = lead.project?.title || '案件名なし';
        const projectUrl = lead.project?.url || '';
        return '<tr data-selected="' + (lead.id === state.selectedLeadId) + '" data-lead-id="' + escapeAttr(lead.id) + '" tabindex="0" onclick="selectLead(this.dataset.leadId)" onkeydown="selectLeadFromKeyboard(event)">' +
          '<td><div class="clip">' + escapeHtml(company) + '</div></td>' +
          '<td><div class="clip">' + escapeHtml(project) + '</div><div class="muted clip">' + escapeHtml(lead.reason || '') + '</div></td>' +
          '<td><span class="badge">' + escapeHtml(projectPlatformLabel(lead.project || {})) + '</span></td>' +
          '<td><span class="badge">' + escapeHtml(labelLeadStatus(lead.status)) + '</span></td>' +
          '<td>' + Number(lead.score || 0) + '</td>' +
          '<td>' + escapeHtml(labelPriority(lead.priority)) + '</td>' +
          '<td>' + (projectUrl ? '<a href="' + escapeAttr(projectUrl) + '" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">開く</a>' : '-') + '</td>' +
          '<td><button class="primary" onclick="selectLeadFromButton(event, \'' + lead.id + '\')">' + (lead.id === state.selectedLeadId ? '選択中' : '選択') + '</button></td>' +
        '</tr>';
      }).join('');
      document.getElementById('leadRows').innerHTML = rows || '<tr><td colspan="8" class="ui-state-empty">営業案件はまだありません</td></tr>';
      if (leadQueue) leadQueue.scrollTop = leadQueueScrollTop;
      const mailLeadCount = document.getElementById('mailLeadCount');
      if (mailLeadCount) mailLeadCount.textContent = sortedLeads.length + '件';
      updateNextLeadButton(sortedLeads);
      renderDashboardSortMarks('lead', ['company', 'project', 'source', 'status', 'score', 'priority']);
      document.getElementById('generateButton').disabled = !canGenerateMail();
      document.getElementById('analysisButton').disabled = !state.selectedLeadId;
      const selected = state.leads.find((lead) => lead.id === state.selectedLeadId);
      document.getElementById('selectedLead').textContent = selected ? (selected.company?.name || selected.id) : '未選択';
    }
`;

export function renderClientLeadsScript(): string {
  return 'window.SalesAiRenderAreas = window.SalesAiRenderAreas || {}; window.SalesAiRenderAreas.renderLeads = ' + LEADS_RENDER_SOURCE + ';';
}
