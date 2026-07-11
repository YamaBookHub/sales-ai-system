import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { checkDraftConsistency } from '../../ai/domain/draft-consistency';

@Injectable()
export class CheckMailDraftConsistencyUseCase {
  constructor(private readonly prisma: PrismaService) {}

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

    const companies = await this.prisma.company.findMany({
      where: { deletedAt: null },
      select: { name: true },
      take: 500
    });
    const output = asRecord(email.aiGenerations[0]?.outputJson);
    const companyName = email.company?.name || email.lead?.company?.name || '';

    return checkDraftConsistency({
      companyName,
      projectTitle: email.lead?.project?.title,
      body: email.body,
      factsUsed: stringArray(output?.factsUsed),
      knownCompanyNames: companies.map((company) => company.name)
    });
  }
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}
