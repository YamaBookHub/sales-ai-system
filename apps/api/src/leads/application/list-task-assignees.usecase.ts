import { Inject, Injectable } from '@nestjs/common';
import { TASK_REPOSITORY, TaskRepository } from '../domain/task.repository';

@Injectable()
export class ListTaskAssigneesUseCase {
  constructor(@Inject(TASK_REPOSITORY) private readonly tasks: TaskRepository) {}

  execute() {
    return this.tasks.listAssignees();
  }
}
