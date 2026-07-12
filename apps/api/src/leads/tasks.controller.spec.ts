import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { TasksController } from './tasks.controller';

describe('TasksController routes', () => {
  it('keeps task API paths explicit and separate from lead updates', () => {
    expect(Reflect.getMetadata(PATH_METADATA, TasksController)).toBe('/');
    expect(Reflect.getMetadata(PATH_METADATA, TasksController.prototype.list)).toBe('leads/:leadId/tasks');
    expect(Reflect.getMetadata(PATH_METADATA, TasksController.prototype.create)).toBe('leads/:leadId/tasks');
    expect(Reflect.getMetadata(PATH_METADATA, TasksController.prototype.update)).toBe('tasks/:taskId');
    expect(Reflect.getMetadata(PATH_METADATA, TasksController.prototype.assignees)).toBe('task-assignees');
    expect(Reflect.getMetadata(METHOD_METADATA, TasksController.prototype.list)).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata(METHOD_METADATA, TasksController.prototype.create)).toBe(RequestMethod.POST);
    expect(Reflect.getMetadata(METHOD_METADATA, TasksController.prototype.update)).toBe(RequestMethod.PATCH);
  });
});
