import { Controller, Get, Header } from '@nestjs/common';
import { renderDashboardPage } from './ui/dashboard-page';
import { renderLeadsPage } from './ui/leads-page';
import { renderSalesPerformancePage } from './ui/sales-performance-page';
import { renderTodayPage } from './ui/today-page';
import { renderRepliesPage } from './ui/replies-page';
import { RequirePermissions } from '../auth/require-permissions.decorator';

@Controller()
@RequirePermissions('workspace.read')
export class DashboardController {
  @Get('leads-view')
  @Header('Content-Type', 'text/html; charset=utf-8')
  leadsView() {
    return renderLeadsPage();
  }

  @Get('mail-workspace')
  @Header('Content-Type', 'text/html; charset=utf-8')
  mailWorkspace() {
    return renderDashboardPage('mail-workspace');
  }

  @Get('today')
  @Header('Content-Type', 'text/html; charset=utf-8')
  today() {
    return renderTodayPage();
  }

  @Get('sales-performance')
  @Header('Content-Type', 'text/html; charset=utf-8')
  salesPerformance() {
    return renderSalesPerformancePage();
  }

  @Get('replies')
  @Header('Content-Type', 'text/html; charset=utf-8')
  replies() {
    return renderRepliesPage();
  }

  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  index() {
    return renderDashboardPage('url-search');
  }
}
