import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  isCompleteStructuredAnalysis,
  projectSourceFingerprint
} from '../domain/lead-analysis';

type LeadWithProject = {
  id: string;
  project: {
    id: string;
    title: string;
    url: string;
    category: string | null;
    description: string | null;
  } | null;
};

export async function requireLatestConfirmedAnalysis(
  tx: Pick<Prisma.TransactionClient, 'leadAnalysisRevision'>,
  lead: LeadWithProject,
  analysisRevisionId: string
) {
  if (!lead.project) {
    throw new ConflictException('この営業対象には案件が紐づいていません。');
  }
  const fingerprint = projectSourceFingerprint(lead.project);
  const [analysisRevision, latestUsableConfirmed] = await Promise.all([
    tx.leadAnalysisRevision.findUnique({ where: { id: analysisRevisionId } }),
    tx.leadAnalysisRevision.findFirst({
      where: {
        leadId: lead.id,
        projectId: lead.project.id,
        status: 'confirmed',
        sourceFingerprint: fingerprint
      },
      orderBy: [{ version: 'desc' }, { createdAt: 'desc' }]
    })
  ]);

  if (!analysisRevision
    || analysisRevision.leadId !== lead.id
    || analysisRevision.projectId !== lead.project.id
    || analysisRevision.status !== 'confirmed'
    || analysisRevision.sourceFingerprint !== fingerprint
    || !isCompleteStructuredAnalysis(analysisRevision)
    || latestUsableConfirmed?.id !== analysisRevision.id) {
    throw new ConflictException('確認済みの最新分析を選択してからメールを生成してください。');
  }

  return analysisRevision;
}
