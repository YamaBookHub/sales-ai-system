export type SharedStylePage = 'dashboard' | 'leads' | 'today' | 'replies';

export function renderSharedStyles(page: SharedStylePage): string {
  switch (page) {
    case 'dashboard':
      return `<style>
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
      --space-1: 4px;
      --space-2: 8px;
      --space-3: 12px;
      --space-4: 16px;
      --radius-control: 6px;
      --radius-panel: 4px;
      --radius-nav: 8px;
      --control-height: 34px;
      --font-body: 14px;
      --font-heading: 18px;
      --shadow-panel: none;
    }
    * { box-sizing: border-box; }
    :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif;
      font-size: var(--font-body);
    }
    header {
      min-height: 56px;
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
    h1 { font-size: var(--font-heading); margin: 0; letter-spacing: 0; }
    .top-nav {
      display: inline-flex;
      gap: 4px;
      padding: 4px;
      border: 1px solid var(--line);
      border-radius: var(--radius-nav);
      background: #f4f6f8;
    }
    .top-nav button {
      border-color: transparent;
      background: transparent;
    }
    .top-nav button.primary {
      background: var(--accent);
      color: white;
    }
    .nav-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 18px;
      height: 18px;
      margin-left: 4px;
      padding: 0 5px;
      border-radius: 9px;
      background: var(--warn);
      color: white;
      font-size: 11px;
      line-height: 1;
      font-variant-numeric: tabular-nums;
    }
    .nav-badge[hidden] { display: none; }
    button, input, select, textarea {
      font: inherit;
    }
    button {
      border: 1px solid var(--line);
      background: var(--panel);
      color: var(--text);
      height: var(--control-height);
      border-radius: var(--radius-control);
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
      grid-template-columns: minmax(0, 1fr);
      gap: 10px;
      padding: 12px;
      min-height: calc(100vh - 56px);
    }
    .workflow {
      display: none;
    }
    section {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: var(--radius-panel);
      min-width: 0;
    }
    .left, .right { display: grid; gap: 10px; align-content: start; min-width: 0; }
    .section-head {
      padding: 10px 12px;
      border-bottom: 1px solid var(--line);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    h2 { font-size: 15px; margin: 0; }
    .body { padding: 12px; }
    .row { display: grid; gap: 8px; margin-bottom: 12px; }
    label { color: var(--muted); font-size: 12px; }
    input, select, textarea {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 4px;
      background: white;
      color: var(--text);
      padding: 9px 10px;
    }
    textarea { min-height: 300px; resize: vertical; line-height: 1.8; }
    .toolbar { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    .muted { color: var(--muted); }
    .status { font-size: 12px; min-height: 18px; }
    .status.ok { color: var(--ok); }
    .status.warn { color: var(--warn); }
    .status.error { color: var(--danger); }
    .ui-state-loading { color: var(--muted); }
    .ui-state-empty { color: var(--muted); }
    .ui-state-error { color: var(--danger); font-weight: 600; }
    .notice {
      border: 1px solid #f0d4aa;
      border-left: 4px solid var(--warn);
      background: #fff8ee;
      border-radius: 6px;
      padding: 8px 10px;
      margin-bottom: 12px;
      line-height: 1.6;
    }
    .notice strong { display: block; margin-bottom: 4px; }
    .draft-consistency-warning {
      margin-bottom: 12px;
      border: 1px solid #e1c48c;
      border-radius: 6px;
      background: #fff9ed;
      color: #6f4700;
      padding: 10px 12px;
      line-height: 1.6;
    }
    .draft-consistency-warning ul { margin: 6px 0 0; padding-left: 20px; }
    .semantic-consistency-result {
      display: grid;
      gap: 4px;
      margin-bottom: 12px;
      border: 1px solid var(--line);
      border-left: 4px solid var(--accent);
      border-radius: 6px;
      background: #f5fbf9;
      padding: 10px 12px;
      line-height: 1.6;
    }
    .semantic-consistency-result.warn { border-left-color: var(--warn); background: #fff9ed; }
    .semantic-consistency-result ul { margin: 2px 0 0; padding-left: 20px; }
    .today-entry {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 12px 14px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--panel);
    }
    .today-entry strong, .today-entry span { display: block; }
    .today-entry span { margin-top: 3px; color: var(--muted); font-size: 12px; }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    th, td {
      border-bottom: 1px solid var(--line);
      padding: 9px 10px;
      text-align: left;
      vertical-align: top;
    }
    th {
      color: var(--muted);
      font-size: 12px;
      font-weight: 600;
      background: #fafbfc;
    }
    th.sortable {
      cursor: pointer;
      user-select: none;
      white-space: nowrap;
    }
    th.sortable:hover {
      color: var(--accent);
      background: #eef7f4;
    }
    .sort-mark {
      margin-left: 4px;
      color: var(--accent);
      font-size: 12px;
    }
    .table-scroll {
      overflow: auto;
      border-top: 0;
    }
    .table-scroll table {
      margin: 0;
    }
    .table-scroll thead th {
      position: sticky;
      top: 0;
      z-index: 2;
      border-bottom: 1px solid var(--line);
    }
    .lead-list-scroll {
      max-height: 280px;
    }
    .mail-history-scroll {
      max-height: 220px;
    }
    tr[data-selected="true"] { background: #edf7f5; }
    tr:hover { background: #f7faf9; }
    .clip { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .badge {
      display: inline-flex;
      align-items: center;
      min-height: 22px;
      padding: 2px 8px;
      border-radius: 4px;
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
      gap: 10px;
      padding: 0;
      margin: 0;
      list-style: none;
    }
    .checklist label {
      display: grid;
      grid-template-columns: 24px 1fr;
      gap: 10px;
      align-items: center;
      min-height: 46px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: #fafbfc;
      padding: 10px 12px;
      color: var(--text);
      font-size: 13px;
      line-height: 1.5;
      cursor: pointer;
      user-select: none;
    }
    .checklist label:hover {
      border-color: #b8c7d1;
      background: #f4f8f7;
    }
    .checklist label:has(input:checked) {
      border-color: #9fc9c1;
      background: #eef8f6;
    }
    .checklist input {
      width: 20px;
      height: 20px;
      margin: 0;
      accent-color: var(--accent);
      cursor: pointer;
    }
    .split {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 12px;
    }
    .detail-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 14px;
    }
    .detail-item {
      min-width: 0;
      border-left: 3px solid var(--line);
      padding-left: 10px;
    }
    .detail-label {
      color: var(--muted);
      font-size: 12px;
      margin-bottom: 4px;
    }
    .detail-value {
      overflow-wrap: anywhere;
      line-height: 1.5;
    }
    .detail-text {
      white-space: pre-wrap;
      line-height: 1.7;
      color: #26323a;
    }
    .info-columns {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }
    .info-card {
      border: 1px solid var(--line);
      border-radius: 4px;
      background: #fbfcfd;
      padding: 10px;
      min-width: 0;
    }
    .info-card h3 {
      margin: 0 0 8px;
      font-size: 13px;
    }
    .info-card ul {
      margin: 0;
      padding-left: 18px;
      line-height: 1.7;
    }
    .info-card li + li {
      margin-top: 4px;
    }
    .list-block {
      display: grid;
      gap: 6px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .list-block li {
      border-left: 3px solid var(--line);
      padding-left: 10px;
      line-height: 1.6;
    }
    .ai-history {
      display: grid;
      gap: 8px;
      margin-top: 12px;
    }
    .ai-history button {
      height: auto;
      min-height: 34px;
      text-align: left;
      padding: 8px 10px;
    }
    .ai-evidence-section {
      margin-top: 12px;
      padding-top: 10px;
      border-top: 1px solid var(--line);
    }
    .ai-evidence-heading {
      margin: 0 0 7px;
      font-size: 13px;
    }
    .ai-evidence-risk {
      border-left: 4px solid var(--warn);
      padding-left: 10px;
      background: #fffaf1;
    }
    .ai-evidence-risk .ai-evidence-heading { color: var(--warn); }
    .tabs {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 16px;
    }
    .tab-button {
      background: #eef1f4;
      border-color: #d7dee5;
      color: #34424d;
    }
    .tab-button[data-active="true"] {
      background: var(--accent);
      border-color: var(--accent);
      color: #fff;
    }
    .tab-panel { display: none; }
    .tab-panel[data-active="true"] { display: block; }
    body.url-search-page .left section:not(:first-child),
    body.url-search-page .tabs,
    body.url-search-page .tab-panel,
    body.url-search-page .workflow {
      display: none;
    }
    body.mail-workspace-page .left section:first-child,
    body.mail-workspace-page .right > section:first-child,
    body.mail-workspace-page .tabs,
    body.mail-workspace-page [data-tab-panel="detail"],
    body.mail-workspace-page [data-tab-panel="ai"] {
      display: none;
    }
    body.mail-workspace-page [data-tab-panel="mail"] {
      display: block;
    }
    body.url-search-page main {
      grid-template-columns: minmax(0, 1fr);
      max-width: 1240px;
      width: 100%;
      margin: 0 auto;
      align-content: start;
      gap: 10px;
    }
    body.mail-workspace-page main {
      grid-template-columns: minmax(320px, 360px) minmax(0, 1fr);
      max-width: 1240px;
      width: 100%;
      margin: 0 auto;
      align-content: start;
      gap: 12px;
    }
    body.mail-workspace-page .left {
      grid-template-rows: auto minmax(0, 1fr);
      align-content: stretch;
      height: calc(100vh - 80px);
      position: sticky;
      top: 68px;
      overflow: hidden;
    }
    body.mail-workspace-page .right {
      display: block;
    }
    body.mail-workspace-page [data-ui="mail-lead-queue"] {
      min-height: 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    body.mail-workspace-page [data-ui="mail-lead-queue"] .lead-list-scroll {
      flex: 1;
      min-height: 0;
      max-height: none;
    }
    body.mail-workspace-page [data-ui="mail-lead-queue"] th:nth-child(n+2):nth-child(-n+7),
    body.mail-workspace-page [data-ui="mail-lead-queue"] td:nth-child(n+2):nth-child(-n+7) {
      display: none;
    }
    body.mail-workspace-page [data-ui="mail-lead-queue"] th:first-child { width: auto !important; }
    body.mail-workspace-page [data-ui="mail-lead-queue"] th:last-child { width: 90px !important; }
    .mail-lead-filter { display: none; }
    body.mail-workspace-page .mail-lead-filter {
      display: block;
    }
    .mail-filter-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 180px;
      gap: 8px;
    }
    .search-panel {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      margin-top: 14px;
    }
    .search-panel .toolbar { grid-column: 1 / -1; }
    .search-console .body {
      display: grid;
      gap: 8px;
      padding: 10px 12px;
    }
    .direct-import,
    .quick-search,
    .source-selector {
      display: grid;
      gap: 8px;
      align-items: center;
      max-width: 980px;
    }
    .source-selector {
      grid-template-columns: minmax(220px, 320px) minmax(0, 1fr);
      justify-content: start;
    }
    .direct-import {
      grid-template-columns: minmax(320px, 720px) 180px;
      justify-content: start;
    }
    .quick-search {
      grid-template-columns: minmax(320px, 720px);
      justify-content: start;
    }
    .search-filter-row {
      display: grid;
      grid-template-columns: repeat(3, minmax(180px, 240px));
      gap: 8px;
      padding-top: 0;
      justify-content: start;
    }
    .search-actions {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 8px;
      max-width: 980px;
    }
    .search-actions .status {
      min-width: 180px;
    }
    .direct-import .status,
    .quick-search .status {
      grid-column: 1 / -1;
    }
    .advanced-search {
      min-width: 170px;
    }
    .advanced-search summary,
    .display-filter summary {
      height: 34px;
      display: inline-flex;
      align-items: center;
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 0 12px;
      background: #fff;
      cursor: pointer;
      color: #34424d;
      white-space: nowrap;
    }
    .advanced-search[open] summary,
    .display-filter[open] summary {
      border-color: #b9c8d1;
      background: #f8fafb;
    }
    .advanced-search .search-panel {
      margin-top: 10px;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      min-width: min(760px, calc(100vw - 48px));
    }
    body.url-search-page .left,
    body.url-search-page .right {
      display: block;
    }
    body.url-search-page .left {
      order: 1;
    }
    body.url-search-page .right {
      order: 2;
    }
    body.url-search-page .search-console {
      border-radius: 4px;
    }
    .search-drawer > summary,
    .mail-filter-drawer > summary {
      min-height: 42px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 0 12px;
      cursor: pointer;
      font-weight: 700;
      border-bottom: 1px solid transparent;
    }
    .search-drawer[open] > summary,
    .mail-filter-drawer[open] > summary {
      border-bottom-color: var(--line);
    }
    .search-drawer .body,
    .mail-filter-drawer .body {
      padding-top: 10px;
    }
    .search-block {
      display: grid;
      grid-template-columns: 150px minmax(0, 1fr);
      gap: 8px 12px;
      align-items: center;
    }
    .search-block-title {
      color: var(--muted);
      font-size: 12px;
      font-weight: 700;
    }
    .search-block .direct-import,
    .search-block .quick-search,
    .search-block .source-selector,
    .search-block .search-filter-row,
    .search-block .search-actions {
      grid-column: 2;
    }
    details[open] .when-closed,
    details:not([open]) .when-open {
      display: none;
    }
    body.url-search-page .right > section {
      border-radius: 4px;
    }
    .result-filter-panel {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }
    .display-filter {
      position: relative;
      margin-top: 0;
    }
    .display-filter .result-filter-panel {
      position: absolute;
      right: 0;
      top: 40px;
      z-index: 20;
      width: min(760px, calc(100vw - 48px));
      padding: 12px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: #fff;
      box-shadow: 0 12px 28px rgba(23, 32, 38, .14);
    }
    .candidate-table-wrap {
      overflow: auto;
      border: 1px solid var(--line);
      border-radius: 4px;
    }
    .candidate-table {
      min-width: 980px;
      table-layout: fixed;
    }
    .candidate-table th,
    .candidate-table td {
      vertical-align: top;
    }
    .candidate-table th {
      position: sticky;
      top: 0;
      z-index: 1;
    }
    .candidate-table td {
      background: #fff;
    }
    .candidate-table tr:hover td {
      background: #f8fbfa;
    }
    .candidate-title-cell {
      font-weight: 700;
      line-height: 1.45;
      overflow-wrap: anywhere;
    }
    .candidate-summary {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.55;
      margin-top: 5px;
      overflow-wrap: anywhere;
    }
    .num-cell {
      white-space: nowrap;
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .center-cell {
      text-align: center;
      white-space: nowrap;
    }
    .action-cell {
      white-space: nowrap;
      text-align: right;
    }
    .link-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 34px;
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 0 10px;
      background: #fff;
      color: var(--text);
      font-size: 13px;
      font-weight: 700;
      text-decoration: none;
      white-space: nowrap;
    }
    .link-button:hover {
      border-color: #b8c7d1;
      background: #f8fafb;
      text-decoration: none;
    }
    .compact-summary {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
    }
    .mail-actions {
      border-top: 1px solid var(--line);
      margin-top: 12px;
      padding-top: 12px;
    }
    .mail-flow {
      display: grid;
      gap: 12px;
    }
    .mail-work-tab-list {
      display: flex;
      gap: 4px;
      overflow-x: auto;
      padding-bottom: 2px;
      border-bottom: 1px solid var(--line);
    }
    .mail-work-tab {
      flex: 0 0 auto;
      border-color: transparent;
      background: transparent;
      color: var(--muted);
    }
    .mail-work-tab[data-active="true"] {
      border-color: var(--accent);
      background: #eef8f5;
      color: var(--text);
      font-weight: 700;
    }
    .mail-work-panel { display: none; }
    .mail-work-panel[data-active="true"] {
      display: grid;
      gap: 12px;
    }
    .mail-context {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 10px;
    }
    .mail-stage {
      border: 1px solid var(--line);
      border-radius: 4px;
      background: #fff;
      overflow: hidden;
    }
    .mail-stage-head {
      min-height: 42px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 8px 12px;
      border-bottom: 1px solid var(--line);
      background: #fbfcfd;
    }
    .mail-stage-head h3 {
      margin: 0;
      font-size: 14px;
    }
    .mail-stage-body {
      padding: 12px;
    }
    .mail-context-bar {
      display: grid;
      grid-template-columns: minmax(180px, 1.4fr) minmax(120px, .65fr) minmax(120px, .65fr) minmax(220px, 1.3fr);
      gap: 8px;
      align-items: center;
      padding: 10px 12px;
      border: 1px solid var(--line);
      border-radius: 4px;
      background: var(--panel);
    }
    body.mail-workspace-page .mail-context-bar {
      position: sticky;
      top: 58px;
      z-index: 8;
      box-shadow: 0 2px 8px rgba(23, 32, 38, .08);
    }
    .mail-context-item {
      min-width: 0;
    }
    .mail-context-label {
      display: block;
      margin-bottom: 3px;
      color: var(--muted);
      font-size: 11px;
    }
    .mail-context-value {
      display: block;
      overflow-wrap: anywhere;
      line-height: 1.45;
    }
    .mail-create-bar {
      display: grid;
      grid-template-columns: minmax(180px, 240px) auto minmax(240px, 1fr);
      gap: 8px;
      align-items: center;
    }
    .template-manager {
      margin-top: 12px;
      border-top: 1px solid var(--line);
      padding-top: 10px;
    }
    .template-manager > summary {
      cursor: pointer;
      color: var(--muted);
      font-weight: 700;
    }
    .template-manager-body {
      display: grid;
      gap: 10px;
      margin-top: 10px;
    }
    .template-manager-toolbar,
    .template-manager-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .template-manager-toolbar label,
    .template-manager-grid label,
    .template-import-field {
      display: grid;
      gap: 5px;
      color: var(--muted);
      font-size: 12px;
    }
    .template-manager-toolbar select {
      min-width: 240px;
    }
    .template-manager-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
    }
    .template-manager-wide {
      grid-column: 1 / -1;
    }
    .template-manager-grid textarea,
    .template-import-field textarea {
      min-height: 100px;
      line-height: 1.6;
    }
    .template-manager-grid input,
    .template-manager-grid select {
      min-width: 0;
    }
    .template-active {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      color: var(--muted);
      font-size: 12px;
    }
    .template-active input {
      width: 18px;
      height: 18px;
      margin: 0;
      accent-color: var(--accent);
    }
    .mail-material-engagement {
      margin-top: 10px;
      padding: 10px;
      border: 1px solid var(--line);
      border-radius: var(--radius-panel);
      background: #fbfcfd;
    }
    .mail-material-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 8px;
    }
    .mail-material-meta {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
    }
    .mail-material-meta span {
      display: block;
      color: var(--muted);
      font-size: 12px;
    }
    .mail-material-links {
      display: grid;
      gap: 4px;
      margin-top: 8px;
      color: var(--muted);
      font-size: 12px;
    }
    .material-link-tools {
      display: grid;
      gap: 5px;
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid var(--line);
      color: var(--muted);
      font-size: 12px;
    }
    .material-link-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
    }
    .mail-editor-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.35fr) minmax(360px, .65fr);
      gap: 12px;
      align-items: start;
    }
    .mail-project-comparison {
      min-width: 0;
      padding-left: 12px;
      border-left: 1px solid var(--line);
    }
    .mail-project-comparison h4 {
      margin: 0 0 10px;
      font-size: 14px;
    }
    .mail-comparison-list { display: grid; gap: 0; }
    .mail-comparison-item {
      display: grid;
      grid-template-columns: 96px minmax(0, 1fr);
      gap: 8px;
      padding: 7px 0;
      border-bottom: 1px solid var(--line);
    }
    .mail-comparison-item span:first-child {
      color: var(--muted);
      font-size: 12px;
    }
    .mail-comparison-item span:last-child {
      min-width: 0;
      overflow-wrap: anywhere;
      line-height: 1.55;
    }
    .next-action-strip {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px;
    }
    .next-action-card {
      border: 1px solid var(--line);
      border-radius: 4px;
      padding: 8px 10px;
      background: #fbfcfd;
    }
    .next-action-card strong {
      display: block;
      font-size: 13px;
      margin-bottom: 4px;
    }
    footer {
      max-width: 1240px;
      margin: 0 auto;
      padding: 0 12px 14px;
      color: var(--muted);
      font-size: 12px;
    }
    a {
      color: var(--accent);
      text-decoration: none;
    }
    a:hover { text-decoration: underline; }
    @media (max-width: 980px) {
      main, .workflow, .split, .grid-2, .detail-grid, .compact-summary, .mail-create-bar, .mail-editor-grid, .next-action-strip, .info-columns, .template-manager-grid, .mail-material-meta, .material-link-row { grid-template-columns: 1fr; }
      body.mail-workspace-page main { grid-template-columns: minmax(0, 1fr); }
      body.mail-workspace-page .left {
        height: auto;
        position: static;
        overflow: visible;
      }
      body.mail-workspace-page [data-ui="mail-lead-queue"] .lead-list-scroll { max-height: 280px; }
      body.mail-workspace-page [data-ui="mail-project-comparison"] {
        order: -1;
        padding: 0 0 12px;
        border-left: 0;
        border-bottom: 1px solid var(--line);
      }
      header { padding: 0 14px; }
      .mail-context-bar { grid-template-columns: 1fr; }
      body.mail-workspace-page .mail-context-bar { position: static; box-shadow: none; }
      .direct-import, .quick-search, .source-selector, .search-filter-row, .mail-filter-row, .result-filter-panel, .search-block { grid-template-columns: 1fr; }
      .search-actions { flex-wrap: wrap; }
      .display-filter .result-filter-panel {
        position: static;
        width: auto;
        margin-top: 8px;
        box-shadow: none;
      }
      .search-block .direct-import,
      .search-block .quick-search,
      .search-block .source-selector,
      .search-block .search-filter-row,
      .search-block .search-actions {
        grid-column: 1;
      }
    }
    @media (max-width: 700px) {
      header { align-items: flex-start; flex-direction: column; gap: 8px; padding: 12px 14px; }
      .top-nav { max-width: 100%; overflow-x: auto; }
    }
  </style>`;
    case 'leads':
      return `<style>
    :root {
      color-scheme: light;
      --bg: #f6f7f9;
      --panel: #ffffff;
      --text: #172026;
      --muted: #66737f;
      --line: #dfe4ea;
      --accent: #136f63;
      --warn: #9f5a00;
      --danger: #a83232;
      --ok: #1d7b45;
      --space-1: 4px;
      --space-2: 8px;
      --space-3: 12px;
      --space-4: 16px;
      --radius-control: 6px;
      --radius-panel: 4px;
      --radius-nav: 8px;
      --control-height: 34px;
      --font-body: 14px;
      --font-heading: 18px;
      --shadow-panel: none;
    }
    * { box-sizing: border-box; }
    :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif;
      font-size: var(--font-body);
    }
    header {
      min-height: 58px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 0 24px;
      border-bottom: 1px solid var(--line);
      background: var(--panel);
      position: sticky;
      top: 0;
      z-index: 10;
    }
    h1 { font-size: var(--font-heading); margin: 0; }
    .top-nav {
      display: inline-flex;
      gap: 4px;
      padding: 4px;
      border: 1px solid var(--line);
      border-radius: var(--radius-nav);
      background: #f4f6f8;
    }
    .top-nav button {
      border-color: transparent;
      background: transparent;
    }
    .top-nav button.primary {
      background: var(--accent);
      color: white;
    }
    .nav-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 18px;
      height: 18px;
      margin-left: 4px;
      padding: 0 5px;
      border-radius: 9px;
      background: var(--warn);
      color: white;
      font-size: 11px;
      line-height: 1;
      font-variant-numeric: tabular-nums;
    }
    .nav-badge[hidden] { display: none; }
    button, input, select { font: inherit; }
    button {
      border: 1px solid var(--line);
      background: var(--panel);
      color: var(--text);
      height: var(--control-height);
      border-radius: var(--radius-control);
      padding: 0 12px;
      cursor: pointer;
    }
    button.primary { background: var(--accent); border-color: var(--accent); color: white; }
    input, select {
      height: 36px;
      border: 1px solid var(--line);
      border-radius: var(--radius-control);
      padding: 0 10px;
      background: white;
      min-width: 0;
    }
    main { padding: 12px; display: grid; gap: 10px; }
    section {
      border: 1px solid var(--line);
      background: var(--panel);
      border-radius: var(--radius-panel);
      overflow: hidden;
    }
    .section-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 12px;
      border-bottom: 1px solid var(--line);
    }
    h2 { font-size: 15px; margin: 0; }
    .body { padding: 12px; }
    .toolbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .filters {
      display: grid;
      grid-template-columns: minmax(220px, 1fr) repeat(4, minmax(150px, 180px));
      gap: 8px;
    }
    .summary-panel { order: 1; }
    .filters-panel { order: 2; }
    .lead-list-main { order: 3; }
    .export-tools { order: 4; }
    .collapsible-panel summary {
      min-height: 48px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 0 16px;
      cursor: pointer;
      font-weight: 700;
    }
    .collapsible-panel details[open] summary {
      border-bottom: 1px solid var(--line);
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 10px;
    }
    .export-panel {
      display: grid;
      grid-template-columns: minmax(170px, 220px) minmax(170px, 220px) minmax(190px, 260px) auto minmax(180px, 1fr);
      gap: 10px;
      align-items: center;
    }
    .export-preview {
      color: var(--muted);
      font-size: 13px;
    }
    .attention-reason {
      font-weight: 600;
      line-height: 1.45;
      overflow-wrap: anywhere;
    }
    .stat {
      border: 1px solid var(--line);
      border-radius: var(--radius-panel);
      padding: 10px;
      background: #fbfcfd;
      height: auto;
      text-align: left;
    }
    .stat strong { display: block; font-size: 22px; margin-bottom: 4px; }
    .stat[data-active="true"] {
      border-color: var(--accent);
      background: #eef8f5;
      color: var(--text);
    }
    .muted { color: var(--muted); }
    .status { font-size: 13px; }
    .ui-state-loading { color: var(--muted); }
    .ui-state-empty { color: var(--muted); }
    .ui-state-error { color: var(--danger); font-weight: 600; }
    .split {
      display: grid;
      grid-template-columns: minmax(0, 1.65fr) minmax(360px, .75fr);
      gap: 10px;
      align-items: start;
    }
    .lead-detail-panel {
      position: sticky;
      top: 70px;
      max-height: calc(100vh - 82px);
      overflow: auto;
    }
    .detail-next-action {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 10px;
      padding: 10px 12px;
      border-bottom: 1px solid var(--line);
      background: #f5faf8;
    }
    .detail-next-action strong,
    .detail-next-action span { overflow-wrap: anywhere; }
    .lead-detail-stack {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 10px;
    }
    .task-workspace {
      border: 1px solid var(--line);
      border-radius: var(--radius-panel);
      background: #fbfcfd;
    }
    .task-workspace .section-head { background: #f5faf8; }
    .task-list { display:grid; gap:0; }
    .task-row { display:flex; justify-content:space-between; align-items:flex-start; gap:10px; padding:10px 0; border-bottom:1px solid var(--line); }
    .task-row:last-child { border-bottom:0; }
    .task-row strong, .task-row span { overflow-wrap:anywhere; }
    .task-row-main { min-width:0; display:grid; gap:4px; }
    .task-row-meta { color:var(--muted); font-size:12px; }
    .task-row-description { color:var(--muted); white-space:pre-wrap; }
    .task-form { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; margin-top:12px; padding-top:12px; border-top:1px solid var(--line); }
    .task-form label { display:grid; gap:4px; color:var(--muted); font-size:12px; }
    .task-form label.full { grid-column:1 / -1; }
    .task-form input, .task-form select, .task-form textarea { width:100%; min-width:0; }
    .task-form textarea { min-height:70px; resize:vertical; }
    .task-form-actions { grid-column:1 / -1; display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
    @media (max-width:700px) { .task-form { grid-template-columns:1fr; } .task-form label.full, .task-form-actions { grid-column:auto; } .task-row { flex-direction:column; } }
    .detail-shell {
      display: grid;
      grid-template-columns: minmax(0, 1.1fr) minmax(360px, .9fr);
      gap: 10px;
      align-items: start;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    .table-scroll {
      overflow: auto;
      border-top: 0;
    }
    .table-scroll table {
      margin: 0;
      min-width: 1180px;
    }
    .table-scroll thead th {
      position: sticky;
      top: 0;
      z-index: 2;
      border-bottom: 1px solid var(--line);
    }
    .lead-list-scroll {
      max-height: 420px;
    }
    .list-pagination {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
      min-height: 44px;
      padding: 8px 12px;
      border-top: 1px solid var(--line);
      background: #fbfcfd;
    }
    .list-pagination button {
      min-height: 32px;
      padding: 4px 10px;
    }
    .list-pagination span {
      min-width: 54px;
      text-align: center;
      color: var(--muted);
      font-size: 12px;
    }
    th, td {
      padding: 12px 10px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      vertical-align: top;
      line-height: 1.55;
    }
    th {
      font-size: 12px;
      color: var(--muted);
      background: #fbfcfd;
      position: static;
      line-height: 1.4;
    }
    th.sortable {
      cursor: pointer;
      user-select: none;
      white-space: nowrap;
    }
    th.sortable:hover {
      color: var(--accent);
      background: #eef7f4;
    }
    .sort-mark {
      margin-left: 4px;
      color: var(--accent);
      font-size: 12px;
    }
    tr { cursor: pointer; }
    tr:hover { background: #f8fbfa; }
    tr[data-selected="true"] { background: #eef8f5; }
    .clip {
      display: block;
      min-height: 1.55em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1.55;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      min-height: 24px;
      border: 1px solid var(--line);
      border-radius: 4px;
      padding: 2px 8px;
      font-size: 12px;
      background: white;
    }
    .badge.ok { color: var(--ok); border-color: #bddfc9; background: #f1fbf4; }
    .badge.warn { color: var(--warn); border-color: #ecd2a8; background: #fff8eb; }
    .badge.danger { color: var(--danger); border-color: #ecc4c4; background: #fff4f4; }
    .detail-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
    .detail-item { border: 1px solid var(--line); border-radius: 4px; padding: 8px; }
    .detail-label { color: var(--muted); font-size: 12px; margin-bottom: 4px; }
    .detail-value { word-break: break-word; }
    .row { margin-top: 12px; }
    .row label { display: block; color: var(--muted); font-size: 12px; margin-bottom: 5px; }
    .detail-text {
      border: 1px solid var(--line);
      border-radius: 4px;
      padding: 8px;
      background: #fbfcfd;
      white-space: pre-wrap;
      max-height: 180px;
      overflow: auto;
    }
    .ai-evidence-section {
      margin-top: 12px;
      padding-top: 10px;
      border-top: 1px solid var(--line);
    }
    .ai-evidence-heading {
      margin: 0 0 7px;
      font-size: 13px;
    }
    .ai-evidence-risk {
      border-left: 4px solid var(--warn);
      padding-left: 10px;
      background: #fffaf1;
    }
    .ai-evidence-risk .ai-evidence-heading { color: var(--warn); }
    textarea {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 4px;
      padding: 8px;
      font: inherit;
      line-height: 1.7;
      resize: vertical;
      min-height: 82px;
    }
    .form-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px;
    }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }
    footer {
      padding: 0 12px 14px;
      color: var(--muted);
      font-size: 12px;
    }
    @media (max-width: 1100px) {
      .filters, .stats, .split, .detail-grid, .detail-shell, .form-grid, .export-panel { grid-template-columns: 1fr; }
      .lead-detail-panel {
        position: static;
        max-height: none;
        overflow: visible;
      }
      .detail-next-action { grid-template-columns: 1fr; }
      th { position: static; }
    }
  </style>`;
    case 'today':
      return `<style>
    :root { color-scheme: light; --bg:#f6f7f9; --panel:#fff; --text:#172026; --muted:#66737f; --line:#dfe4ea; --accent:#136f63; --warn:#9f5a00; --danger:#a83232; --ok:#1d7b45; --space-1:4px; --space-2:8px; --space-3:12px; --space-4:16px; --radius-control:6px; --radius-panel:4px; --radius-nav:8px; --control-height:34px; --font-body:14px; --font-heading:18px; --shadow-panel:none; }
    * { box-sizing: border-box; }
    :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    body { margin:0; background:var(--bg); color:var(--text); font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans","Yu Gothic",sans-serif; font-size:var(--font-body); }
    header { min-height:58px; display:flex; align-items:center; justify-content:space-between; gap:16px; padding:0 24px; border-bottom:1px solid var(--line); background:var(--panel); position:sticky; top:0; z-index:10; }
    h1 { font-size:var(--font-heading); margin:0; }
    h2 { font-size:15px; margin:0; }
    button { font:inherit; border:1px solid var(--line); background:var(--panel); color:var(--text); min-height:var(--control-height); border-radius:var(--radius-control); padding:0 12px; cursor:pointer; }
    button.primary { background:var(--accent); border-color:var(--accent); color:white; }
    button:disabled { opacity:.55; cursor:not-allowed; }
    .toolbar { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
    .top-nav { display:inline-flex; gap:4px; padding:4px; border:1px solid var(--line); border-radius:var(--radius-nav); background:#f4f6f8; }
    .top-nav button { border-color:transparent; background:transparent; }
    .top-nav button.primary { background:var(--accent); color:white; }
    .nav-badge { display:inline-flex; align-items:center; justify-content:center; min-width:18px; height:18px; margin-left:4px; padding:0 5px; border-radius:9px; background:var(--warn); color:white; font-size:11px; line-height:1; font-variant-numeric:tabular-nums; }
    .nav-badge[hidden] { display:none; }
    main { display:grid; gap:10px; padding:12px; max-width:1240px; margin:0 auto; }
    section { border:1px solid var(--line); border-radius:var(--radius-panel); background:var(--panel); overflow:hidden; }
    .section-head { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 12px; border-bottom:1px solid var(--line); }
    .body { padding:12px; }
    .status { font-size:13px; min-height:18px; }
    .muted { color:var(--muted); }
    .ok { color:var(--ok); }
    .warn { color:var(--warn); }
    .error { color:var(--danger); font-weight:600; }
    .ui-state-loading { color:var(--muted); }
    .ui-state-empty { color:var(--muted); padding:16px 0; }
    .ui-state-error { color:var(--danger); font-weight:600; }
    .today-stats { display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); gap:8px; }
    .today-stat { display:grid; gap:4px; min-height:82px; padding:10px; text-align:left; border-radius:4px; background:#fbfcfd; }
    .today-stat[data-active="true"] { border-color:var(--accent); background:#eef8f5; }
    .today-stat strong { font-size:22px; }
    .today-stat span { color:var(--muted); line-height:1.4; }
    .today-list { display:grid; gap:0; }
    .today-row { display:grid; grid-template-columns:170px minmax(0,1fr) 140px 160px; gap:12px; align-items:center; width:100%; min-height:58px; padding:9px 0; border:0; border-bottom:1px solid var(--line); border-radius:0; text-align:left; }
    .today-row:hover { background:#f7faf9; }
    .today-row strong, .today-row span { min-width:0; overflow-wrap:anywhere; }
    .today-row .reason { font-weight:600; }
    .today-row .meta { color:var(--muted); font-size:12px; }
    .today-row .badge { display:inline-block; width:max-content; padding:3px 7px; border:1px solid var(--line); border-radius:4px; color:var(--muted); }
    footer { max-width:1240px; margin:0 auto; padding:0 12px 14px; color:var(--muted); font-size:12px; }
    @media (max-width:1050px) { .today-stats { grid-template-columns:repeat(4,minmax(0,1fr)); } .today-row { grid-template-columns:140px minmax(0,1fr) 120px; } .today-row .date { display:none; } }
    @media (max-width:700px) { header { padding:0 14px; align-items:flex-start; padding-top:12px; padding-bottom:12px; } .top-nav { max-width:100%; overflow:auto; } .today-stats { grid-template-columns:repeat(2,minmax(0,1fr)); } .today-row { grid-template-columns:minmax(0,1fr) auto; gap:6px; } .today-row .reason { grid-column:1 / -1; grid-row:1; } .today-row strong { grid-column:1; grid-row:2; } .today-row .badge { grid-column:2; grid-row:2; } }
  </style>`;
    case 'replies':
      return `<style>
    :root { color-scheme:light; --bg:#f6f7f9; --panel:#fff; --line:#dfe4ea; --text:#172026; --muted:#66737f; --accent:#136f63; --accent-strong:#0f554c; --danger:#a83232; --warn:#9f5a00; --ok:#1d7b45; --space-1:4px; --space-2:8px; --space-3:12px; --space-4:16px; --radius-control:6px; --radius-panel:4px; --radius-nav:8px; --control-height:34px; --font-body:14px; --font-heading:18px; --shadow-panel:none; }
    * { box-sizing:border-box; }
    :focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
    body { margin:0; background:var(--bg); color:var(--text); font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans","Yu Gothic",sans-serif; font-size:var(--font-body); }
    header { min-height:58px; display:flex; justify-content:space-between; align-items:center; gap:16px; padding:0 24px; border-bottom:1px solid var(--line); background:var(--panel); position:sticky; top:0; z-index:10; }
    h1, h2, p { margin:0; }
    h1 { font-size:var(--font-heading); }
    h2 { font-size:16px; }
    .toolbar, .top-nav, .filter-row, .pagination, .summary { display:flex; align-items:center; gap:8px; }
    .toolbar { flex-wrap:wrap; justify-content:flex-end; }
    .top-nav { padding:4px; border:1px solid var(--line); border-radius:var(--radius-nav); background:#f4f6f8; }
    button, select { min-height:var(--control-height); padding:7px 10px; border:1px solid var(--line); border-radius:var(--radius-control); background:#fff; color:inherit; font:inherit; cursor:pointer; }
    button:hover { border-color:var(--accent); }
    button.primary { border-color:var(--accent); background:var(--accent); color:#fff; }
    button:disabled { cursor:not-allowed; opacity:.5; }
    main { display:grid; gap:10px; max-width:1240px; margin:0 auto; padding:12px 12px 24px; }
    section { border:1px solid var(--line); border-radius:var(--radius-panel); background:var(--panel); overflow:hidden; }
    .section-head { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:14px 16px; border-bottom:1px solid var(--line); }
    .body { padding:14px 16px; }
    .filters { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:10px; padding:14px 16px; border-bottom:1px solid var(--line); background:#fbfcfc; }
    .field { display:grid; gap:5px; min-width:0; }
    .field label { color:var(--muted); font-size:12px; }
    .field select { width:100%; }
    .summary { flex-wrap:wrap; color:var(--muted); font-size:12px; }
    .summary strong { color:var(--text); font-size:16px; }
    .summary-item { display:flex; align-items:baseline; gap:5px; padding-right:12px; border-right:1px solid var(--line); }
    .summary-item:last-child { border-right:0; }
    .status { display:inline-flex; align-items:center; min-height:24px; color:var(--muted); }
    .ui-state-loading { color:var(--muted); }
    .ui-state-empty { padding:28px 8px; color:var(--muted); text-align:center; }
    .ui-state-error { padding:12px; border:1px solid #e8bbb6; border-radius:4px; background:#fff7f6; color:var(--danger); }
    .reply-list { overflow:auto; }
    table { width:100%; border-collapse:collapse; table-layout:fixed; }
    th, td { padding:10px 12px; border-bottom:1px solid var(--line); vertical-align:top; text-align:left; overflow-wrap:anywhere; }
    th { color:var(--muted); font-size:12px; font-weight:600; background:#fbfcfc; }
    th:nth-child(1) { width:22%; } th:nth-child(2) { width:17%; } th:nth-child(3) { width:28%; } th:nth-child(4) { width:16%; } th:nth-child(5) { width:11%; } th:nth-child(6) { width:6%; }
    tr.manager-review { background:#fffaf0; }
    .company { font-weight:700; }
    .project, .meta, .preview { display:block; margin-top:4px; color:var(--muted); font-size:12px; }
    .preview { line-height:1.5; }
    .badge { display:inline-block; margin:0 4px 4px 0; padding:3px 7px; border:1px solid var(--line); border-radius:4px; color:var(--muted); font-size:12px; white-space:nowrap; }
    .badge.critical, .badge.stop { border-color:#d6a29d; background:#fff1ef; color:var(--danger); }
    .badge.high { border-color:#e1c58e; background:#fff9e9; color:var(--warn); }
    .next-action { font-weight:600; line-height:1.5; }
    .pagination { justify-content:center; padding:14px 16px 2px; }
    .pagination span { min-width:120px; color:var(--muted); text-align:center; }
    footer { max-width:1240px; margin:0 auto; padding:0 12px 14px; color:var(--muted); font-size:12px; }
    @media (max-width:1050px) { .filters { grid-template-columns:repeat(2,minmax(0,1fr)); } table { min-width:900px; } .reply-list { overflow-x:auto; } }
    @media (max-width:700px) { header { align-items:flex-start; flex-direction:column; padding:12px 14px; } header .toolbar { width:100%; min-width:0; justify-content:flex-start; } header .top-nav { width:100%; min-width:0; max-width:100%; overflow:auto; } .filters { grid-template-columns:1fr; } .top-nav button { white-space:nowrap; } .section-head { align-items:flex-start; flex-direction:column; } }
  </style>`;
    default:
      throw new Error('Unknown dashboard style page');
  }
}
