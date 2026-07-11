import { Controller, Get, Header } from '@nestjs/common';
import { renderDashboardPage } from './ui/dashboard-page';
import { renderLeadsPage } from './ui/leads-page';
import { renderTodayPage } from './ui/today-page';

@Controller()
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

  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  index() {
    return renderDashboardPage('url-search');
  }
}
