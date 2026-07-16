import { Injectable } from '@nestjs/common';
import type { SelectableAiModel } from './domain/ai-model';
import { isGeminiModel, resolveRequestedAiModel } from './domain/ai-model';
import type { SalesMailDraftInput } from './domain/openai-sales-mail-draft';
import type { SemanticConsistencyInput } from './domain/semantic-consistency';
import { GeminiClientService } from './gemini-client.service';
import { OpenAiClientService } from './openai-client.service';

@Injectable()
export class AiClientService {
  constructor(
    private readonly gemini: GeminiClientService,
    private readonly openAi: OpenAiClientService
  ) {}

  async createSalesMailDraft(input: SalesMailDraftInput, requestedModel?: SelectableAiModel) {
    const model = resolveRequestedAiModel(requestedModel);
    return isGeminiModel(model)
      ? this.gemini.createSalesMailDraft(input, model)
      : this.openAi.createSalesMailDraft(input, model);
  }

  async checkSemanticConsistency(input: SemanticConsistencyInput, requestedModel?: SelectableAiModel) {
    const model = resolveRequestedAiModel(requestedModel);
    return isGeminiModel(model)
      ? this.gemini.checkSemanticConsistency(input, model)
      : this.openAi.checkSemanticConsistency(input, model);
  }
}
