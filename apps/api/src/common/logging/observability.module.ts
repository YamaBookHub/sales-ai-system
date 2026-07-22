import { Global, MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { RequestContextService } from './request-context.service';
import { RequestLoggingMiddleware } from './request-logging.middleware';
import { StructuredLogger } from './structured-logger.service';

@Global()
@Module({
  providers: [RequestContextService, StructuredLogger, RequestLoggingMiddleware],
  exports: [RequestContextService, StructuredLogger]
})
export class ObservabilityModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLoggingMiddleware).forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
