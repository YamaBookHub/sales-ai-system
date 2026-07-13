import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { NavigationSummaryController } from './navigation-summary.controller';
import { NavigationSummaryService } from './navigation-summary.service';

@Module({
  controllers: [DashboardController, NavigationSummaryController],
  providers: [NavigationSummaryService]
})
export class DashboardModule {}
