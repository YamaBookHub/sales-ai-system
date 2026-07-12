import type { DashboardPageMode } from './dashboard-page-mode';
import { getDashboardPageShell } from './shared-shell';
import { renderSharedStyles } from './shared-styles';
import { renderCandidateListSection, renderCandidateSearchSection, renderUrlSearchEntry } from './url-search-page';
import { renderMailLeadQueue, renderMailWorkspace } from './mail-workspace-page';
import { renderClientViewRulesScript } from '../client/view-rules';
import { renderClientApiScript } from '../client/api-client';
import { renderClientProjectsScript } from '../client/render-projects';
import { renderClientLeadsScript } from '../client/render-leads';
import { renderClientMailScript } from '../client/render-mail';

export function renderDashboardPage(pageMode: DashboardPageMode) {
    const shell = getDashboardPageShell(pageMode);

    return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Sales AI System</title>
  ${renderSharedStyles('dashboard')}
</head>
<body class="${shell.bodyClass}" data-ui-page="${pageMode}">
  <header>
    <h1>${shell.heading}</h1>
    <div class="toolbar">
      <span id="apiStatus" class="status ui-state-loading" aria-live="polite">API確認中</span>
      <div class="top-nav" data-ui="top-nav">
        <button onclick="location.href='/today'">今日の営業 <span class="nav-badge" data-nav-badge="today" hidden></span></button>
        <button onclick="location.href='/replies'">返信</button>
        <button${shell.urlSearchButtonClass} onclick="location.href='/'">候補を探す</button>
        <button onclick="location.href='/leads-view'">営業案件 <span class="nav-badge" data-nav-badge="leads" hidden></span></button>
        <button${shell.mailWorkspaceButtonClass} onclick="location.href='/mail-workspace'">作成・レビュー <span class="nav-badge" data-nav-badge="mail" hidden></span></button>
      </div>
      <button onclick="loadAll()">更新</button>
    </div>
  </header>
  <main>
    <section class="workflow" aria-label="業務ステップ">
      <div class="workflow-step">
        <strong><span class="step-label">1</span>候補を探す</strong>
        <span>手入力・検索・一覧表示・取り込み</span>
      </div>
      <div class="workflow-step">
        <strong><span class="step-label">2</span>営業案件</strong>
        <span>状態、詳細、AI分析を確認</span>
      </div>
      <div class="workflow-step">
        <strong><span class="step-label">3</span>作成・レビュー</strong>
        <span>生成、本文確認、レビュー、承認</span>
      </div>
    </section>
    ${pageMode === 'url-search' ? renderUrlSearchEntry() : ''}

    <div class="left">
      ${renderCandidateSearchSection(pageMode)}

      ${renderMailLeadQueue()}
    </div>

    <div class="right">
      ${renderCandidateListSection()}

      ${renderMailWorkspace()}
    </div>
  </main>
  <footer>
    <span>Sales AI System</span>
  </footer>

  <script>
${renderClientViewRulesScript()}
${renderClientApiScript()}
${renderClientProjectsScript()}
${renderClientLeadsScript()}
${renderClientMailScript()}
    const state = {
      leads: [],
      mails: [],
      mailTemplates: [],
      checklist: [],
      aiGenerations: [],
      checklistComplete: false,
      selectedLeadId: null,
      selectedMailId: null,
      selectedTemplateKey: '',
      mailEngagement: null,
      mailEngagementLoadingId: null,
      campfireCategories: [],
      campfireCandidates: [],
      candidateImportStatus: {},
      mailWorkTabKey: '',
      mailEditorBaseline: null,
      campfireSearchTimerId: null,
      campfireSearchPollTimerId: null,
      campfireSearchStartedAt: null,
      campfireSearchJobId: null,
      currentSourcePlatform: null,
      leadSort: { key: '', direction: 'asc' },
      candidateSort: { key: '', direction: 'asc' },
      mailSort: { key: 'createdAt', direction: 'desc' }
    };
    const SELECTED_LEAD_STORAGE_KEY = 'salesAiSystem.selectedLeadId';

    async function api(path, options = {}) {
      return window.SalesAiApi.request(path, options, { includeOperatorEmail: true });
    }

    function setStatus(id, message, type = '') {
      const element = document.getElementById(id);
      element.textContent = message;
      const stateClass = ['loading', 'empty', 'error'].includes(type) ? 'ui-state-' + type : type;
      element.className = 'status ' + stateClass;
    }

    function selectedSourcePlatform() {
      return document.getElementById('sourcePlatform')?.value || 'campfire';
    }

    function sourcePlatformLabel(value = selectedSourcePlatform()) {
      const labels = {
        campfire: 'CAMPFIRE',
        makuake: 'Makuake',
        green_funding: 'GREEN FUNDING'
      };
      return labels[value] || value;
    }

    function onSourcePlatformChange() {
      const platform = selectedSourcePlatform();
      const sourceChanged = state.currentSourcePlatform && state.currentSourcePlatform !== platform;
      const urlInput = document.getElementById('campfireUrl');
      const categorySearch = document.getElementById('campfireSearchCategory');
      const searchStatus = document.getElementById('campfireSearchStatus');
      const profileSearch = document.getElementById('campfireSearchProfileProjectRange');
      const profileDisplay = document.getElementById('campfireDisplayProfileProjectRange');
      if (urlInput) {
        urlInput.placeholder = ({
          campfire: 'https://camp-fire.jp/projects/.../view',
          makuake: 'https://www.makuake.com/project/.../'
        })[platform] || sourcePlatformLabel(platform) + 'のプロジェクトURL（準備中）';
      }
      toggleSourceField(categorySearch, platform === 'campfire');
      toggleSourceField(profileSearch, platform === 'campfire');
      if (searchStatus) {
        searchStatus.disabled = !['campfire', 'makuake'].includes(platform);
        searchStatus.style.display = ['campfire', 'makuake'].includes(platform) ? '' : 'none';
        if (!['campfire', 'makuake'].includes(platform)) searchStatus.value = 'active';
      }
      toggleSourceField(profileDisplay, platform === 'campfire');
      void loadCampfireCategories();
      if (sourceChanged) {
        state.campfireCandidates = [];
        state.candidateImportStatus = {};
        renderCampfireCandidates();
      }
      state.currentSourcePlatform = platform;
      if (platform === 'campfire' || platform === 'makuake') {
        const note = platform === 'campfire'
          ? '募集中プロジェクト、カテゴリ、過去PJ条件に対応'
          : '募集中プロジェクト、キーワード検索に対応（カテゴリ・過去PJ条件は対象外）';
        setStatus('sourcePlatformStatus', sourcePlatformLabel(platform) + 'の' + note, 'muted');
        return;
      }
      setStatus('sourcePlatformStatus', sourcePlatformLabel(platform) + 'は取得元として準備中です', 'warn');
    }

    function toggleSourceField(element, enabled) {
      if (!element) return;
      element.disabled = !enabled;
      element.style.display = enabled ? '' : 'none';
      if (!enabled) element.value = '';
    }

    function ensureSupportedSourcePlatform(statusId) {
      if (['campfire', 'makuake'].includes(selectedSourcePlatform())) return true;
      setStatus(statusId, sourcePlatformLabel() + 'は準備中です。現在はCAMPFIRE/Makuakeのみ検索・取り込みできます。', 'warn');
      return false;
    }

    function startCampfireSearchTimer(hasProfileProjectSearch) {
      stopCampfireSearchTimer();
      state.campfireSearchStartedAt = Date.now();
      const note = hasProfileProjectSearch ? ' / 過去PJ条件あり' : '';
      setStatus('campfireSearchStatusText', '検索中' + note, 'warn');
      state.campfireSearchTimerId = window.setInterval(() => {
        const element = document.getElementById('campfireSearchStatusText');
        if (element) element.dataset.elapsed = formatElapsed(Date.now() - state.campfireSearchStartedAt);
      }, 1000);
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
      setStatus('apiStatus', 'API確認中', 'loading');
      try {
        const [leads, mails] = await Promise.all([
          api('/api/leads?limit=200'),
          api('/api/mails?limit=200')
        ]);
        state.leads = leads.items || [];
        state.mails = mails.items || [];
        renderNavigationBadges();
        restoreSelectedLead();
        syncCandidateImportStatuses();
        populateSourceFilterOptions('mailLeadSourceFilter');
        const selectedMail = ensureSelectedMailForLead();
        renderLeads();
        renderMailLeadSummary();
        renderMails();
        populateMailEditor(selectedMail);
        renderLeadDetail();
        if (state.selectedLeadId) void loadAiAnalysis();
        if (!state.campfireCategories.length) void loadCampfireCategories();
        onSourcePlatformChange();
        void loadTemplates();
        setStatus('apiStatus', 'API接続OK', 'ok');
      } catch (error) {
        setStatus('apiStatus', 'API接続に失敗しました: ' + error.message + '。更新を押して再試行してください。', 'error');
      }
    }

    async function loadTemplates() {
      try {
        const result = await api('/api/mails/templates');
        state.mailTemplates = Array.isArray(result) ? result : (result.items || []);
        renderTemplateOptions();
        const selected = state.selectedTemplateKey || state.mailTemplates[0]?.key || '';
        if (selected) await loadTemplateForEdit(selected);
        else clearTemplateForm(false);
      } catch (error) {
        setStatus('templateStatus', '定型文の読み込みに失敗しました: ' + error.message, 'error');
      }
    }

    function renderTemplateOptions() {
      const select = document.getElementById('templateManagerList');
      if (!select) return;
      const current = state.selectedTemplateKey || select.value;
      select.innerHTML = '<option value="">新規作成</option>' +
        state.mailTemplates.map((template) =>
          '<option value="' + escapeAttr(template.key) + '">' +
          escapeHtml((template.name || template.key) + ' / ' + (template.channel || 'email')) +
          '</option>'
        ).join('');
      if (state.mailTemplates.some((template) => template.key === current)) {
        select.value = current;
      }
      renderTemplateGenerationOptions();
    }

    function renderTemplateGenerationOptions() {
      const select = document.getElementById('templateKey');
      if (!select) return;
      const current = select.value;
      const lead = state.leads.find((item) => item.id === state.selectedLeadId);
      const channel = templateChannelForLead(lead);
      const defaultOptions = [
        ['normal', '通常版'],
        ['sns_video_ad', 'SNS動画・広告版']
      ];
      const channelTemplates = state.mailTemplates
        .filter((template) => template.channel === channel && template.isActive !== false);
      select.innerHTML = defaultOptions.map(([value, label]) =>
        '<option value="' + escapeAttr(value) + '">' + escapeHtml(label) + '</option>'
      ).join('') + channelTemplates.map((template) =>
        '<option value="' + escapeAttr(template.key) + '">' + escapeHtml(template.name || template.key) + '</option>'
      ).join('');
      if (Array.from(select.options).some((option) => option.value === current)) {
        select.value = current;
      } else if (channelTemplates.length) {
        select.value = channelTemplates[0].key;
      }
    }

    function templateChannelForLead(lead) {
      const method = lead?.sendMethod || suggestSendMethod(lead || {});
      if (method === 'site_message' || method === 'サイト内メッセージ') return 'site_message';
      if (method === 'contact_form' || method === '問い合わせフォーム' || method === 'フォーム') return 'contact_form';
      return 'email';
    }

    async function loadTemplateForEdit(key) {
      if (!key) {
        clearTemplateForm();
        return;
      }
      setStatus('templateStatus', '読み込み中', 'warn');
      try {
        const template = await api('/api/mails/templates/' + encodeURIComponent(key));
        state.selectedTemplateKey = template.key;
        setTemplateForm(template);
        renderTemplateOptions();
        setStatus('templateStatus', '読み込み完了', 'ok');
      } catch (error) {
        setStatus('templateStatus', '定型文の読み込みに失敗しました: ' + error.message, 'error');
      }
    }

    function setTemplateForm(template) {
      document.getElementById('templateManagerKey').value = template?.key || '';
      document.getElementById('templateManagerName').value = template?.name || '';
      document.getElementById('templateManagerChannel').value = template?.channel || 'email';
      document.getElementById('templateManagerSubject').value = template?.subject || '';
      document.getElementById('templateManagerDescription').value = template?.description || '';
      document.getElementById('templateManagerBody').value = template?.body || '';
      document.getElementById('templateManagerActive').checked = template?.isActive !== false;
    }

    function clearTemplateForm(showStatus = true) {
      state.selectedTemplateKey = '';
      const select = document.getElementById('templateManagerList');
      if (select) select.value = '';
      setTemplateForm({ channel: 'email', isActive: true });
      if (showStatus) setStatus('templateStatus', '新規定型文', 'ok');
    }

    async function saveTemplate() {
      const key = fieldValue('templateManagerKey').trim();
      const name = fieldValue('templateManagerName').trim();
      const body = fieldValue('templateManagerBody').trim();
      if (!key || !name || !body) {
        setStatus('templateStatus', 'Key、名前、本文を入力してください', 'warn');
        return;
      }
      setStatus('templateStatus', '保存中', 'warn');
      try {
        const template = await api('/api/mails/templates', {
          method: 'POST',
          body: JSON.stringify({
            key,
            name,
            channel: fieldValue('templateManagerChannel') || 'email',
            subject: fieldValue('templateManagerSubject'),
            body,
            description: fieldValue('templateManagerDescription'),
            isActive: document.getElementById('templateManagerActive').checked
          })
        });
        state.selectedTemplateKey = template.key;
        await loadTemplates();
        setStatus('templateStatus', '定型文を保存しました', 'ok');
      } catch (error) {
        setStatus('templateStatus', '定型文の保存に失敗しました: ' + error.message, 'error');
      }
    }

    async function importTemplates() {
      const raw = fieldValue('templateImportJson').trim();
      if (!raw) {
        setStatus('templateStatus', '取り込むJSONを入力してください', 'warn');
        return;
      }
      let templates;
      try {
        const parsed = JSON.parse(raw);
        templates = Array.isArray(parsed) ? parsed : parsed.templates;
      } catch (error) {
        setStatus('templateStatus', 'JSON形式を確認してください', 'error');
        return;
      }
      if (!Array.isArray(templates) || !templates.length) {
        setStatus('templateStatus', 'テンプレート配列がありません', 'warn');
        return;
      }
      setStatus('templateStatus', '取り込み中', 'warn');
      try {
        const result = await api('/api/mails/templates/import', {
          method: 'POST',
          body: JSON.stringify({ templates })
        });
        document.getElementById('templateImportJson').value = '';
        state.selectedTemplateKey = '';
        await loadTemplates();
        setStatus('templateStatus', (result.imported || templates.length) + '件の定型文を取り込みました', 'ok');
      } catch (error) {
        setStatus('templateStatus', '定型文の取り込みに失敗しました: ' + error.message, 'error');
      }
    }

    async function loadCampfireCategories() {
      const select = document.getElementById('campfireSearchCategory');
      if (selectedSourcePlatform() !== 'campfire') {
        state.campfireCategories = [];
        select.innerHTML = '<option value="">カテゴリなし</option>';
        select.value = '';
        return;
      }
      try {
        const result = await api('/api/projects/categories?source=' + encodeURIComponent(selectedSourcePlatform()));
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
        const result = await api('/api/projects/import', {
          method: 'POST',
          body: JSON.stringify({ source: selectedSourcePlatform(), url })
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
      const source = selectedSourcePlatform();
      const profileProjectRange = source === 'campfire' ? rangeFieldValue('campfireSearchProfileProjectRange') : { min: null, max: null };
      const hasProfileProjectSearch = profileProjectRange.min !== null || profileProjectRange.max !== null;
      const desiredLimit = numberFieldValue('campfireFetchLimit') || 10;
      stopCampfireSearchPoll();
      state.campfireSearchJobId = null;
      state.campfireCandidates = [];
      startCampfireSearchTimer(hasProfileProjectSearch);
      document.getElementById('stopSearchButton').disabled = false;
      document.getElementById('campfireCandidateCount').textContent = '検索中';
      renderCampfireCandidates();
      try {
        const job = await api('/api/projects/search-jobs', {
          method: 'POST',
          body: JSON.stringify(compactPayload({
            source,
            keyword: fieldValue('campfireSearchKeyword'),
            category: source === 'campfire' ? fieldValue('campfireSearchCategory') : '',
            profileProjectMin: profileProjectRange.min,
            profileProjectMax: profileProjectRange.max,
            limit: desiredLimit,
            status: ['campfire', 'makuake'].includes(source) ? (fieldValue('campfireSearchStatus') || 'active') : 'active',
            endingSoonDays: numberFieldValue('campfireEndingSoonDays') || 14
          }))
        });
        state.campfireSearchJobId = job.id;
        applySearchJob(job);
        pollCampfireSearchJob();
      } catch (error) {
        const elapsed = currentSearchElapsedText();
        stopCampfireSearchTimer();
        stopCampfireSearchPoll();
        document.getElementById('stopSearchButton').disabled = true;
        setStatus('campfireSearchStatusText', error.message + (elapsed ? ' / ' + elapsed : ''), 'error');
        document.getElementById('campfireCandidateCount').textContent = '検索失敗';
      }
    }

    async function pollCampfireSearchJob() {
      if (!state.campfireSearchJobId) return;
      try {
        const job = await api('/api/projects/search-jobs/' + state.campfireSearchJobId);
        applySearchJob(job);
        if (job.status === 'running') {
          state.campfireSearchPollTimerId = window.setTimeout(pollCampfireSearchJob, 1200);
          return;
        }
        stopCampfireSearchTimer();
        stopCampfireSearchPoll();
        document.getElementById('stopSearchButton').disabled = true;
        setStatus('campfireSearchStatusText', (job.status === 'failed' ? '検索失敗' : job.status === 'cancelled' ? '検索停止' : '検索完了') + ' / ' + currentSearchElapsedText(), job.status === 'failed' ? 'error' : 'ok');
      } catch (error) {
        stopCampfireSearchTimer();
        stopCampfireSearchPoll();
        document.getElementById('stopSearchButton').disabled = true;
        setStatus('campfireSearchStatusText', error.message, 'error');
      }
    }

    function applySearchJob(job) {
      state.campfireCandidates = mergeCandidates(state.campfireCandidates, job.items || []);
      syncCandidateImportStatuses();
      renderCampfireCandidates();
      const importableCount = state.campfireCandidates.filter((item) => isCandidateImportable(item)).length;
      const runningText = job.status === 'running' ? '取得中' : job.status === 'cancelled' ? '停止済み' : job.status === 'failed' ? '失敗' : '完了';
      const elapsed = currentSearchElapsedText();
      const message = runningText + ' / 候補 ' + state.campfireCandidates.length + '件 / 取込可能 ' + importableCount + '件' + (job.searchedLimit ? ' / 確認中 ' + job.searchedLimit + '件枠' : '');
      document.getElementById('campfireCandidateCount').textContent = message;
      if (job.status !== 'running') {
        setStatus('campfireSearchStatusText', (job.status === 'completed' ? '検索完了' : runningText) + (elapsed ? ' / ' + elapsed : ''), job.status === 'failed' ? 'error' : 'ok');
      }
    }

    async function cancelCampfireSearch() {
      if (!state.campfireSearchJobId) return;
      document.getElementById('stopSearchButton').disabled = true;
      setStatus('campfireSearchStatusText', '検索停止中', 'warn');
      try {
        const job = await api('/api/projects/search-jobs/' + state.campfireSearchJobId + '/cancel', { method: 'POST' });
        applySearchJob(job);
      } catch (error) {
        setStatus('campfireSearchStatusText', error.message, 'error');
      } finally {
        stopCampfireSearchTimer();
        stopCampfireSearchPoll();
      }
    }

    function stopCampfireSearchPoll() {
      if (state.campfireSearchPollTimerId) {
        window.clearTimeout(state.campfireSearchPollTimerId);
        state.campfireSearchPollTimerId = null;
      }
    }

    function mergeCandidates(current, next) {
      const map = new Map(current.map((item, index) => [stableCandidateKey(item, index), item]));
      next.forEach((item, index) => map.set(stableCandidateKey(item, current.length + index), item));
      return Array.from(map.values());
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
      document.getElementById('campfireSearchStatus').value = 'active';
      document.getElementById('campfireEndingSoonDays').value = '14';
      document.getElementById('campfireSearchProfileProjectRange').value = '';
      document.getElementById('campfireResultLimit').value = '10';
      document.getElementById('campfireDisplayStatus').value = '';
      document.getElementById('campfireDisplayEndingSoonDays').value = '14';
      document.getElementById('campfireDisplayAmountRange').value = '';
      document.getElementById('campfireDisplaySupporterRange').value = '';
      document.getElementById('campfireDisplayProfileProjectRange').value = '';
      state.campfireCandidates = [];
      state.candidateImportStatus = {};
      stopCampfireSearchTimer();
      stopCampfireSearchPoll();
      state.campfireSearchStartedAt = null;
      state.campfireSearchJobId = null;
      document.getElementById('stopSearchButton').disabled = true;
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
        const result = await api('/api/projects/import', {
          method: 'POST',
          body: JSON.stringify({ source: selectedSourcePlatform(), url: candidate.url })
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
      importableEntries.forEach(({ item }) => setCandidateImportStatus(item, 'importing', 'サーバー側で取り込み中'));
      renderCampfireCandidates();
      setStatus('bulkImportStatus', 'サーバー側で一括取り込み・AI分析中', 'warn');
      try {
        const result = await api('/api/projects/bulk-import', {
          method: 'POST',
          body: JSON.stringify({
            source: selectedSourcePlatform(),
            urls: importableEntries.map(({ item }) => item.url),
            analyze: true,
            importConcurrency: 4,
            analysisConcurrency: 3
          })
        });
        const resultByUrl = {};
        (result.items || []).forEach((row) => {
          if (row.originalUrl) resultByUrl[row.originalUrl] = row;
          if (row.url) resultByUrl[row.url] = row;
        });
        const analysisByLeadId = Object.fromEntries((result.analysisItems || []).map((item) => [item.leadId, item]));
        importableEntries.forEach(({ item }) => {
          const row = resultByUrl[item.url];
          if (!row) return setCandidateImportStatus(item, 'failed', '結果を確認できませんでした');
          if (row.status === 'imported') {
            const analysis = row.leadId ? analysisByLeadId[row.leadId] : null;
            const message = analysis?.status === 'failed'
              ? '取り込み済み / AI分析失敗: ' + (analysis.message || '')
              : '取り込み・AI分析済み';
            setCandidateImportStatus(item, 'imported', message, row.leadId);
            state.selectedLeadId = row.leadId || state.selectedLeadId;
          } else {
            setCandidateImportStatus(item, 'failed', row.message || '取り込みに失敗しました');
          }
        });
        setStatus(
          'bulkImportStatus',
          '一括取り込み完了: 取込 ' + result.imported + '件 / 取込失敗 ' + result.failed + '件 / AI分析 ' + result.analyzed + '件' + (result.analysisFailed ? ' / AI分析失敗 ' + result.analysisFailed + '件' : ''),
          result.failed || result.analysisFailed ? 'warn' : 'ok'
        );
        await loadAll();
        renderCampfireCandidates();
      } catch (error) {
        importableEntries.forEach(({ item }) => setCandidateImportStatus(item, 'failed', error.message));
        setStatus('bulkImportStatus', error.message, 'error');
        renderCampfireCandidates();
      }
    }

    async function analyzeLead(options = {}) {
      if (!state.selectedLeadId) return;
      document.getElementById('aiAnalysis').innerHTML = '<div class="status warn">AI分析中</div>';
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
        setStatus('mailStatus', 'AI下書き生成中（OpenAI API未使用）', 'warn');
      try {
        const templateKey = document.getElementById('templateKey').value;
        const result = await api('/api/ai/leads/' + state.selectedLeadId + '/email-draft', {
          method: 'POST',
          body: JSON.stringify({ templateKey, tone: 'low_sales_pressure' })
        });
        state.selectedMailId = result.email.id;
        populateMailEditor(result.email, true);
        setStatus('mailStatus', 'AI下書き生成完了（OpenAI API未使用）', 'ok');
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
        populateMailEditor(result.email, true);
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
      const subject = document.getElementById('subject').value;
      const body = document.getElementById('body').value;
      setStatus('mailStatus', '保存中', 'warn');
      try {
        await api('/api/mails/' + state.selectedMailId, {
          method: 'PATCH',
          body: JSON.stringify({
            subject,
            body
          })
        });
        setMailEditorBaseline(state.selectedMailId, subject, body);
        renderSemanticConsistencyResult(null);
        setStatus('mailStatus', '保存しました', 'ok');
        await loadAll();
      } catch (error) {
        setStatus('mailStatus', error.message, 'error');
      }
    }

    async function createMaterialTrackingLink() {
      const mail = currentSelectedMail();
      if (!mail || !['draft', 'rejected'].includes(mail.status)) {
        setStatus('materialLinkStatus', '下書きまたは棄却後のメールを選択してください', 'warn');
        return;
      }
      const originalUrl = fieldValue('materialUrl');
      if (!originalUrl) {
        setStatus('materialLinkStatus', '会社資料URLを入力してください', 'warn');
        return;
      }
      try {
        const parsedUrl = new URL(originalUrl);
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('HTTPまたはHTTPSのURLを入力してください');
      } catch (error) {
        setStatus('materialLinkStatus', error.message, 'warn');
        return;
      }
      const button = document.getElementById('materialLinkButton');
      if (button) button.disabled = true;
      setStatus('materialLinkStatus', '追跡リンクを作成中', 'warn');
      try {
        const result = await api('/api/t/links', {
          method: 'POST',
          body: JSON.stringify({ emailId: mail.id, originalUrl, label: 'company_material' })
        });
        const trackingUrl = new URL(result.trackingPath, window.location.origin).toString();
        const body = document.getElementById('body');
        if (body && !body.value.includes(trackingUrl)) {
          body.value = body.value.trim() + '\n\n会社資料: ' + trackingUrl;
          updateMailEditorDirtyState();
        }
        document.getElementById('materialUrl').value = '';
        state.mailEngagement = null;
        setStatus('materialLinkStatus', '追跡リンクを本文へ追加しました。本文を保存してください', 'ok');
        void loadMailEngagement(mail);
      } catch (error) {
        setStatus('materialLinkStatus', '追跡リンクの作成に失敗しました: ' + error.message, 'error');
      } finally {
        updateMailButtons(currentSelectedMail());
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
      if (!(await confirmDraftConsistency())) return;
      await transitionMail('request-review', 'レビュー依頼済み');
    }

    async function confirmDraftConsistency() {
      if (!state.selectedMailId) return false;
      try {
        const result = await api('/api/mails/' + state.selectedMailId + '/consistency');
        renderDraftConsistencyWarning(result);
        if (!result.hasWarnings) return true;
        setStatus('mailStatus', '本文に' + result.warnings.length + '件の注意があります', 'warn');
        return window.confirm('本文に' + result.warnings.length + '件の注意があります。内容を確認したうえでレビュー依頼しますか？');
      } catch (error) {
        renderDraftConsistencyWarning({ warnings: [{ message: error.message }], hasWarnings: true });
        setStatus('mailStatus', '本文チェックに失敗したため、レビュー依頼を停止しました', 'error');
        return false;
      }
    }

    async function checkMailSemanticConsistency() {
      const mail = currentSelectedMail();
      if (!mail) return;
      if (hasUnsavedMailEditorChanges()) {
        setStatus('mailStatus', '先に本文を保存してからAI意味確認を実行してください', 'warn');
        return;
      }
      const button = document.getElementById('semanticCheckButton');
      if (button) button.disabled = true;
      setStatus('mailStatus', 'AIで案件との意味整合性を確認中', 'warn');
      try {
        const result = await api('/api/ai/mails/' + mail.id + '/semantic-consistency', { method: 'POST' });
        renderSemanticConsistencyResult(result);
        setStatus('mailStatus', 'AI意味確認が完了しました。人間の本文確認は必要です。', result.matchesProject ? 'ok' : 'warn');
      } catch (error) {
        renderSemanticConsistencyResult({ error: error.message });
        setStatus('mailStatus', 'AI意味確認に失敗しました。本文と案件情報を人間が確認してください。', 'error');
      } finally {
        updateMailButtons(currentSelectedMail());
      }
    }

    function renderSemanticConsistencyResult(result) {
      const container = document.getElementById('semanticConsistencyResult');
      if (!container) return;
      if (!result) {
        container.hidden = true;
        container.innerHTML = '';
        return;
      }
      if (result.error) {
        container.className = 'semantic-consistency-result warn';
        container.innerHTML = '<strong>AI意味確認は未完了</strong><span>' + escapeHtml(result.error) + '</span>';
        container.hidden = false;
        return;
      }
      const suspected = (result.suspectedForeignFacts || []).map((item) => '<li>' + escapeHtml(item) + '</li>').join('');
      const matches = result.matchesProject === true && !suspected;
      const confidence = Math.round(Math.max(0, Math.min(1, Number(result.confidence) || 0)) * 100);
      container.className = 'semantic-consistency-result ' + (matches ? '' : 'warn');
      container.innerHTML =
        '<strong>AI意味確認（助言）</strong>' +
        '<span>' + escapeHtml(matches ? '案件との大きな不一致は見つかりませんでした。' : '案件との不一致または別案件情報の混入を確認してください。') + '</span>' +
        '<span>' + escapeHtml(result.reason || '理由未取得') + ' 信頼度 ' + confidence + '%</span>' +
        (suspected ? '<ul>' + suspected + '</ul>' : '') +
        '<span class="muted">この結果で人間の確認は自動完了しません。</span>';
      container.hidden = false;
    }

    function renderDraftConsistencyWarning(result) {
      const container = document.getElementById('draftConsistencyWarning');
      if (!container) return;
      if (!result?.hasWarnings) {
        container.hidden = true;
        container.innerHTML = '';
        return;
      }
      const warnings = (result.warnings || []).map((item) => '<li>' + escapeHtml(item.message) + '</li>').join('');
      container.innerHTML = '<strong>レビュー前の注意</strong><ul>' + warnings + '</ul>';
      container.hidden = false;
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

    function visibleMailLeads() {
      const keywordField = document.getElementById('mailLeadKeyword');
      const statusField = document.getElementById('mailLeadStatusFilter');
      const sourceField = document.getElementById('mailLeadSourceFilter');
      const keyword = keywordField ? keywordField.value.trim().toLowerCase() : '';
      const status = statusField ? statusField.value : '';
      const sourceFilter = sourceField ? sourceField.value : '';
      const leads = state.leads.filter((lead) => {
        const project = lead.project || {};
        const company = lead.company?.name || lead.companyId;
        const sourceLabel = projectPlatformLabel(project);
        const haystack = [company, project.title, sourceLabel, project.url, lead.reason].filter(Boolean).join(' ').toLowerCase();
        if (keyword && !haystack.includes(keyword)) return false;
        if (status && lead.status !== status) return false;
        if (sourceFilter && sourceLabel !== sourceFilter) return false;
        return true;
      });
      return sortDashboardItems(leads, state.leadSort, dashboardLeadSortValue);
    }

    function renderLeads() {
      return window.SalesAiRenderAreas.renderLeads();
    }
    function updateNextLeadButton(leads = visibleMailLeads()) {
      const button = document.getElementById('nextLeadButton');
      if (!button) return;
      const currentIndex = leads.findIndex((lead) => lead.id === state.selectedLeadId);
      button.disabled = !state.selectedLeadId || !leads.length;
      button.title = currentIndex === leads.length - 1 ? '対象一覧の最後です' : '現在の表示順で次の案件を選択します';
    }

    function hasUnsavedMailEditorChanges() {
      const subject = document.getElementById('subject');
      const body = document.getElementById('body');
      const baseline = state.mailEditorBaseline;
      if (!state.selectedMailId || !subject || !body || !baseline || baseline.mailId !== state.selectedMailId) return false;
      return subject.value !== baseline.subject || body.value !== baseline.body;
    }

    function confirmDiscardUnsavedMailChanges() {
      return !hasUnsavedMailEditorChanges() || window.confirm('件名または本文に未保存の変更があります。破棄して移動しますか？');
    }

    function selectNextLead() {
      const leads = visibleMailLeads();
      const currentIndex = leads.findIndex((lead) => lead.id === state.selectedLeadId);
      if (!leads.length || currentIndex < 0 || currentIndex >= leads.length - 1) {
        setStatus('mailStatus', '対象一覧の最後です', 'warn');
        return;
      }
      if (!confirmDiscardUnsavedMailChanges()) return;
      selectLead(leads[currentIndex + 1].id, { discardConfirmed: true });
      const selectedRow = document.querySelector('#leadRows tr[data-selected="true"]');
      selectedRow?.scrollIntoView({ block: 'nearest' });
      setStatus('mailStatus', '次の案件を選択しました', 'ok');
    }

    function renderMailLeadSummary() {
      const container = document.getElementById('mailLeadSummary');
      if (!container) return;
      const lead = state.leads.find((item) => item.id === state.selectedLeadId);
      if (!lead) {
        renderTemplateGenerationOptions();
        container.innerHTML = '<div class="muted">上の営業対象一覧から、メールを作成・確認する案件を選択してください。</div>';
        const next = document.getElementById('mailNextAction');
        if (next) next.textContent = '';
        return;
      }
      const company = lead.company || {};
      const project = lead.project || {};
      renderTemplateGenerationOptions();
      const mails = selectedLeadMails();
      const mail = mails[0];
      const next = document.getElementById('mailNextAction');
      if (next) next.textContent = mailNextActionText(lead, mail);
      container.innerHTML =
        '<div class="detail-grid">' +
          detailItem('企業名', company.name || lead.companyId) +
          detailItem('案件名', project.title || '未取得') +
          detailItem('取得元', projectPlatformLabel(project)) +
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

    async function loadMailEngagement(mail) {
      const container = document.getElementById('mailMaterialEngagement');
      if (!mail) {
        state.mailEngagement = null;
        state.mailEngagementLoadingId = null;
        renderMailEngagement(null);
        return;
      }
      if (state.mailEngagement?.emailId === mail.id) {
        renderMailEngagement(state.mailEngagement);
        return;
      }
      if (state.mailEngagementLoadingId === mail.id) return;
      state.mailEngagementLoadingId = mail.id;
      if (container) renderMailEngagement(null, 'loading');
      try {
        const result = await api('/api/t/mails/' + encodeURIComponent(mail.id) + '/engagement');
        if (state.selectedMailId !== mail.id) return;
        state.mailEngagement = result;
        renderMailEngagement(result);
      } catch (error) {
        if (state.selectedMailId !== mail.id) return;
        state.mailEngagement = null;
        renderMailEngagement(null, error.message);
      } finally {
        if (state.mailEngagementLoadingId === mail.id) state.mailEngagementLoadingId = null;
      }
    }

    function renderMailEngagement(engagement, stateMessage = '') {
      const container = document.getElementById('mailMaterialEngagement');
      if (!container) return;
      if (stateMessage === 'loading') {
        container.innerHTML = '<span class="muted">会社資料の閲覧状況を確認中...</span>';
        return;
      }
      if (stateMessage) {
        container.innerHTML = '<span class="status error">資料閲覧状況を取得できませんでした: ' + escapeHtml(stateMessage) + '</span>';
        return;
      }
      if (!engagement) {
        container.innerHTML = '<span class="muted">会社資料の閲覧状況: メールを選択してください</span>';
        return;
      }
      const angle = materialAppointmentAngleLabel(engagement.appointmentAngle);
      const badgeClass = engagement.appointmentAngle === 'hot' ? 'ok' : engagement.appointmentAngle === 'interested' ? 'warn' : 'muted';
      const links = (engagement.trackedLinks || []).map((link) =>
        '<div>' + escapeHtml(link.label || '資料リンク') + ': ' + escapeHtml(String(link.clickCount || 0)) + '回' +
        (link.lastClickedAt ? ' / 最終 ' + escapeHtml(formatDate(link.lastClickedAt)) : '') + '</div>'
      ).join('');
      container.innerHTML =
        '<div class="mail-material-head"><strong>会社資料の閲覧状況</strong><span class="badge ' + badgeClass + '">' + escapeHtml(angle) + '</span></div>' +
        '<div class="mail-material-meta">' +
          '<div><span>閲覧</span><strong>' + (engagement.materialViewed ? 'あり' : 'なし') + '</strong></div>' +
          '<div><span>閲覧回数</span><strong>' + escapeHtml(String(engagement.materialClickCount || 0)) + '回</strong></div>' +
          '<div><span>最終閲覧</span><strong>' + escapeHtml(engagement.lastMaterialClickAt ? formatDate(engagement.lastMaterialClickAt) : '未閲覧') + '</strong></div>' +
        '</div>' +
        (links ? '<div class="mail-material-links">' + links + '</div>' : '<div class="muted" style="margin-top:8px">追跡対象の会社資料リンクはまだありません。</div>');
    }

    function materialAppointmentAngleLabel(value) {
      return ({ none: 'アポ角度: 未確認', interested: 'アポ角度: 高め', hot: 'アポ角度: 非常に高い' })[value] || 'アポ角度: 未確認';
    }

    function renderCampfireCandidates() {
      return window.SalesAiRenderProjects.renderCampfireCandidates();
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
            message: existing.company?.name ? existing.company.name + 'で登録済み' : '営業案件に登録済み',
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
          message: existing.company?.name ? existing.company.name + 'で登録済み' : '営業案件に登録済み',
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

    function stableCandidateKey(candidate, fallbackIndex) {
      return candidateImportKey(candidate) || candidate?.url || candidate?.title || 'candidate-' + fallbackIndex;
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
      return sortDashboardItems(
        state.campfireCandidates
        .map((item, originalIndex) => ({ item, originalIndex }))
        .filter(({ item }) => matchesCampfireDisplayFilters(item)),
        state.candidateSort,
        candidateEntrySortValue
      )
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
      if (status === 'endingSoon' && (item.daysLeft === null || item.daysLeft > (numberFieldValue('campfireDisplayEndingSoonDays') || 14))) return false;
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
        container.innerHTML = '<div class="muted">営業案件から案件を選択してください</div>';
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
        renderAiEvidenceSection('使用した事実', output.factsUsed, 'facts') +
        renderAiEvidenceSection(isMailDraft ? 'AIの推測' : '補足', output.assumptions, 'assumptions') +
        renderAiEvidenceSection('注意点', output.riskFlags, 'risk') +
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
        container.innerHTML = '<div class="muted">営業案件から案件を選択してください</div>';
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
          detailItem('取得元', projectPlatformLabel(project)) +
          detailItem('カテゴリ', project.category || '未取得') +
          detailItem('支援額', formatCurrency(project.amount)) +
          detailItem('支援者数', formatNumber(project.supporterCount) + '人') +
          detailItem('残り日数', project.daysLeft === null || project.daysLeft === undefined ? '未取得' : project.daysLeft + '日') +
          detailItem('地域', project.location || company.location || '未取得') +
          detailItem('実行者PJ数', company.sourceProjectCount === null || company.sourceProjectCount === undefined ? '未取得' : company.sourceProjectCount + '件') +
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
      const projectSource = leadProjectSource(lead);
      const productStrengths = compatibleMemoItems(output.productStrengths, projectSource);
      const appeal = isMemoTextCompatible(placeholders.appeal, projectSource) ? placeholders.appeal : '';
      const targetUser = isMemoTextCompatible(placeholders.targetUser, projectSource) ? placeholders.targetUser : '';
      return {
        contactMemo: [
          output.readiness?.label ? '判断: ' + output.readiness.label + (typeof output.readiness.score === 'number' ? ' / ' + output.readiness.score + '点' : '') : '',
          memoList('次に確認', output.nextChecks)
        ].filter(Boolean).join('\\n\\n'),
        brandAnalysisMemo: [
          output.summary,
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

    function renderLeadManagementForm(lead) {
      const memo = suggestedLeadMemos(lead);
      const project = lead.project || {};
      return '<div class="row">' +
          '<label>選択案件の詳細</label>' +
          '<div class="grid-2">' +
            formInput('leadCompanyName', '企業名', lead.company?.name || '') +
            formSelect('leadProjectSource', '取得元', projectPlatformType(project), [
              ['campfire', 'CAMPFIRE'],
              ['makuake', 'Makuake'],
              ['green_funding', 'GREEN FUNDING'],
              ['other', 'その他']
            ]) +
            formInput('leadProjectTitle', '案件名', project.title) +
            formInput('leadProjectUrl', 'プロジェクトURL', project.url) +
            formInput('leadProjectCategory', 'カテゴリ', project.category) +
            formSelect('leadProjectStatus', '公開状態', project.status || 'unknown', [
              ['unknown', '未確認'],
              ['discovered', '発見'],
              ['active', '公開中'],
              ['ended', '終了'],
              ['suspended', '停止']
            ]) +
            formInput('leadProjectAmount', '支援額', project.amount || 0, '', 'number') +
            formInput('leadProjectSupporterCount', '支援者数', project.supporterCount || 0, '', 'number') +
            formInput('leadProjectTargetAmount', '目標金額', project.targetAmount || '', '', 'number') +
            formInput('leadProjectEndDate', '終了日時', toDateTimeLocal(project.endDate), '', 'datetime-local') +
          '</div>' +
        '</div>' +
        '<div class="row">' +
          '<label for="leadProjectDescription">プロジェクト説明</label>' +
          '<textarea id="leadProjectDescription" style="min-height:100px">' + escapeHtml(project.description || '') + '</textarea>' +
        '</div>' +
        '<div class="row">' +
          '<label>営業状態</label>' +
          '<div class="grid-2">' +
            formSelect('leadStatus', '状態', lead.status, [
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
            formSelect('leadPriority', '優先度', lead.priority, [
              ['high', '高'],
              ['medium', '中'],
              ['low', '低']
            ]) +
          '</div>' +
        '</div>' +
        '<div class="row">' +
          '<label>連絡先確認</label>' +
          '<div class="grid-2">' +
            formInput('leadContactEmail', 'メールアドレス', lead.contactEmail) +
            formInput('leadContactFormUrl', '問い合わせフォームURL', lead.contactFormUrl) +
            formInput('leadSiteMessageUrl', 'サイト内メッセージURL', lead.siteMessageUrl) +
            formSelect('leadSendMethod', '送信手段', lead.sendMethod || suggestSendMethod(lead), [
              ['', '未定'],
              ['メール', 'メール'],
              ['問い合わせフォーム', '問い合わせフォーム'],
              ['サイト内メッセージ', 'サイト内メッセージ'],
              ['その他', 'その他']
            ]) +
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
      return window.SalesAiRenderAreas.renderMails();
    }
    function renderMailProjectComparison(lead, mail) {
      const container = document.getElementById('mailProjectComparison');
      if (!container) return;
      const project = lead?.project || {};
      const companyName = lead ? (lead.company?.name || lead.companyId || '未取得') : '未選択';
      const projectTitle = project.title || '未取得';
      const description = project.description ? truncateText(project.description, 220) : '未取得';
      const amount = project.amount === null || project.amount === undefined || Number(project.amount) === 0
        ? '未取得'
        : formatCurrency(project.amount);
      const supporters = project.supporterCount === null || project.supporterCount === undefined || Number(project.supporterCount) === 0
        ? '未取得'
        : formatNumber(project.supporterCount) + '人';
      const daysLeft = project.daysLeft === null || project.daysLeft === undefined ? '未取得' : project.daysLeft + '日';
      const url = project.url
        ? '<a href="' + escapeAttr(project.url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(project.url) + '</a>'
        : '未取得';
      container.innerHTML =
        '<h4>案件情報と見比べる</h4>' +
        '<div class="mail-comparison-list">' +
          mailComparisonItem('会社名', companyName, false, 'selectedLead') +
          mailComparisonItem('メール状態', mail ? labelMailStatus(mail.status) : '未選択', false, 'selectedMail') +
          mailComparisonItem('案件名', projectTitle) +
          mailComparisonItem('商品説明', description) +
          mailComparisonItem('取得元', lead ? projectPlatformLabel(project) : '未取得') +
          mailComparisonItem('URL', url, true) +
          mailComparisonItem('支援額', amount) +
          mailComparisonItem('支援者数', supporters) +
          mailComparisonItem('残り日数', daysLeft) +
        '</div>' +
        '<div class="row"><label>次に押すボタン</label><div id="mailActionGuide" class="detail-text">' + escapeHtml(mailActionGuideText(mail)) + '</div></div>';
    }

    function mailComparisonItem(label, value, allowHtml = false, id = '') {
      return '<div class="mail-comparison-item"><span>' + escapeHtml(label) + '</span><span' + (id ? ' id="' + escapeAttr(id) + '"' : '') + '>' + (allowHtml ? value : escapeHtml(value)) + '</span></div>';
    }

    function mailContactSummary(lead) {
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
        .sort((a, b) => compareDashboardValues(mailSortValue(a, state.mailSort.key), mailSortValue(b, state.mailSort.key)) * (state.mailSort.direction === 'desc' ? -1 : 1));
    }

    function toggleDashboardSort(table, key) {
      const stateKey = table + 'Sort';
      const current = state[stateKey];
      if (current?.key === key) {
        current.direction = current.direction === 'asc' ? 'desc' : 'asc';
      } else {
        state[stateKey] = { key, direction: defaultDashboardSortDirection(key) };
      }
      if (table === 'lead') renderLeads();
      if (table === 'candidate') renderCampfireCandidates();
      if (table === 'mail') renderMails();
    }

    function renderDashboardSortMarks(table, keys) {
      const current = state[table + 'Sort'];
      keys.forEach((key) => {
        const element = document.getElementById(table + 'Sort-' + key);
        if (!element) return;
        element.textContent = current?.key === key ? (current.direction === 'asc' ? '▲' : '▼') : '';
      });
    }

    function sortDashboardItems(items, sort, valueGetter) {
      return window.SalesAiViewRules.sortItems(items, sort, valueGetter, window.SalesAiViewRules.compareValues);
    }

    function compareDashboardValues(left, right) {
      return window.SalesAiViewRules.compareValues(left, right);
    }

    function defaultDashboardSortDirection(key) {
      return ['score', 'amount', 'supporterCount', 'daysLeft', 'profileProjectCount', 'createdAt'].includes(key) ? 'desc' : 'asc';
    }

    function dashboardLeadSortValue(lead, key) {
      const project = lead.project || {};
      const values = {
        company: lead.company?.name || lead.companyId || '',
        project: project.title || '',
        source: projectPlatformLabel(project),
        status: labelLeadStatus(lead.status),
        score: Number(lead.score || 0),
        priority: priorityRank(lead.priority)
      };
      return values[key] ?? '';
    }

    function candidateEntrySortValue(entry, key) {
      const item = entry.item || {};
      const importState = getCandidateImportState(item);
      const values = {
        title: item.title || '',
        amount: Number(item.amount || 0),
        supporterCount: Number(item.supporterCount || 0),
        daysLeft: item.daysLeft === null || item.daysLeft === undefined ? null : Number(item.daysLeft),
        profileProjectCount: item.profileProjectCount === null || item.profileProjectCount === undefined ? null : Number(item.profileProjectCount),
        category: item.category || '',
        importStatus: labelCandidateImportStatus(importState.status)
      };
      return values[key] ?? '';
    }

    function mailSortValue(mail, key) {
      const values = {
        subject: mail.subject || '',
        status: labelMailStatus(mail.status),
        createdAt: new Date(mail.createdAt).getTime() || 0
      };
      return values[key] ?? '';
    }

    function priorityRank(priority) {
      return ({ high: 3, medium: 2, low: 1 })[priority] || 0;
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

    function populateMailEditor(mail, force = false) {
      const mailId = mail?.id || null;
      if (!force && state.mailEditorBaseline?.mailId === mailId) {
        updateMailEditorDirtyState();
        return;
      }
      const subject = document.getElementById('subject');
      const body = document.getElementById('body');
      if (subject) subject.value = mail?.subject || '';
      if (body) body.value = mail?.body || '';
      setMailEditorBaseline(mailId, mail?.subject || '', mail?.body || '');
    }

    function setMailEditorBaseline(mailId, subject, body) {
      state.mailEditorBaseline = { mailId: mailId || null, subject: subject || '', body: body || '' };
      updateMailEditorDirtyState();
    }

    function setMailEditorBaselineFromInputs() {
      setMailEditorBaseline(
        state.selectedMailId,
        document.getElementById('subject')?.value || '',
        document.getElementById('body')?.value || ''
      );
    }

    function updateMailEditorDirtyState() {
      const element = document.getElementById('mailEditorSaveState');
      if (!element) return;
      if (!state.selectedMailId) {
        element.textContent = 'メール未選択';
        element.className = 'status muted';
        return;
      }
      const dirty = hasUnsavedMailEditorChanges();
      element.textContent = dirty ? '未保存' : '保存済み';
      element.className = 'status ' + (dirty ? 'warn' : 'ok');
      const semanticButton = document.getElementById('semanticCheckButton');
      const mail = currentSelectedMail();
      if (semanticButton) {
        semanticButton.disabled = !mail || !['draft', 'rejected'].includes(mail.status) || dirty;
        semanticButton.title = dirty ? '先に本文を保存してください' : 'OpenAI APIを使って案件との意味整合性を確認します';
      }
    }

    function clearMailEditor() {
      state.selectedMailId = null;
      state.checklist = [];
      state.checklistComplete = false;
      populateMailEditor(null, true);
      document.getElementById('selectedMail').textContent = '未選択';
      renderDraftConsistencyWarning(null);
      renderSemanticConsistencyResult(null);
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

    function selectLeadFromKeyboard(event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      selectLead(event.currentTarget.dataset.leadId);
    }

    function selectLead(id, options = {}) {
      if (id !== state.selectedLeadId && !options.discardConfirmed && !confirmDiscardUnsavedMailChanges()) return false;
      state.selectedLeadId = id;
      persistSelectedLead(id);
      state.aiGenerations = [];
      state.checklist = [];
      state.checklistComplete = false;
      const latestMail = ensureSelectedMailForLead();
      renderLeads();
      renderSelectedMailWorkspace();
      if (latestMail) {
        selectMail(latestMail.id, { discardConfirmed: true });
      } else {
        clearMailEditor();
        renderMails();
      }
      renderSelectedMailWorkspace();
      renderLeadDetail();
      renderAiAnalysis();
      void loadAiAnalysis();
      return true;
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

    function switchMailWorkTab(tab) {
      document.querySelectorAll('[data-mail-work-tab]').forEach((button) => {
        const active = button.dataset.mailWorkTab === tab;
        button.dataset.active = active ? 'true' : 'false';
        button.setAttribute('aria-selected', active ? 'true' : 'false');
        button.tabIndex = active ? 0 : -1;
      });
      document.querySelectorAll('[data-mail-work-panel]').forEach((panel) => {
        panel.dataset.active = panel.dataset.mailWorkPanel === tab ? 'true' : 'false';
      });
    }

    function defaultMailWorkTab(mail) {
      if (!mail) return 'overview';
      if (['draft', 'rejected'].includes(mail.status)) return 'draft';
      if (['in_review', 'approved'].includes(mail.status)) return 'review';
      return 'history';
    }

    function syncMailWorkTab(mail) {
      const key = (state.selectedLeadId || 'no-lead') + ':' + (mail?.id || 'no-mail') + ':' + (mail?.status || 'none');
      if (state.mailWorkTabKey === key) return;
      state.mailWorkTabKey = key;
      switchMailWorkTab(defaultMailWorkTab(mail));
    }

    async function saveLeadManagement() {
      if (!state.selectedLeadId) return;
      setStatus('leadSaveStatus', '保存中', 'warn');
      const payload = {
        companyName: fieldValue('leadCompanyName'),
        projectSource: fieldValue('leadProjectSource'),
        projectTitle: fieldValue('leadProjectTitle'),
        projectUrl: fieldValue('leadProjectUrl'),
        projectStatus: fieldValue('leadProjectStatus'),
        projectAmount: numberFieldValue('leadProjectAmount'),
        projectSupporterCount: numberFieldValue('leadProjectSupporterCount'),
        projectTargetAmount: optionalNumberFieldValue('leadProjectTargetAmount'),
        projectEndDate: dateTimeValue('leadProjectEndDate') || undefined,
        projectCategory: fieldValue('leadProjectCategory'),
        projectDescription: fieldValue('leadProjectDescription'),
        status: fieldValue('leadStatus'),
        priority: fieldValue('leadPriority'),
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

    function selectMailFromKeyboard(event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      selectMail(event.currentTarget.dataset.mailId);
    }

    function selectMail(id, options = {}) {
      if (id !== state.selectedMailId && !options.discardConfirmed && !confirmDiscardUnsavedMailChanges()) return false;
      state.selectedMailId = id;
      renderDraftConsistencyWarning(null);
      renderSemanticConsistencyResult(null);
      state.checklist = [];
      state.checklistComplete = false;
      const mail = selectedLeadMails().find((item) => item.id === id) || state.mails.find((item) => item.id === id);
      if (!mail) {
        clearMailEditor();
        return false;
      }
      populateMailEditor(mail, true);
      renderMails();
      renderChecklist();
      void loadChecklist();
      return true;
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
      const semanticButton = document.getElementById('semanticCheckButton');
      if (semanticButton) {
        const dirty = hasUnsavedMailEditorChanges();
        semanticButton.disabled = !mail || !['draft', 'rejected'].includes(mail.status) || dirty;
        semanticButton.title = dirty ? '先に本文を保存してください' : 'OpenAI APIを使って案件との意味整合性を確認します';
      }
      document.getElementById('reviewButton').disabled = !mail || mail.status !== 'draft';
      document.getElementById('reReviewButton').disabled = !mail || mail.status !== 'rejected';
      document.getElementById('rejectButton').disabled = !mail || !['in_review', 'approved'].includes(mail.status);
      document.getElementById('approveButton').disabled = !mail || mail.status !== 'in_review' || !state.checklistComplete;
      document.getElementById('queueButton').disabled = !mail || mail.status !== 'approved' || !state.checklistComplete;
      document.getElementById('markSentButton').disabled = !mail || !['approved', 'queued'].includes(mail.status);
      document.getElementById('replyButton').disabled = !mail || !['queued', 'sent'].includes(mail.status);
      const materialLinkButton = document.getElementById('materialLinkButton');
      if (materialLinkButton) materialLinkButton.disabled = !mail || !['draft', 'rejected'].includes(mail.status);
      updatePrimaryMailAction(mail);
      const guide = document.getElementById('mailActionGuide');
      if (guide) guide.textContent = mailActionGuideText(mail);
    }

    function updatePrimaryMailAction(mail) {
      const buttonIds = ['generateButton', 'reviewButton', 'reReviewButton', 'approveButton', 'queueButton', 'replyButton'];
      buttonIds.forEach((id) => document.getElementById(id)?.classList.remove('primary'));
      const primaryButtonId = primaryMailActionButtonId(mail);
      const primaryButton = primaryButtonId ? document.getElementById(primaryButtonId) : null;
      if (primaryButton && !primaryButton.disabled) primaryButton.classList.add('primary');
    }

    function primaryMailActionButtonId(mail) {
      if (!mail) return canGenerateMail() ? 'generateButton' : '';
      if (mail.status === 'draft') return 'reviewButton';
      if (mail.status === 'rejected') return 'reReviewButton';
      if (mail.status === 'in_review' && state.checklistComplete) return 'approveButton';
      if (mail.status === 'approved' && state.checklistComplete) return 'queueButton';
      if (mail.status === 'sent') return 'replyButton';
      return '';
    }

    function renderMailStageCards(mail) {
      const container = document.getElementById('mailStageCards');
      if (!container) return;
      const lead = state.leads.find((item) => item.id === state.selectedLeadId);
      const checkedCount = state.checklist.filter((item) => item.checked).length;
      const checklistText = state.checklist.length
        ? checkedCount + ' / ' + state.checklist.length
        : '未読み込み';
      renderMailContextBar(lead, mail, checkedCount, state.checklist.length);
      container.innerHTML =
        stageCard('対象', lead ? (lead.company?.name || '選択済み') : '未選択') +
        stageCard('メール', mail ? labelMailStatus(mail.status) : '未生成') +
        stageCard('チェック', mail ? checklistText : '未選択') +
        stageCard('次操作', mailActionGuideText(mail));
    }

    function renderMailContextBar(lead, mail, checkedCount, checklistCount) {
      const container = document.getElementById('mailContextBar');
      if (!container) return;
      const checklistText = !mail
        ? '未選択'
        : checklistCount
          ? checkedCount + ' / ' + checklistCount + ' 完了'
          : '未読み込み';
      container.innerHTML =
        mailContextItem('会社', lead ? (lead.company?.name || lead.companyId) : '未選択') +
        mailContextItem('メール状態', mail ? labelMailStatus(mail.status) : '未生成') +
        mailContextItem('チェック', checklistText) +
        mailContextItem('次操作', mailActionGuideText(mail));
    }

    function mailContextItem(label, value) {
      return '<div class="mail-context-item"><span class="mail-context-label">' + escapeHtml(label) + '</span><strong class="mail-context-value">' + escapeHtml(value || '-') + '</strong></div>';
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
      if (mail.status === 'approved') return state.checklistComplete ? '送信待ちにする' : '送信前チェックを完了して送信待ちにする';
      if (mail.status === 'queued') return '送信待ち。送信したら送信済みに更新';
      if (mail.status === 'sent') return '返信が来たら返信メモへ記録';
      if (mail.status === 'failed') return '失敗理由を確認して再試行';
      return '状態を確認';
    }

    function formatDate(value) {
      if (!value) return '';
      return new Date(value).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    }

    function renderNavigationBadges() {
      setNavigationBadge('today', countTodayItems());
      setNavigationBadge('leads', state.leads.length);
      setNavigationBadge('mail', state.mails.filter((mail) => ['draft', 'in_review', 'approved', 'queued'].includes(mail.status)).length);
    }

    function setNavigationBadge(key, count) {
      const element = document.querySelector('[data-nav-badge="' + key + '"]');
      if (!element) return;
      const value = Number(count) || 0;
      element.textContent = value > 99 ? '99+' : String(value);
      element.hidden = value === 0;
      element.setAttribute('aria-label', value + '件');
    }

    function countTodayItems() {
      const today = tokyoDateKey(new Date());
      return state.leads.filter((lead) => {
        const dueKey = tokyoDateKey(lead.nextActionAt || lead.nextFollowUpAt);
        const mail = latestNavigationMail(lead);
        return (dueKey && dueKey <= today) || lead.status === 'replied' || ['failed', 'draft', 'approved', 'queued'].includes(mail?.status);
      }).length;
    }

    function latestNavigationMail(lead) {
      return state.mails
        .filter((mail) => mail.leadId === lead.id || mail.lead?.id === lead.id || mail.companyId === lead.companyId || mail.company?.id === lead.companyId)
        .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))[0];
    }

    function tokyoDateKey(value) {
      if (!value) return '';
      const date = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(date.getTime())) return '';
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
      const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
      return values.year + '-' + values.month + '-' + values.day;
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

    function populateSourceFilterOptions(selectId) {
      const select = document.getElementById(selectId);
      if (!select) return;
      const current = select.value;
      const labels = Array.from(new Set(state.leads.map((lead) => projectPlatformLabel(lead.project || {})).filter(Boolean))).sort();
      select.innerHTML = '<option value="">取得元 すべて</option>' +
        labels.map((label) => '<option value="' + escapeAttr(label) + '">' + escapeHtml(label) + '</option>').join('');
      if (labels.includes(current)) select.value = current;
    }

    function labelLeadStatus(status) {
      return window.SalesAiViewRules.labelLeadStatus(status);
    }

    function labelPriority(priority) {
      return window.SalesAiViewRules.labelPriority(priority);
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

    function formSelect(id, label, selectedValue, options) {
      return '<div class="row">' +
        '<label for="' + escapeHtml(id) + '">' + escapeHtml(label) + '</label>' +
        '<select id="' + escapeHtml(id) + '">' +
          options.map(([value, text]) => '<option value="' + escapeAttr(value) + '" ' + (value === selectedValue ? 'selected' : '') + '>' + escapeHtml(text) + '</option>').join('') +
        '</select>' +
      '</div>';
    }

    function fieldValue(id) {
      return document.getElementById(id)?.value.trim() || '';
    }

    function dateTimeValue(id) {
      const value = fieldValue(id);
      return value ? new Date(value).toISOString() : '';
    }

    function numberFieldValue(id) {
      const value = Number(fieldValue(id) || 0);
      return Number.isFinite(value) ? value : 0;
    }

    function optionalNumberFieldValue(id) {
      const raw = fieldValue(id);
      if (!raw) return undefined;
      const value = Number(raw);
      return Number.isFinite(value) ? value : undefined;
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
      return window.SalesAiViewRules.truncateText(value, maxLength);
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

    window.addEventListener('beforeunload', (event) => {
      if (!hasUnsavedMailEditorChanges()) return;
      event.preventDefault();
      event.returnValue = '';
    });

    loadAll();
  </script>
</body>
</html>`;
}
