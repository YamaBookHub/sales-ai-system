import type { DashboardPageMode } from './dashboard-page-mode';

export function renderUrlSearchEntry(): string {
  return `
    <div class="today-entry" data-ui="today-entry">
      <div><strong>今日の営業から始める</strong><span>期限超過、確認待ち、返信ありをまとめて確認</span></div>
      <button class="primary" onclick="location.href='/today'">今日の営業を開く</button>
    </div>`;
}

export function renderCandidateSearchSection(pageMode: DashboardPageMode): string {
  return `<section class="search-console" data-ui="candidate-search">
        <details class="search-drawer"${pageMode === 'url-search' ? ' open' : ''}>
          <summary>
            <span>取得元・URL取り込み</span>
            <span class="muted"><span class="when-closed">開く</span><span class="when-open">閉じる</span></span>
          </summary>
          <div class="body">
            <div class="search-block">
              <div class="search-block-title">取得元</div>
              <div class="source-selector">
                <select id="sourcePlatform" onchange="onSourcePlatformChange()">
                  <option value="campfire">CAMPFIRE</option>
                  <option value="makuake">Makuake</option>
                  <option value="green_funding" disabled>GREEN FUNDING（準備中）</option>
                </select>
                <span id="sourcePlatformStatus" class="status muted">CAMPFIREの募集中プロジェクトに対応</span>
              </div>
            </div>
            <div class="search-block">
              <div class="search-block-title">URL直接取り込み</div>
              <div class="direct-import">
                <input id="campfireUrl" placeholder="https://camp-fire.jp/projects/.../view" />
                <button class="primary" onclick="importCampfire()">このURLを取り込む</button>
                <span id="importStatus" class="status"></span>
              </div>
            </div>
            <div class="search-block">
              <div class="search-block-title">候補を探す</div>
              <div class="quick-search">
                <input id="campfireSearchKeyword" placeholder="キーワード・商品名で候補検索" />
              </div>
              <div class="search-filter-row">
                <select id="campfireSearchCategory" data-source-field="campfire">
                  <option value="">カテゴリを取得中</option>
                </select>
                <select id="campfireFetchLimit">
                  <option value="10">取得上限 10件</option>
                  <option value="50">取得上限 50件</option>
                  <option value="100">取得上限 100件</option>
                </select>
                <select id="campfireSearchStatus">
                  <option value="active">募集中のみ</option>
                  <option value="endingSoon">終了間近順</option>
                </select>
                <select id="campfireEndingSoonDays">
                  <option value="7">7日以内</option>
                  <option value="14" selected>14日以内</option>
                  <option value="20">20日以内</option>
                  <option value="30">30日以内</option>
                </select>
                <select id="campfireSearchProfileProjectRange" data-source-field="campfire">
                  <option value="">過去プロジェクト すべて</option>
                  <option value="0:0">初回のみ</option>
                  <option value="1:3">1〜3件</option>
                  <option value="4:9">4〜9件</option>
                  <option value="10:29">10〜29件</option>
                  <option value="30:99">30〜99件</option>
                  <option value="100:">100件以上</option>
                </select>
              </div>
              <div class="search-actions">
                <button class="primary" onclick="searchCampfireCandidates()">検索</button>
                <button id="stopSearchButton" onclick="cancelCampfireSearch()" disabled>検索停止</button>
                <button onclick="clearCampfireSearch()">クリア</button>
                <span id="campfireSearchStatusText" class="status"></span>
              </div>
            </div>
          </div>
        </details>
      </section>`;
}

export function renderCandidateListSection(): string {
  return `<section>
        <div class="section-head">
          <h2>候補URL一覧</h2>
          <div class="toolbar">
            <span id="campfireCandidateCount" class="status muted">未検索</span>
            <details class="display-filter">
              <summary>表示条件</summary>
              <div class="result-filter-panel">
                <select id="campfireResultLimit" onchange="renderCampfireCandidates()">
                  <option value="10">最大表示 10件</option>
                  <option value="50">最大表示 50件</option>
                  <option value="100">最大表示 100件</option>
                </select>
                <select id="campfireDisplayStatus" onchange="renderCampfireCandidates()">
                  <option value="">公開状態 すべて</option>
                  <option value="active">募集中のみ</option>
                  <option value="endingSoon">終了間近</option>
                </select>
                <select id="campfireDisplayEndingSoonDays" onchange="renderCampfireCandidates()">
                  <option value="7">7日以内</option>
                  <option value="14" selected>14日以内</option>
                  <option value="20">20日以内</option>
                  <option value="30">30日以内</option>
                </select>
                <select id="campfireDisplayAmountRange" onchange="renderCampfireCandidates()">
                  <option value="">支援額 すべて</option>
                  <option value="0:500000">50万円未満</option>
                  <option value="500000:1000000">50万〜100万円</option>
                  <option value="1000000:3000000">100万〜300万円</option>
                  <option value="3000000:5000000">300万〜500万円</option>
                  <option value="5000000:10000000">500万〜1,000万円</option>
                  <option value="10000000:">1,000万円以上</option>
                </select>
                <select id="campfireDisplaySupporterRange" onchange="renderCampfireCandidates()">
                  <option value="">サポーター すべて</option>
                  <option value="0:30">30人未満</option>
                  <option value="30:50">30〜50人</option>
                  <option value="50:100">50〜100人</option>
                  <option value="100:300">100〜300人</option>
                  <option value="300:500">300〜500人</option>
                  <option value="500:">500人以上</option>
                </select>
                <select id="campfireDisplayProfileProjectRange" onchange="renderCampfireCandidates()">
                  <option value="">過去プロジェクト すべて</option>
                  <option value="0:0">初回のみ</option>
                  <option value="1:3">1〜3件</option>
                  <option value="4:9">4〜9件</option>
                  <option value="10:29">10〜29件</option>
                  <option value="30:99">30〜99件</option>
                  <option value="100:">100件以上</option>
                </select>
              </div>
            </details>
            <button onclick="bulkImportVisibleCandidates()" id="bulkImportButton" disabled>表示中を一括取り込み</button>
            <span id="bulkImportStatus" class="status"></span>
          </div>
        </div>
        <div class="body">
          <div id="campfireCandidates">
            <div class="ui-state-empty">検索すると候補URLがここに表示されます。</div>
          </div>
        </div>
      </section>`;
}
