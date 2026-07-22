import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';

export type RequestLogContext = {
  requestId: string;
  userId?: string;
  organizationId?: string;
};

@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<RequestLogContext>();

  run<T>(context: RequestLogContext, callback: () => T): T {
    return this.storage.run(context, callback);
  }

  setActor(actor: { userId?: string; organizationId?: string } | undefined): void {
    const context = this.storage.getStore();
    if (!context || !actor) return;
    if (actor.userId) context.userId = actor.userId;
    if (actor.organizationId) context.organizationId = actor.organizationId;
  }

  current(): RequestLogContext | undefined {
    return this.storage.getStore();
  }
}
