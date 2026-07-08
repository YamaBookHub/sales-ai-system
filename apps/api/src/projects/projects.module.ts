import { Module } from '@nestjs/common';
import { CampfireScraperService } from '../scraper/campfire-scraper.service';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  controllers: [ProjectsController],
  providers: [ProjectsService, CampfireScraperService]
})
export class ProjectsModule {}
