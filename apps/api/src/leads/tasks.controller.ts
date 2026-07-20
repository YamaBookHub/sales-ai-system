import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ok } from '../common/api-response';
import { CreateLeadTaskUseCase } from './application/create-lead-task.usecase';
import { ListLeadTasksUseCase } from './application/list-lead-tasks.usecase';
import { ListTaskAssigneesUseCase } from './application/list-task-assignees.usecase';
import { UpdateTaskUseCase } from './application/update-task.usecase';
import { CreateTaskDto, ListTasksQueryDto, UpdateTaskDto } from './tasks.dto';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedPrincipal } from '../auth/auth.types';
import { auditActor } from '../audit/audit-actor';

@Controller()
@RequirePermissions('workspace.read')
export class TasksController {
  constructor(
    private readonly listLeadTasks: ListLeadTasksUseCase,
    private readonly createLeadTask: CreateLeadTaskUseCase,
    private readonly updateTask: UpdateTaskUseCase,
    private readonly listTaskAssignees: ListTaskAssigneesUseCase
  ) {}

  @Get('leads/:leadId/tasks')
  async list(
    @Param('leadId', new ParseUUIDPipe()) leadId: string,
    @Query() query: ListTasksQueryDto,
    @CurrentUser() principal: AuthenticatedPrincipal
  ) {
    return ok(await this.listLeadTasks.execute(principal.organizationId, leadId, query.scope || 'active'));
  }

  @Post('leads/:leadId/tasks')
  @RequirePermissions('records.write')
  async create(
    @Param('leadId', new ParseUUIDPipe()) leadId: string,
    @Body() dto: CreateTaskDto,
    @CurrentUser() principal: AuthenticatedPrincipal
  ) {
    return ok(await this.createLeadTask.execute(leadId, dto, auditActor(principal)));
  }

  @Patch('tasks/:taskId')
  @RequirePermissions('records.write')
  async update(
    @Param('taskId', new ParseUUIDPipe()) taskId: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() principal: AuthenticatedPrincipal
  ) {
    return ok(await this.updateTask.execute(taskId, dto, auditActor(principal)));
  }

  @Get('task-assignees')
  async assignees(@CurrentUser() principal: AuthenticatedPrincipal) {
    return ok(await this.listTaskAssignees.execute(principal.organizationId));
  }
}
