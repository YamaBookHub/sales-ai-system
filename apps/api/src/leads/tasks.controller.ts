import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ok } from '../common/api-response';
import { CreateLeadTaskUseCase } from './application/create-lead-task.usecase';
import { ListLeadTasksUseCase } from './application/list-lead-tasks.usecase';
import { ListTaskAssigneesUseCase } from './application/list-task-assignees.usecase';
import { UpdateTaskUseCase } from './application/update-task.usecase';
import { CreateTaskDto, ListTasksQueryDto, UpdateTaskDto } from './tasks.dto';

@Controller()
export class TasksController {
  constructor(
    private readonly listLeadTasks: ListLeadTasksUseCase,
    private readonly createLeadTask: CreateLeadTaskUseCase,
    private readonly updateTask: UpdateTaskUseCase,
    private readonly listTaskAssignees: ListTaskAssigneesUseCase
  ) {}

  @Get('leads/:leadId/tasks')
  async list(@Param('leadId', new ParseUUIDPipe()) leadId: string, @Query() query: ListTasksQueryDto) {
    return ok(await this.listLeadTasks.execute(leadId, query.scope || 'active'));
  }

  @Post('leads/:leadId/tasks')
  async create(@Param('leadId', new ParseUUIDPipe()) leadId: string, @Body() dto: CreateTaskDto) {
    return ok(await this.createLeadTask.execute(leadId, dto));
  }

  @Patch('tasks/:taskId')
  async update(@Param('taskId', new ParseUUIDPipe()) taskId: string, @Body() dto: UpdateTaskDto) {
    return ok(await this.updateTask.execute(taskId, dto));
  }

  @Get('task-assignees')
  async assignees() {
    return ok(await this.listTaskAssignees.execute());
  }
}
