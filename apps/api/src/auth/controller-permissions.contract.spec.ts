import { REQUIRED_PERMISSIONS } from './require-permissions.decorator';
import { AiController } from '../ai/ai.controller';
import { AuthController } from './auth.controller';
import { CompaniesController } from '../companies/companies.controller';
import { ContactsController } from '../contacts/contacts.controller';
import { DashboardController } from '../dashboard/dashboard.controller';
import { NavigationSummaryController } from '../dashboard/navigation-summary.controller';
import { TasksController } from '../leads/tasks.controller';
import { LeadsController } from '../leads/leads.controller';
import { OpportunitiesController } from '../leads/opportunities.controller';
import { MailController } from '../mail/mail.controller';
import { ReplyInboxController } from '../mail/reply-inbox.controller';
import { SalesPerformanceController } from '../performance/sales-performance.controller';
import { ProjectsController } from '../projects/projects.controller';
import { TrackingController } from '../tracking/tracking.controller';
import { UsersController } from '../users/users.controller';
import { AuditController } from '../audit/audit.controller';

type ControllerClass = new (...args: any[]) => unknown;
type Permission = string;

describe('controller permission metadata contract', () => {
  it('gives every protected controller a fail-closed default permission', () => {
    const defaults: Array<[ControllerClass, Permission]> = [
      [AiController, 'workspace.read'],
      [AuthController, 'workspace.read'],
      [CompaniesController, 'workspace.read'],
      [ContactsController, 'workspace.read'],
      [DashboardController, 'workspace.read'],
      [NavigationSummaryController, 'workspace.read'],
      [TasksController, 'workspace.read'],
      [LeadsController, 'workspace.read'],
      [OpportunitiesController, 'workspace.read'],
      [MailController, 'workspace.read'],
      [ReplyInboxController, 'workspace.read'],
      [SalesPerformanceController, 'reports.read'],
      [ProjectsController, 'workspace.read'],
      [TrackingController, 'workspace.read'],
      [UsersController, 'user.manage'],
      [AuditController, 'audit.read']
    ];

    for (const [controller, permission] of defaults) {
      expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, controller)).toEqual([permission]);
    }
  });

  it('overrides the default for every non-read capability boundary', () => {
    const overrides: Array<[ControllerClass, string, Permission]> = [
      [AiController, 'generateMailDraft', 'analysis.execute'],
      [AiController, 'generateMailDraftAlias', 'analysis.execute'],
      [AiController, 'analyzeLead', 'analysis.execute'],
      [AiController, 'saveLeadAnalysis', 'analysis.execute'],
      [AiController, 'confirmLeadAnalysis', 'analysis.execute'],
      [AiController, 'polishMail', 'analysis.execute'],
      [AiController, 'checkMailSemanticConsistency', 'analysis.execute'],
      [AiController, 'getUsageSummary', 'ai.cost.read'],
      [AiController, 'classifyReply', 'analysis.execute'],
      [CompaniesController, 'create', 'records.write'],
      [CompaniesController, 'block', 'compliance.manage'],
      [ContactsController, 'create', 'records.write'],
      [ContactsController, 'update', 'records.write'],
      [ContactsController, 'archive', 'records.write'],
      [ContactsController, 'unsubscribe', 'compliance.manage'],
      [LeadsController, 'create', 'records.write'],
      [LeadsController, 'update', 'records.write'],
      [LeadsController, 'score', 'records.write'],
      [OpportunitiesController, 'update', 'opportunity.write'],
      [OpportunitiesController, 'transition', 'opportunity.write'],
      [OpportunitiesController, 'reopen', 'opportunity.reopen'],
      [TasksController, 'create', 'records.write'],
      [TasksController, 'update', 'records.write'],
      [ProjectsController, 'create', 'prospecting.execute'],
      [ProjectsController, 'importCampfire', 'prospecting.execute'],
      [ProjectsController, 'importProject', 'prospecting.execute'],
      [ProjectsController, 'bulkImport', 'prospecting.execute'],
      [ProjectsController, 'searchCampfire', 'prospecting.execute'],
      [ProjectsController, 'searchProjects', 'prospecting.execute'],
      [ProjectsController, 'startSearchJob', 'prospecting.execute'],
      [ProjectsController, 'cancelSearchJob', 'prospecting.execute'],
      [MailController, 'createDraft', 'records.write'],
      [MailController, 'saveTemplate', 'template.manage'],
      [MailController, 'importTemplates', 'template.manage'],
      [MailController, 'update', 'records.write'],
      [MailController, 'updateChecklist', 'records.write'],
      [MailController, 'requestReview', 'records.write'],
      [MailController, 'requestReReview', 'records.write'],
      [MailController, 'approve', 'mail.review'],
      [MailController, 'reject', 'mail.review'],
      [MailController, 'queue', 'mail.queue'],
      [MailController, 'markSent', 'records.write'],
      [MailController, 'sendQueued', 'mail.send'],
      [MailController, 'recordReply', 'records.write'],
      [MailController, 'retry', 'mail.queue'],
      [MailController, 'cancel', 'mail.queue'],
      [TrackingController, 'createTrackedLink', 'records.write'],
      [TrackingController, 'unsubscribe', 'compliance.manage']
    ];

    for (const [controller, method, permission] of overrides) {
      const handler = (controller as any).prototype[method];
      expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, handler)).toEqual([permission]);
    }
  });

});
