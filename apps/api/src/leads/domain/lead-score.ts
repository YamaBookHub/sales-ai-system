export type LeadScoreInput = {
  projectAmount?: number | null;
  supporterCount?: number | null;
  category?: string | null;
  endDate?: Date | string | null;
};

export type LeadScoreResult = {
  amountScore: number;
  supporterScore: number;
  fitScore: number;
  urgencyScore: number;
  activityScore: number;
  totalScore: number;
  reasonJson: {
    projectAmount: number;
    supporterCount: number;
    note: string;
  };
};

export function calculateLeadScore(input: LeadScoreInput): LeadScoreResult {
  const projectAmount = input.projectAmount ?? 0;
  const supporterCount = input.supporterCount ?? 0;
  const amountScore = Math.min(30, Math.floor(projectAmount / 1000000) * 5);
  const supporterScore = Math.min(25, Math.floor(supporterCount / 100) * 5);
  const fitScore = input.category ? 20 : 10;
  const urgencyScore = input.endDate ? 10 : 5;
  const activityScore = 10;
  const totalScore = amountScore + supporterScore + fitScore + urgencyScore + activityScore;

  return {
    amountScore,
    supporterScore,
    fitScore,
    urgencyScore,
    activityScore,
    totalScore,
    reasonJson: {
      projectAmount,
      supporterCount,
      note: 'MVP scoring formula. TODO: align with docs/10_AI.md lead score details.'
    }
  };
}
