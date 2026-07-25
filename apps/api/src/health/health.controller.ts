import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ok } from '../common/api-response';
import { Public } from '../auth/public.decorator';
import { HealthService } from './health.service';

@Controller()
@SkipThrottle()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('health')
  @Public()
  health() {
    return ok({ status: 'ok' });
  }

  @Get('ready')
  @Public()
  async ready() {
    const readiness = await this.healthService.readiness();
    if (!readiness.ready) {
      throw new ServiceUnavailableException({
        status: 'not_ready',
        reason: 'database_or_schema_not_ready'
      });
    }
    return ok({
      status: 'ready',
      migration: readiness.migration
    });
  }
}
