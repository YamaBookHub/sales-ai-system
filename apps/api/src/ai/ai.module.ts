import { Module } from '@nestjs/common';
import { AnalyzeLeadUseCase } from './application/analyze-lead.usecase';
import { ClassifyReplyUseCase } from './application/classify-reply.usecase';
import { CheckMailSemanticConsistencyUseCase } from './application/check-mail-semantic-consistency.usecase';
import { GenerateMailDraftUseCase } from './application/generate-mail-draft.usecase';
import { ListLeadGenerationsUseCase } from './application/list-lead-generations.usecase';
import { PolishMailUseCase } from './application/polish-mail.usecase';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { OpenAiClientService } from './openai-client.service';

@Module({
  controllers: [AiController],
  providers: [
    AiService,
    OpenAiClientService,
    AnalyzeLeadUseCase,
    CheckMailSemanticConsistencyUseCase,
    GenerateMailDraftUseCase,
    PolishMailUseCase,
    ClassifyReplyUseCase,
    ListLeadGenerationsUseCase
  ],
  exports: [AiService]
})
export class AiModule {}
