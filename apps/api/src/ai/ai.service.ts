import { Injectable } from '@nestjs/common';
import { AnalyzeLeadUseCase } from './application/analyze-lead.usecase';
import { ClassifyReplyUseCase } from './application/classify-reply.usecase';
import { CheckMailSemanticConsistencyUseCase } from './application/check-mail-semantic-consistency.usecase';
import { GenerateMailDraftUseCase } from './application/generate-mail-draft.usecase';
import { ListLeadGenerationsUseCase } from './application/list-lead-generations.usecase';
import { PolishMailUseCase } from './application/polish-mail.usecase';
import { GenerateMailDto } from './ai.dto';

@Injectable()
export class AiService {
  constructor(
    private readonly analyzeLeadUseCase: AnalyzeLeadUseCase,
    private readonly generateMailDraftUseCase: GenerateMailDraftUseCase,
    private readonly polishMailUseCase: PolishMailUseCase,
    private readonly classifyReplyUseCase: ClassifyReplyUseCase,
    private readonly listLeadGenerationsUseCase: ListLeadGenerationsUseCase,
    private readonly checkMailSemanticConsistencyUseCase: CheckMailSemanticConsistencyUseCase
  ) {}

  async analyzeLead(leadId: string) {
    return this.analyzeLeadUseCase.execute(leadId);
  }

  async generateMailDraft(leadId: string, dto: GenerateMailDto) {
    return this.generateMailDraftUseCase.execute(leadId, dto);
  }

  async polishMail(mailId: string) {
    return this.polishMailUseCase.execute(mailId);
  }

  async classifyReply(replyId: string) {
    return this.classifyReplyUseCase.execute(replyId);
  }

  async listLeadGenerations(leadId: string) {
    return this.listLeadGenerationsUseCase.execute(leadId);
  }

  async checkMailSemanticConsistency(mailId: string) {
    return this.checkMailSemanticConsistencyUseCase.execute(mailId);
  }
}
