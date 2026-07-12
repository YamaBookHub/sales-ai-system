import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { ReplyInboxController } from './reply-inbox.controller';

describe('ReplyInboxController', () => {
  it('keeps the controller limited to the replies GET endpoint and response wrapper', async () => {
    const useCase = { execute: jest.fn().mockResolvedValue({ items: [], page: 1, limit: 20, total: 0 }) };
    const controller = new ReplyInboxController(useCase as any);
    const query = { limit: 20 } as any;

    await expect(controller.list(query)).resolves.toEqual({
      data: { items: [], page: 1, limit: 20, total: 0 },
      meta: null,
      error: null
    });
    expect(useCase.execute).toHaveBeenCalledWith(query);
    expect(Reflect.getMetadata(PATH_METADATA, ReplyInboxController)).toBe('replies');
    expect(Reflect.getMetadata(PATH_METADATA, ReplyInboxController.prototype.list)).toBe('/');
    expect(Reflect.getMetadata(METHOD_METADATA, ReplyInboxController.prototype.list)).toBe(RequestMethod.GET);
  });
});
