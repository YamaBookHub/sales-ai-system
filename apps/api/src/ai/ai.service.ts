import { Injectable } from '@nestjs/common';
import { AnalyzeLeadUseCase } from './application/analyze-lead.usecase';
import { ClassifyReplyUseCase } from './application/classify-reply.usecase';
import { CheckMailSemanticConsistencyUseCase } from './application/check-mail-semantic-consistency.usecase';
import { GenerateMailDraftUseCase } from './application/generate-mail-draft.usecase';
import { ListLeadGenerationsUseCase } from './application/list-lead-generations.usecase';
import { LeadAnalysisUseCase } from './application/lead-analysis.usecase';
import { PolishMailUseCase } from './application/polish-mail.usecase';
import { GenerateMailDto, UpdateLeadAnalysisDto } from './ai.dto';
import type { SelectableAiModel } from './ai.dto';

@Injectable()
export class AiService {
  constructor(
    private readonly analyzeLeadUseCase: AnalyzeLeadUseCase,
    private readonly generateMailDraftUseCase: GenerateMailDraftUseCase,
    private readonly polishMailUseCase: PolishMailUseCase,
    private readonly classifyReplyUseCase: ClassifyReplyUseCase,
    private readonly listLeadGenerationsUseCase: ListLeadGenerationsUseCase,
    private readonly checkMailSemanticConsistencyUseCase: CheckMailSemanticConsistencyUseCase,
    private readonly leadAnalysisUseCase: LeadAnalysisUseCase
  ) {}

  async analyzeLead(leadId: string) {
    return this.analyzeLeadUseCase.execute(leadId);
  }

  async generateMailDraft(leadId: string, dto: GenerateMailDto) {
    return this.generateMailDraftUseCase.execute(leadId, dto);
  }

  getLeadAnalysis(leadId: string) {
    return this.leadAnalysisUseCase.get(leadId);
  }

  saveLeadAnalysis(leadId: string, dto: UpdateLeadAnalysisDto) {
    return this.leadAnalysisUseCase.save(leadId, dto);
  }

  confirmLeadAnalysis(leadId: string, dto: UpdateLeadAnalysisDto) {
    return this.leadAnalysisUseCase.confirm(leadId, dto);
  }

  async polishMail(mailId: string, model?: SelectableAiModel) {
    return this.polishMailUseCase.execute(mailId, model);
  }

  async classifyReply(replyId: string) {
    return this.classifyReplyUseCase.execute(replyId);
  }

  async listLeadGenerations(leadId: string) {
    return this.listLeadGenerationsUseCase.execute(leadId);
  }

  async checkMailSemanticConsistency(mailId: string, model?: SelectableAiModel) {
    return this.checkMailSemanticConsistencyUseCase.execute(mailId, model);
  }
}
