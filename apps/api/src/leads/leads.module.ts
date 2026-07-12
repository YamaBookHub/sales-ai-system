import { Module } from '@nestjs/common';
import { ScoreLeadUseCase } from './application/score-lead.usecase';
import { CreateLeadTaskUseCase } from './application/create-lead-task.usecase';
import { ListLeadTasksUseCase } from './application/list-lead-tasks.usecase';
import { ListTaskAssigneesUseCase } from './application/list-task-assignees.usecase';
import { UpdateTaskUseCase } from './application/update-task.usecase';
import { PrismaLeadRepository } from './infrastructure/prisma-lead.repository';
import { PrismaTaskRepository } from './infrastructure/prisma-task.repository';
import { TASK_REPOSITORY } from './domain/task.repository';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { TasksController } from './tasks.controller';

@Module({
  controllers: [LeadsController, TasksController],
  providers: [
    LeadsService,
    ScoreLeadUseCase,
    PrismaLeadRepository,
    PrismaTaskRepository,
    { provide: TASK_REPOSITORY, useExisting: PrismaTaskRepository },
    ListLeadTasksUseCase,
    CreateLeadTaskUseCase,
    UpdateTaskUseCase,
    ListTaskAssigneesUseCase
  ],
  exports: [LeadsService]
})
export class LeadsModule {}
