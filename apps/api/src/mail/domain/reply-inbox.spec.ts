import { buildReplyInboxViewModel } from './reply-inbox';

describe('reply-inbox view model', () => {
  const base = {
    id: 'reply_1',
    emailId: 'mail_1',
    fromEmail: 'contact@example.com',
    body: '本文です。',
    bodyText: '本文です。',
    confidence: 0.8,
    summary: '要約',
    nextAction: '内容を確認する',
    receivedAt: new Date('2026-07-12T01:02:03.000Z'),
    email: {
      id: 'mail_1', subject: '営業のご案内', status: 'sent' as const, gmailThreadId: 'thread_1',
      sentAt: new Date('2026-07-11T01:02:03.000Z'),
      company: { id: 'company_1', name: '株式会社テスト', isBlocked: false },
      contact: { id: 'contact_1', name: '担当者', email: 'contact@example.com', isUnsubscribed: false },
      lead: {
        id: 'lead_1', status: 'replied' as const, priority: 'medium' as const, score: 72,
        nextActionAt: new Date('2026-07-13T01:02:03.000Z'),
        project: { id: 'project_1', title: '新商品プロジェクト', url: 'https://example.com/project' }
      }
    }
  };

  it.each([
    ['interested', '興味あり'], ['need_info', '資料・詳細希望'], ['meeting_request', '商談希望'],
    ['not_interested', '見送り'], ['unsubscribe', '配信停止'], ['auto_reply', '自動返信'],
    ['complaint', 'クレーム'], ['unknown', '要確認']
  ] as const)('maps %s to a stable display category', (category, label) => {
    const result = buildReplyInboxViewModel({ ...base, category });
    expect(result.category).toBe(category);
    expect(result.categoryLabel).toBe(label);
    expect(result.receivedAt).toBe('2026-07-12T01:02:03.000Z');
    expect(result.lead.project?.title).toBe('新商品プロジェクト');
  });

  it('always elevates unsubscribe and complaint for manager review', () => {
    const unsubscribe = buildReplyInboxViewModel({ ...base, category: 'unsubscribe' });
    const complaint = buildReplyInboxViewModel({ ...base, category: 'complaint' });
    const normal = buildReplyInboxViewModel({ ...base, category: 'need_info' });
    expect(unsubscribe.flags).toMatchObject({ managerReviewRequired: true, stopFollowup: true, hasReply: true });
    expect(complaint.flags).toMatchObject({ managerReviewRequired: true, stopFollowup: false, hasReply: true });
    expect(unsubscribe.priorityRank).toBeGreaterThanOrEqual(normal.priorityRank);
    expect(complaint.priorityRank).toBeGreaterThanOrEqual(normal.priorityRank);
    expect(complaint.nextAction).toContain('manager');
  });

  it('stops follow-up when company or contact is already blocked', () => {
    const result = buildReplyInboxViewModel({
      ...base, category: 'interested',
      email: { ...base.email, company: { ...base.email.company, isBlocked: true }, contact: { ...base.email.contact, isUnsubscribed: true } }
    });
    expect(result.flags).toMatchObject({ managerReviewRequired: false, stopFollowup: true });
  });

  it('uses safe defaults for unknown category, empty text, and invalid confidence', () => {
    const result = buildReplyInboxViewModel({
      ...base, category: null, body: '  ', bodyText: null, confidence: 4, summary: ' ', nextAction: null,
      email: { ...base.email, contact: null, lead: null }
    });
    expect(result.category).toBe('unknown');
    expect(result.bodyText).toBe('');
    expect(result.confidence).toBe(1);
    expect(result.summary).toBeNull();
    expect(result.flags.managerReviewRequired).toBe(true);
    expect(result.lead).toMatchObject({ id: null, project: null });
  });

  it('truncates long body text without changing the stored classification', () => {
    const result = buildReplyInboxViewModel({ ...base, category: 'need_info', bodyText: 'あ'.repeat(300) });
    expect(result.bodyText).toHaveLength(241);
    expect(result.bodyText.endsWith('…')).toBe(true);
    expect(result.category).toBe('need_info');
  });
});
