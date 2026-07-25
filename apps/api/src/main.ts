import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import 'reflect-metadata';
import { AppModule } from './app.module';
import { StructuredLogger } from './common/logging/structured-logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(StructuredLogger));
  app.setGlobalPrefix('api', {
    exclude: ['/', '/login', '/leads-view', '/mail-workspace', '/today', '/sales-performance', '/operations', '/replies', '/api/replies', '/health', '/t/open/:emailId.png', '/t/click/:token']
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
  await app.listen(port, host);
}

void bootstrap();
