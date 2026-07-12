import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import 'reflect-metadata';
import { AppModule } from './app.module';
import { renderRepliesPage } from './dashboard/ui/replies-page';

type HtmlResponse = { type: (contentType: string) => { send: (body: string) => void } };

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.getHttpAdapter().getInstance().get('/replies', (_request: unknown, response: HtmlResponse) => {
    response.type('text/html; charset=utf-8').send(renderRepliesPage());
  });
  app.setGlobalPrefix('api', {
    exclude: ['/', '/leads-view', '/mail-workspace', '/today', '/health', '/t/open/:emailId.png', '/t/click/:token']
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
