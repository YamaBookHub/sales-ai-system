import { Injectable } from '@nestjs/common';
import { AnalyzeLeadUseCase } from './application/analyze-lead.usecase';
import { ClassifyReplyUseCase } from './application/classify-reply.usecase';
import { CheckMailSemanticConsistencyUseCase } from './application/check-mail-semantic-consistency.usecase';
import { GenerateMailDraftUseCase } from './application/generate-mail-draft.usecase';
import { ListLeadGenerationsUseCase } from './application/list-lead-generations.usecase';
import { LeadAnalysisUseCase } from './application/lead-analysis.usecase';
import { PolishMailUseCase } from './application/polish-mail.usecase';
import { OpenAiBudgetService } from './application/openai-budget.service';
import { GenerateMailDto, UpdateLeadAnalysisDto } from './ai.dto';
import type { SelectableAiModel } from './ai.dto';
import type { AuditActor } from '../audit/audit-actor';

@Injectable()
export class AiService {
  constructor(
    private readonly analyzeLeadUseCase: AnalyzeLeadUseCase,
    private readonly generateMailDraftUseCase: GenerateMailDraftUseCase,
    private readonly polishMailUseCase: PolishMailUseCase,
    private readonly classifyReplyUseCase: ClassifyReplyUseCase,
    private readonly listLeadGenerationsUseCase: ListLeadGenerationsUseCase,
    private readonly checkMailSemanticConsistencyUseCase: CheckMailSemanticConsistencyUseCase,
    private readonly leadAnalysisUseCase: LeadAnalysisUseCase,
    private readonly openAiBudgetService: OpenAiBudgetService
  ) {}

  async analyzeLead(leadId: string, actor: AuditActor | null = null) {
    return this.analyzeLeadUseCase.execute(leadId, actor);
  }

  async generateMailDraft(leadId: string, dto: GenerateMailDto, actor: AuditActor | null = null) {
    return this.generateMailDraftUseCase.execute(leadId, dto, actor);
  }

  getLeadAnalysis(leadId: string) {
    return this.leadAnalysisUseCase.get(leadId);
  }

  saveLeadAnalysis(leadId: string, dto: UpdateLeadAnalysisDto, actor: AuditActor | null = null) {
    return this.leadAnalysisUseCase.save(leadId, dto, actor);
  }

  confirmLeadAnalysis(leadId: string, dto: UpdateLeadAnalysisDto, actor: AuditActor | null = null) {
    return this.leadAnalysisUseCase.confirm(leadId, dto, actor);
  }

  async polishMail(mailId: string, model?: SelectableAiModel, actor: AuditActor | null = null) {
    return this.polishMailUseCase.execute(mailId, model, actor);
  }

  async classifyReply(replyId: string, actor: AuditActor | null = null) {
    return this.classifyReplyUseCase.execute(replyId, actor);
  }

  async listLeadGenerations(leadId: string) {
    return this.listLeadGenerationsUseCase.execute(leadId);
  }

  async checkMailSemanticConsistency(mailId: string, model?: SelectableAiModel) {
    return this.checkMailSemanticConsistencyUseCase.execute(mailId, model);
  }

  getOpenAiUsageSummary() {
    return this.openAiBudgetService.getUsageSummary();
  }
}
