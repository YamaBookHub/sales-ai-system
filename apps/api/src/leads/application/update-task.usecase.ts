import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { transitionTaskStatus } from '../domain/task-policy';
import { TASK_REPOSITORY, TaskRepository, UpdateTaskRecord } from '../domain/task.repository';
import { TaskStatus } from '@prisma/client';

export type UpdateTaskInput = {
  title?: string;
  description?: string | null;
  dueAt?: string | null;
  assigneeId?: string | null;
  status?: TaskStatus;
};

@Injectable()
export class UpdateTaskUseCase {
  constructor(@Inject(TASK_REPOSITORY) private readonly tasks: TaskRepository) {}

  async execute(taskId: string, input: UpdateTaskInput) {
    const current = await this.tasks.findTask(taskId);
    if (!current) throw new NotFoundException('Task not found');
    if (input.assigneeId && !(await this.tasks.findAssignee(input.assigneeId))) {
      throw new BadRequestException('Assignee is not active or does not exist');
    }

    const patch: UpdateTaskRecord = {};
    if (input.title !== undefined) {
      const title = input.title.trim();
      if (!title) throw new BadRequestException('Task title is required');
      patch.title = title;
    }
    if (input.description !== undefined) patch.description = input.description?.trim() || null;
    if (input.dueAt !== undefined) patch.dueAt = parseDate(input.dueAt);
    if (input.assigneeId !== undefined) patch.assigneeId = input.assigneeId;
    if (input.status !== undefined && input.status !== current.status) {
      const transition = transitionTaskStatus(current.status, input.status, current.doneAt);
      if (!transition.ok) throw new ConflictException('Invalid task status transition');
      patch.status = input.status;
      patch.doneAt = transition.doneAt;
    }
    return this.tasks.update(taskId, patch);
  }
}

function parseDate(value: string | null | undefined) {
  return value ? new Date(value) : null;
}
