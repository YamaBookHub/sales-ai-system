import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MailDispatchWorker } from './mail/application/mail-dispatch.worker';
import { readMailSenderConfig } from './mail/infrastructure/mail-sender.config';
import { StructuredLogger } from './common/logging/structured-logger.service';

const POLL_INTERVAL_MS = 5_000;

async function bootstrap() {
  const sender = readMailSenderConfig();
  if (!sender.enabled || sender.provider === 'disabled') {
    throw new Error('Mail worker requires MAIL_SEND_ENABLED=true and a supported provider.');
  }

  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true });
  const logger = app.get(StructuredLogger);
  app.useLogger(logger);
  const worker = app.get(MailDispatchWorker);
  let stopping = false;

  const stop = async () => {
    if (stopping) return;
    stopping = true;
    await app.close();
  };
  process.once('SIGINT', () => void stop());
  process.once('SIGTERM', () => void stop());

  while (!stopping) {
    const result = await worker.runOnce();
    if (!result.dispatched) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }
}

void bootstrap();
