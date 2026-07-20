import { Controller, Get } from '@nestjs/common';
import { ok } from '../common/api-response';
import { Public } from '../auth/public.decorator';

@Controller('health')
export class HealthController {
  @Get()
  @Public()
  health() {
    return ok({ status: 'ok' });
  }
}
