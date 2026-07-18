import { renderLeadsPage } from './leads-page';
import { renderLeadsPageDocument } from './leads-page-static';

describe('Lead page static HTML', () => {
  it('keeps the lead workspace DOM and injects the client script once', () => {
    const html = renderLeadsPage();
    const injected = renderLeadsPageDocument('window.__leadPageContract = true;');

    expect(html).toContain('id="leadRows"');
    expect(html).toContain('id="leadDetail"');
    expect(html).toContain('leadSort-opportunity');
    expect(html).toContain('data-ui="opportunity-workspace"');
    expect(html).toContain('data-ui="lead-task-workspace"');
    expect(html).toContain('function saveTask()');
    expect(injected).toContain('window.__leadPageContract = true;');
    expect((injected.match(/<script>/g) || []).length).toBe(1);
    const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
    expect(script).toBeDefined();
    expect(() => new Function(script as string)).not.toThrow();
  });

  it('keeps independent editable fields and explicit nullable clearing in the lead detail contract', () => {
    const html = renderLeadsPage();

    expect(html).toContain("inputField('leadNextActionAtEdit', '次対応日時'");
    expect(html).toContain("inputField('leadSentAtEdit', '送信日時'");
    expect(html).toContain("inputField('leadNextFollowUpAtEdit', '次回確認日時'");
    expect(html).toContain("nextActionAt: nullableDateTimeValue('leadNextActionAtEdit')");
    expect(html).toContain("sentAt: nullableDateTimeValue('leadSentAtEdit')");
    expect(html).toContain("nextFollowUpAt: nullableDateTimeValue('leadNextFollowUpAtEdit')");
    expect(html).toContain("companySourceProjectCount: nullableNumberValue('leadCompanySourceProjectCountEdit')");
    expect(html).toContain("projectLocation: nullableValue('leadProjectLocationEdit')");
    expect(html).toContain('AI分析からの提案（未保存）');
    expect(html).toContain("escapeAttr(fieldValue ?? '')");
    expect(html).toContain('data-ui="company-contact-manager"');
    expect(html).toContain("'/api/leads/' + leadId + '/opportunity'");
    expect(html).toContain("'/api/leads/' + leadId + '/opportunity/transitions'");
    expect(html).toContain("'/api/leads/' + leadId + '/opportunity/reopen'");
    expect(html).toContain("'/api/leads/' + leadId + '/opportunity/history?limit=50'");
    expect(html).toContain("window.confirm('商談段階を「' + label + '」へ変更します。よろしいですか？')");
    expect(html).toContain('受注・失注・対象外へ変更する理由を入力してください');
    expect(html).toContain("'/api/companies/' + companyId + '/contacts'");
    expect(html).toContain("'/api/contacts/' + state.selectedContactId + '/archive'");
    expect(html).not.toContain("nextFollowUpAt: dateTimeValue('leadNextActionAtEdit')");
  });

  it('keeps the selected lead detail when the server page changes', () => {
    const html = renderLeadsPage();
    const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1] || '';
    const clientStart = script.indexOf("const SELECTED_LEAD_STORAGE_KEY");
    const clientEnd = script.lastIndexOf('loadAll();');
    const clientScript = script.slice(clientStart, clientEnd);
    const runtime = new Function(clientScript + '; return { state, applyLeadListResponse, selectedLead };')() as {
      state: { selectedLeadId: string | null };
      applyLeadListResponse: (response: unknown) => void;
      selectedLead: () => { id: string } | null;
    };

    runtime.state.selectedLeadId = 'lead-selected';
    runtime.applyLeadListResponse({ items: [{ id: 'lead-selected' }], page: 1, limit: 20, total: 201, summary: {} });
    runtime.applyLeadListResponse({ items: [{ id: 'lead-on-page-2' }], page: 2, limit: 20, total: 201, summary: {} });

    expect(runtime.selectedLead()).toEqual({ id: 'lead-selected' });
  });
});
