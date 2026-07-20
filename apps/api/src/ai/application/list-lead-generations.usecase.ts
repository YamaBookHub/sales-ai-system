import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ListLeadGenerationsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(leadId: string, organizationId: string) {
    const lead = await this.prisma.salesLead.findFirst({
      where: { id: leadId, organizationId },
      select: { id: true }
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const items = await this.prisma.aiGeneration.findMany({
      where: { organizationId, leadId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        email: {
          select: {
            id: true,
            subject: true,
            status: true,
            createdAt: true
          }
        }
      }
    });

    return { items, total: items.length };
  }
}
