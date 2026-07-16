import { bindAbortToResource, OperationAbortedError } from './abortable-resource';

describe('abortable resource', () => {
  it('closes the resource once and exposes cancellation immediately', async () => {
    const controller = new AbortController();
    const close = jest.fn().mockResolvedValue(undefined);
    const resource = bindAbortToResource(controller.signal, close);

    controller.abort();
    await resource.close();
    await resource.close();

    expect(close).toHaveBeenCalledTimes(1);
    expect(() => resource.throwIfAborted()).toThrow(OperationAbortedError);
  });

  it('does not close after the listener is disposed', async () => {
    const controller = new AbortController();
    const close = jest.fn().mockResolvedValue(undefined);
    const resource = bindAbortToResource(controller.signal, close);
    resource.dispose();

    controller.abort();
    await Promise.resolve();

    expect(close).not.toHaveBeenCalled();
  });

  it('preserves the cleanup order owned by the resource closer', async () => {
    const controller = new AbortController();
    const events: string[] = [];
    const resource = bindAbortToResource(controller.signal, async () => {
      events.push('context');
      await Promise.resolve();
      events.push('browser');
    });

    controller.abort();
    await resource.close();

    expect(events).toEqual(['context', 'browser']);
  });
});
