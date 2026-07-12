const MAIL_RENDER_SOURCE = String.raw`function renderMails() {
      const mails = selectedLeadMails();
      if (!state.selectedLeadId) {
        document.getElementById('mailRows').innerHTML = '<tr><td colspan="3" class="muted">対象を選択すると、その企業・案件の作成・レビュー履歴が表示されます</td></tr>';
        renderMailProjectComparison(null, null);
        document.getElementById('selectedMail').textContent = '未選択';
        populateMailEditor(null);
        renderRejectReason(null);
        updateMailButtons(null);
        renderMailStageCards(null);
        void loadMailEngagement(null);
        syncMailWorkTab(null);
        return;
      }
      if (state.selectedMailId && !mails.some((mail) => mail.id === state.selectedMailId)) {
        state.selectedMailId = null;
      }
      if (!state.selectedMailId && mails.length) {
        state.selectedMailId = mails[0].id;
      }
      const rows = mails.map((mail) => {
        return '<tr data-selected="' + (mail.id === state.selectedMailId) + '" data-mail-id="' + escapeAttr(mail.id) + '" tabindex="0" onclick="selectMail(this.dataset.mailId)" onkeydown="selectMailFromKeyboard(event)">' +
          '<td><div class="clip">' + escapeHtml(mail.subject) + '</div><div class="muted clip">' + escapeHtml(mail.company?.name || '') + '</div></td>' +
          '<td><span class="badge">' + escapeHtml(labelMailStatus(mail.status)) + '</span></td>' +
          '<td>' + formatDate(mail.createdAt) + '</td>' +
        '</tr>';
      }).join('');
      document.getElementById('mailRows').innerHTML = rows || '<tr><td colspan="3" class="muted">この対象の作成・レビュー履歴は0件です。メール生成で新規作成できます。</td></tr>';
      renderDashboardSortMarks('mail', ['subject', 'status', 'createdAt']);
      const selected = mails.find((mail) => mail.id === state.selectedMailId);
      const lead = state.leads.find((item) => item.id === state.selectedLeadId);
      renderMailProjectComparison(lead, selected);
      document.getElementById('selectedMail').textContent = selected ? labelMailStatus(selected.status) : '未選択';
      populateMailEditor(selected);
      renderRejectReason(selected);
      updateMailButtons(selected);
      renderMailStageCards(selected);
      void loadMailEngagement(selected);
      syncMailWorkTab(selected);
    }
`;

export function renderClientMailScript(): string {
  return 'window.SalesAiRenderAreas = window.SalesAiRenderAreas || {}; window.SalesAiRenderAreas.renderMails = ' + MAIL_RENDER_SOURCE + ';';
}
