import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { TASK_REPOSITORY, TaskRepository, TaskScope } from '../domain/task.repository';

@Injectable()
export class ListLeadTasksUseCase {
  constructor(@Inject(TASK_REPOSITORY) private readonly tasks: TaskRepository) {}

  async execute(organizationId: string, leadId: string, scope: TaskScope = 'active') {
    if (!(await this.tasks.findLead(organizationId, leadId))) {
      throw new NotFoundException('Lead not found');
    }
    return this.tasks.listByLead(organizationId, leadId, scope);
  }
}
