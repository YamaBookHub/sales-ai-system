import { MailController } from './mail.controller';

describe('MailController organization boundary', () => {
  const principal = {
    userId: 'user_1',
    sessionId: 'session_1',
    organizationId: 'org_1'
  } as any;

  function createController() {
    const mail = {
      list: jest.fn(),
      createDraft: jest.fn(),
      listTemplates: jest.fn(),
      getTemplate: jest.fn(),
      saveTemplate: jest.fn(),
      importTemplates: jest.fn(),
      update: jest.fn(),
      checkDraftConsistency: jest.fn(),
      getChecklist: jest.fn(),
      updateChecklist: jest.fn(),
      requestReview: jest.fn(),
      requestReReview: jest.fn(),
      approve: jest.fn(),
      reject: jest.fn(),
      queue: jest.fn(),
      markSent: jest.fn(),
      sendQueued: jest.fn(),
      recordReply: jest.fn(),
      retry: jest.fn(),
      cancel: jest.fn(),
      getThread: jest.fn()
    };
    return { controller: new MailController(mail as any), mail };
  }

  it('passes the current organization to every read operation', async () => {
    const { controller, mail } = createController();

    await controller.list('2', '30', undefined, principal);
    await controller.listTemplates('email', principal);
    await controller.getTemplate('normal', principal);
    await controller.checkConsistency('mail_1', principal);
    await controller.getChecklist('mail_1', principal);
    await controller.getThread('thread_1', principal);

    expect(mail.list).toHaveBeenCalledWith('org_1', 2, 30, undefined);
    expect(mail.listTemplates).toHaveBeenCalledWith('org_1', 'email');
    expect(mail.getTemplate).toHaveBeenCalledWith('org_1', 'normal');
    expect(mail.checkDraftConsistency).toHaveBeenCalledWith('mail_1', 'org_1');
    expect(mail.getChecklist).toHaveBeenCalledWith('mail_1', 'org_1');
    expect(mail.getThread).toHaveBeenCalledWith('thread_1', 'org_1');
  });

  it('passes an organization-bound audit actor to every write and workflow operation', async () => {
    const { controller, mail } = createController();
    const actor = expect.objectContaining({
      userId: 'user_1',
      sessionId: 'session_1',
      organizationId: 'org_1'
    });

    await controller.createDraft({ leadId: 'lead_1' } as any, principal);
    await controller.saveTemplate({ key: 'normal' } as any, principal);
    await controller.importTemplates({ templates: [] } as any, principal);
    await controller.update('mail_1', { subject: 'updated' } as any, principal);
    await controller.updateChecklist('mail_1', { items: [] } as any, principal);
    await controller.requestReview('mail_1', principal);
    await controller.requestReReview('mail_1', principal);
    await controller.approve('mail_1', principal);
    await controller.reject('mail_1', { reason: 'fix' } as any, principal);
    await controller.queue('mail_1', principal);
    await controller.markSent('mail_1', {} as any, principal);
    await controller.sendQueued('mail_1', principal);
    await controller.recordReply('mail_1', { body: '返信' } as any, principal);
    await controller.retry('mail_1', principal);
    await controller.cancel('mail_1', principal);

    expect(mail.createDraft).toHaveBeenCalledWith({ leadId: 'lead_1' }, actor);
    expect(mail.saveTemplate).toHaveBeenCalledWith({ key: 'normal' }, actor);
    expect(mail.importTemplates).toHaveBeenCalledWith({ templates: [] }, actor);
    expect(mail.update).toHaveBeenCalledWith('mail_1', { subject: 'updated' }, actor);
    expect(mail.updateChecklist).toHaveBeenCalledWith('mail_1', { items: [] }, actor);
    expect(mail.requestReview).toHaveBeenCalledWith('mail_1', actor);
    expect(mail.requestReReview).toHaveBeenCalledWith('mail_1', actor);
    expect(mail.approve).toHaveBeenCalledWith('mail_1', actor);
    expect(mail.reject).toHaveBeenCalledWith('mail_1', { reason: 'fix' }, actor);
    expect(mail.queue).toHaveBeenCalledWith('mail_1', actor);
    expect(mail.markSent).toHaveBeenCalledWith('mail_1', {}, actor);
    expect(mail.sendQueued).toHaveBeenCalledWith('mail_1', actor);
    expect(mail.recordReply).toHaveBeenCalledWith('mail_1', { body: '返信' }, actor);
    expect(mail.retry).toHaveBeenCalledWith('mail_1', actor);
    expect(mail.cancel).toHaveBeenCalledWith('mail_1', actor);
  });
});
