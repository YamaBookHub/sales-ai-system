import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { OpenAiClientService } from './openai-client.service';

@Module({
  controllers: [AiController],
  providers: [AiService, OpenAiClientService]
})
export class AiModule {}
