import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { CampfireScraperService } from '../scraper/campfire-scraper.service';
import { CampfireProjectSourceProvider } from './campfire-project-source.provider';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  imports: [AiModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, CampfireScraperService, CampfireProjectSourceProvider]
})
export class ProjectsModule {}
