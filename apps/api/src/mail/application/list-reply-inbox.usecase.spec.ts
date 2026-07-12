import { ListReplyInboxUseCase } from './list-reply-inbox.usecase';

describe('ListReplyInboxUseCase', () => {
  it('maps repository records to safe reply inbox items', async () => {
    const repository = {
      list: jest.fn().mockResolvedValue({
        page: 1,
        limit: 20,
        total: 1,
        items: [{
          id: 'reply_1',
          emailId: 'mail_1',
          fromEmail: 'contact@example.com',
          bodyText: '資料を見たいです。',
          category: 'need_info',
          confidence: 0.8,
          summary: '資料希望',
          nextAction: '資料を送る',
          receivedAt: new Date('2026-07-12T00:00:00.000Z'),
          email: {
            id: 'mail_1',
            subject: 'ご案内',
            status: 'sent',
            gmailThreadId: 'thread_1',
            sentAt: new Date('2026-07-11T00:00:00.000Z'),
            company: { id: 'company_1', name: '株式会社テスト', isBlocked: false },
            contact: null,
            lead: {
              id: 'lead_1',
              status: 'replied',
              priority: 'high',
              score: 80,
              nextActionAt: null,
              project: { id: 'project_1', title: '新商品', url: 'https://example.com/project' }
            }
          }
        }]
      })
    };
    const useCase = new ListReplyInboxUseCase(repository as any);

    const result = await useCase.execute({ category: 'need_info', limit: 20 });

    expect(repository.list).toHaveBeenCalledWith({ category: 'need_info', limit: 20 });
    expect(result).toMatchObject({ page: 1, limit: 20, total: 1 });
    expect(result.items[0]).toMatchObject({
      id: 'reply_1',
      category: 'need_info',
      categoryLabel: '資料・詳細希望',
      flags: { hasReply: true }
    });
  });
});
