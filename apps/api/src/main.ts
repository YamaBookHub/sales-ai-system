import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import 'reflect-metadata';
import { AppModule } from './app.module';
import { StructuredLogger } from './common/logging/structured-logger.service';
import { buildHelmetOptions } from './common/security/helmet-options';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(StructuredLogger));
  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', 1);
  }
  app.use(helmet(buildHelmetOptions()));
  app.setGlobalPrefix('api', {
    exclude: ['/', '/login', '/leads-view', '/mail-workspace', '/today', '/sales-performance', '/operations', '/replies', '/api/replies', '/health', '/ready', '/privacy', '/terms', '/t/open/:emailId.png', '/t/click/:token', '/unsubscribe/:token']
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  const host = process.env.HOST || '127.0.0.1';
  app.enableShutdownHooks();
  await app.listen(port, host);
}

void bootstrap();
