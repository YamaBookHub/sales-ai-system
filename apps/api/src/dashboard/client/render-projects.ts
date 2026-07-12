const PROJECTS_RENDER_SOURCE = String.raw`function renderCampfireCandidates() {
      const container = document.getElementById('campfireCandidates');
      if (!state.campfireCandidates.length) {
        const message = state.campfireSearchJobId
          ? '取得中です。見つかった候補から順にここへ追加されます。'
          : '検索すると候補URLがここに表示されます。';
        container.innerHTML = '<div class="' + (state.campfireSearchJobId ? 'ui-state-loading' : 'ui-state-empty') + '">' + escapeHtml(message) + '</div>';
        document.getElementById('bulkImportButton').disabled = true;
        return;
      }
      const visibleCandidates = getVisibleCandidateEntries();
      const importableCount = visibleCandidates.filter(({ item }) => isCandidateImportable(item)).length;
      document.getElementById('bulkImportButton').disabled = !importableCount;
      document.getElementById('campfireCandidateCount').textContent =
        '表示 ' + visibleCandidates.length + '件 / 取得 ' + state.campfireCandidates.length + '件 / 取込可能 ' + importableCount + '件';
      if (!visibleCandidates.length) {
        container.innerHTML = '<div class="ui-state-empty">表示条件に合う候補がありません。条件をゆるめてください。</div>';
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
                '<th class="sortable" onclick="toggleDashboardSort(&quot;candidate&quot;,&quot;title&quot;)" style="width:34%">案件<span id="candidateSort-title" class="sort-mark"></span></th>' +
                '<th class="sortable" onclick="toggleDashboardSort(&quot;candidate&quot;,&quot;amount&quot;)" style="width:110px">支援額<span id="candidateSort-amount" class="sort-mark"></span></th>' +
                '<th class="sortable" onclick="toggleDashboardSort(&quot;candidate&quot;,&quot;supporterCount&quot;)" style="width:96px">支援者<span id="candidateSort-supporterCount" class="sort-mark"></span></th>' +
                '<th class="sortable" onclick="toggleDashboardSort(&quot;candidate&quot;,&quot;daysLeft&quot;)" style="width:76px">残り<span id="candidateSort-daysLeft" class="sort-mark"></span></th>' +
                '<th class="sortable" onclick="toggleDashboardSort(&quot;candidate&quot;,&quot;profileProjectCount&quot;)" style="width:96px">過去PJ<span id="candidateSort-profileProjectCount" class="sort-mark"></span></th>' +
                '<th class="sortable" onclick="toggleDashboardSort(&quot;candidate&quot;,&quot;category&quot;)" style="width:130px">カテゴリ<span id="candidateSort-category" class="sort-mark"></span></th>' +
                '<th class="sortable" onclick="toggleDashboardSort(&quot;candidate&quot;,&quot;importStatus&quot;)" style="width:130px">取込状態<span id="candidateSort-importStatus" class="sort-mark"></span></th>' +
                '<th style="width:76px">URL</th>' +
                '<th style="width:104px">操作</th>' +
              '</tr>' +
            '</thead>' +
            '<tbody>' + rows + '</tbody>' +
          '</table>' +
        '</div>';
      renderDashboardSortMarks('candidate', ['title', 'amount', 'supporterCount', 'daysLeft', 'profileProjectCount', 'category', 'importStatus']);
    }
`;

export function renderClientProjectsScript(): string {
  return 'window.SalesAiRenderProjects = { renderCampfireCandidates: ' + PROJECTS_RENDER_SOURCE + ' };';
}
