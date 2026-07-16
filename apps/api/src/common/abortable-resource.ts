export class OperationAbortedError extends Error {
  constructor(message = '処理を停止しました') {
    super(message);
    this.name = 'AbortError';
  }
}

export function bindAbortToResource(signal: AbortSignal | undefined, closeResource: () => Promise<unknown>) {
  let closePromise: Promise<void> | null = null;
  const close = () => {
    if (!closePromise) {
      closePromise = Promise.resolve(closeResource()).then(() => undefined, () => undefined);
    }
    return closePromise;
  };
  const onAbort = () => {
    void close();
  };

  signal?.addEventListener('abort', onAbort, { once: true });
  if (signal?.aborted) onAbort();

  return {
    close,
    dispose() {
      signal?.removeEventListener('abort', onAbort);
    },
    throwIfAborted() {
      if (signal?.aborted) throw new OperationAbortedError();
    }
  };
}
