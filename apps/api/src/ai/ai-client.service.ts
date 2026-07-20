import { Injectable } from '@nestjs/common';
import type { SelectableAiModel } from './domain/ai-model';
import { isGeminiModel, resolveRequestedAiModel } from './domain/ai-model';
import type { SalesMailDraftInput } from './domain/openai-sales-mail-draft';
import type { SemanticConsistencyInput } from './domain/semantic-consistency';
import { GeminiClientService } from './gemini-client.service';
import { OpenAiClientService } from './openai-client.service';
import { OpenAiBudgetService } from './application/openai-budget.service';

@Injectable()
export class AiClientService {
  constructor(
    private readonly gemini: GeminiClientService,
    private readonly openAi: OpenAiClientService,
    private readonly openAiBudget: OpenAiBudgetService
  ) {}

  async createSalesMailDraft(input: SalesMailDraftInput, requestedModel: SelectableAiModel | undefined, organizationId: string) {
    const model = resolveRequestedAiModel(requestedModel);
    if (isGeminiModel(model)) return this.gemini.createSalesMailDraft(input, model);
    this.openAi.assertConfigured();
    return this.openAiBudget.execute(
      {
        organizationId,
        model,
        operation: 'sales_mail_polish',
        requestInput: input,
        maxOutputTokens: numberFromEnv('OPENAI_MAX_OUTPUT_TOKENS', 1200)
      },
      () => this.openAi.createSalesMailDraft(input, model)
    );
  }

  async checkSemanticConsistency(input: SemanticConsistencyInput, requestedModel: SelectableAiModel | undefined, organizationId: string) {
    const model = resolveRequestedAiModel(requestedModel);
    if (isGeminiModel(model)) return this.gemini.checkSemanticConsistency(input, model);
    this.openAi.assertConfigured();
    return this.openAiBudget.execute(
      {
        organizationId,
        model,
        operation: 'semantic_consistency',
        requestInput: input,
        maxOutputTokens: numberFromEnv('OPENAI_SEMANTIC_CHECK_MAX_OUTPUT_TOKENS', 400)
      },
      () => this.openAi.checkSemanticConsistency(input, model)
    );
  }
}

function numberFromEnv(name: string, fallback: number) {
  const value = Number(process.env[name] || fallback);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}
