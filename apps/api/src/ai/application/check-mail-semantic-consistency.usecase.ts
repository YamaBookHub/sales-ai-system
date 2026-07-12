import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OpenAiClientService } from '../openai-client.service';

@Injectable()
export class CheckMailSemanticConsistencyUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly openAi: OpenAiClientService
  ) {}

  async execute(mailId: string) {
    const email = await this.prisma.outreachEmail.findUnique({
      where: { id: mailId },
      include: {
        company: true,
        lead: { include: { company: true, project: true } },
        aiGenerations: {
          where: { type: 'email_draft' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { outputJson: true }
        }
      }
    });

    if (!email) {
      throw new NotFoundException('Mail not found');
    }

    const output = asRecord(email.aiGenerations[0]?.outputJson);
    const companyName = email.company?.name || email.lead?.company?.name || '';
    const result = await this.openAi.checkSemanticConsistency({
      companyName,
      projectTitle: email.lead?.project?.title,
      projectCategory: email.lead?.project?.category,
      projectDescription: email.lead?.project?.description,
      body: email.body,
      factsUsed: stringArray(output?.factsUsed)
    });

    return {
      mailId,
      ...result,
      checkedAt: new Date().toISOString()
    };
  }
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}
