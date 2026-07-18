function escapeContactHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[char] || char);
}

function primaryContact<T extends { isPrimary?: boolean; isUnsubscribed?: boolean }>(contacts: T[]): T | null {
  return contacts.find((contact) => contact.isPrimary && !contact.isUnsubscribed)
    || contacts.find((contact) => !contact.isUnsubscribed)
    || null;
}

function renderContactManager(input: {
  contacts?: Array<Record<string, unknown>>;
  selectedId?: string | null;
  loading?: boolean;
}): string {
  const contacts = Array.isArray(input.contacts) ? input.contacts : [];
  const selected = contacts.find((contact) => contact.id === input.selectedId) || null;
  const rows = contacts.map((contact) => {
    const unsubscribed = contact.isUnsubscribed === true;
    const contactValue = contact.email || contact.inquiryUrl || '連絡方法未登録';
    return '<tr data-contact-id="' + escapeContactHtml(contact.id) + '">' +
      '<td>' + (contact.isPrimary ? '<span class="badge ok">優先</span>' : '') + '</td>' +
      '<td><strong>' + escapeContactHtml(contact.name || '担当者名未登録') + '</strong><div class="muted">' + escapeContactHtml(contact.roleTitle || '') + '</div></td>' +
      '<td>' + escapeContactHtml(contactValue) + '</td>' +
      '<td><span class="badge ' + (unsubscribed ? 'danger' : 'ok') + '">' + (unsubscribed ? '配信停止' : '連絡可') + '</span></td>' +
      '<td><button type="button" onclick="selectCompanyContact(\'' + escapeContactHtml(contact.id) + '\')">編集</button></td>' +
    '</tr>';
  }).join('');
  const selectedStatus = selected?.isUnsubscribed === true;

  return '<div data-ui="company-contact-manager">' +
    (input.loading ? '<div class="ui-state-loading">連絡先を読み込み中</div>' : '') +
    '<div class="toolbar"><strong>会社の連絡先</strong><span class="status muted">' + contacts.length + '件</span><button type="button" onclick="newCompanyContact()">新規追加</button></div>' +
    '<div class="table-scroll"><table><thead><tr><th>優先</th><th>担当者</th><th>連絡方法</th><th>状態</th><th>操作</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="5" class="ui-state-empty">会社の連絡先はまだありません</td></tr>') +
    '</tbody></table></div>' +
    '<div class="form-grid contact-editor">' +
      '<label for="companyContactName">担当者名<input id="companyContactName" value="' + escapeContactHtml(selected?.name || '') + '" placeholder="例: 山田 太郎" /></label>' +
      '<label for="companyContactRoleTitle">部署・役職<input id="companyContactRoleTitle" value="' + escapeContactHtml(selected?.roleTitle || '') + '" placeholder="例: 営業部" /></label>' +
      '<label for="companyContactEmail">メールアドレス<input id="companyContactEmail" type="email" value="' + escapeContactHtml(selected?.email || '') + '" placeholder="example@company.jp" /></label>' +
      '<label for="companyContactInquiryUrl">問い合わせURL<input id="companyContactInquiryUrl" type="url" value="' + escapeContactHtml(selected?.inquiryUrl || '') + '" placeholder="https://..." /></label>' +
      '<label class="check-row"><input id="companyContactPrimary" type="checkbox" ' + (selected?.isPrimary ? 'checked' : '') + ' /> 優先連絡先にする</label>' +
    '</div>' +
    '<div class="toolbar">' +
      '<button type="button" class="primary" onclick="saveCompanyContact()">' + (selected ? '更新する' : '追加する') + '</button>' +
      (selected ? '<button type="button" onclick="archiveCompanyContact()">アーカイブ</button>' : '') +
      (selected ? '<button type="button" class="' + (selectedStatus ? '' : 'danger') + '" onclick="toggleCompanyContactUnsubscribe()">' + (selectedStatus ? '配信停止を解除' : '配信停止') + '</button>' : '') +
      '<span id="companyContactStatus" class="status"></span>' +
    '</div>' +
  '</div>';
}

export function renderClientContactsScript(): string {
  return [
    '(function (global) {',
    `  const escapeContactHtml = ${escapeContactHtml.toString()};`,
    `  const primaryContact = ${primaryContact.toString()};`,
    `  const renderContactManager = ${renderContactManager.toString()};`,
    '  global.SalesAiContacts = { primaryContact, renderContactManager };',
    '})(window);'
  ].join('\n');
}
