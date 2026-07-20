import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { canCreateTaskForLead } from '../domain/task';
import { CreateTaskRecord, TASK_REPOSITORY, TaskRepository } from '../domain/task.repository';
import { AuditActor } from '../../audit/audit-actor';

export type CreateLeadTaskInput = {
  title: string;
  description?: string;
  dueAt?: string;
  assigneeId?: string;
};

@Injectable()
export class CreateLeadTaskUseCase {
  constructor(@Inject(TASK_REPOSITORY) private readonly tasks: TaskRepository) {}

  async execute(leadId: string, input: CreateLeadTaskInput, actor?: AuditActor) {
    const lead = await this.tasks.findLead(leadId);
    if (!lead) throw new NotFoundException('Lead not found');
    if (!canCreateTaskForLead(lead.status)) throw new ConflictException('Cannot create a task for a terminal lead');

    const title = input.title.trim();
    if (!title) throw new BadRequestException('Task title is required');
    if (input.assigneeId && !(await this.tasks.findAssignee(input.assigneeId))) {
      throw new BadRequestException('Assignee is not active or does not exist');
    }

    const record: CreateTaskRecord = {
      leadId,
      title,
      description: input.description?.trim() || undefined,
      dueAt: parseDate(input.dueAt),
      assigneeId: input.assigneeId
    };
    return actor ? this.tasks.create(record, actor) : this.tasks.create(record);
  }
}

function parseDate(value?: string) {
  return value ? new Date(value) : undefined;
}
