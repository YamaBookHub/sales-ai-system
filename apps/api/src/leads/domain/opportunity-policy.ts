export const OPPORTUNITY_STAGES = [
  'uncontacted',
  'contacted',
  'replied',
  'meeting',
  'proposal',
  'won',
  'lost',
  'excluded'
] as const;

export type OpportunityStage = typeof OPPORTUNITY_STAGES[number];

export const OPPORTUNITY_LOSS_REASONS = [
  'no_interest',
  'no_budget',
  'timing',
  'no_response',
  'competitor',
  'service_mismatch',
  'contact_unavailable',
  'duplicate',
  'other'
] as const;

export type OpportunityLossReason = typeof OPPORTUNITY_LOSS_REASONS[number];
export type OpportunityRole = 'viewer' | 'operator' | 'manager' | 'admin' | 'system';

export type OpportunityTransitionInput = {
  currentStage: OpportunityStage;
  toStage: OpportunityStage;
  role: OpportunityRole;
  isOwnerOrUnassigned?: boolean;
  probability?: number;
  wonAmount?: number | null;
  lossReason?: OpportunityLossReason | null;
  lossReasonDetail?: string | null;
};

export type OpportunityReopenInput = {
  currentStage: OpportunityStage;
  toStage: OpportunityStage;
  role: OpportunityRole;
  reason?: string | null;
};

export type OpportunityFieldInput = {
  stage: OpportunityStage;
  probability?: number;
  wonAmount?: number | null;
  lossReason?: OpportunityLossReason | null;
  lossReasonDetail?: string | null;
};

export type OpportunityPolicyFailureReason =
  | 'same_stage'
  | 'invalid_transition'
  | 'terminal_stage'
  | 'forbidden_role'
  | 'owner_scope_required'
  | 'system_transition_not_allowed'
  | 'invalid_probability'
  | 'won_amount_required'
  | 'invalid_won_amount'
  | 'loss_reason_required'
  | 'loss_reason_detail_required'
  | 'loss_reason_not_allowed'
  | 'reopen_not_allowed'
  | 'reopen_target_not_allowed'
  | 'reopen_reason_required';

export type OpportunityPolicyResult =
  | {
    ok: true;
    probability: number;
    clearLossFields: boolean;
    clearFollowUp: boolean;
  }
  | { ok: false; reason: OpportunityPolicyFailureReason };

const NORMAL_TRANSITIONS: Record<OpportunityStage, OpportunityStage[]> = {
  uncontacted: ['contacted', 'excluded'],
  contacted: ['replied', 'meeting', 'proposal', 'lost', 'excluded'],
  replied: ['meeting', 'proposal', 'lost', 'excluded'],
  meeting: ['proposal', 'won', 'lost'],
  proposal: ['won', 'lost'],
  won: [],
  lost: [],
  excluded: []
};

const SYSTEM_TRANSITIONS: Record<OpportunityStage, OpportunityStage[]> = {
  uncontacted: ['contacted', 'replied', 'meeting'],
  contacted: ['replied', 'meeting'],
  replied: ['meeting'],
  meeting: [],
  proposal: [],
  won: [],
  lost: [],
  excluded: []
};

const DEFAULT_PROBABILITY: Record<OpportunityStage, number> = {
  uncontacted: 0,
  contacted: 10,
  replied: 25,
  meeting: 50,
  proposal: 75,
  won: 100,
  lost: 0,
  excluded: 0
};

const TERMINAL_STAGES: OpportunityStage[] = ['won', 'lost', 'excluded'];
const REOPEN_TARGETS: OpportunityStage[] = ['uncontacted', 'contacted', 'replied', 'meeting', 'proposal'];

export function evaluateOpportunityTransition(input: OpportunityTransitionInput): OpportunityPolicyResult {
  if (input.currentStage === input.toStage) {
    return { ok: false, reason: 'same_stage' };
  }

  if (isTerminalOpportunityStage(input.currentStage)) {
    return { ok: false, reason: 'terminal_stage' };
  }

  const accessFailure = transitionAccessFailure(input);
  if (accessFailure) {
    return { ok: false, reason: accessFailure };
  }

  const allowedTargets = input.role === 'system'
    ? SYSTEM_TRANSITIONS[input.currentStage]
    : NORMAL_TRANSITIONS[input.currentStage];
  if (!allowedTargets.includes(input.toStage)) {
    return {
      ok: false,
      reason: input.role === 'system' ? 'system_transition_not_allowed' : 'invalid_transition'
    };
  }

  const fields = validateOpportunityFields({
    stage: input.toStage,
    probability: input.probability,
    wonAmount: input.wonAmount,
    lossReason: input.lossReason,
    lossReasonDetail: input.lossReasonDetail
  });
  if (!fields.ok) {
    return fields;
  }

  return {
    ok: true,
    probability: fields.probability,
    clearLossFields: input.toStage !== 'lost',
    clearFollowUp: TERMINAL_STAGES.includes(input.toStage)
  };
}

export function evaluateOpportunityReopen(input: OpportunityReopenInput): OpportunityPolicyResult {
  if (input.currentStage === input.toStage) {
    return { ok: false, reason: 'same_stage' };
  }

  if (!hasText(input.reason)) {
    return { ok: false, reason: 'reopen_reason_required' };
  }

  if (!REOPEN_TARGETS.includes(input.toStage)) {
    return { ok: false, reason: 'reopen_target_not_allowed' };
  }

  if (input.currentStage === 'won') {
    if (input.role !== 'admin') {
      return { ok: false, reason: 'forbidden_role' };
    }
  } else if (!['lost', 'excluded'].includes(input.currentStage)) {
    return { ok: false, reason: 'reopen_not_allowed' };
  } else if (!['manager', 'admin'].includes(input.role)) {
    return { ok: false, reason: 'forbidden_role' };
  }

  return {
    ok: true,
    probability: defaultOpportunityProbability(input.toStage),
    clearLossFields: true,
    clearFollowUp: false
  };
}

export function validateOpportunityFields(input: OpportunityFieldInput): OpportunityPolicyResult {
  const probability = resolveOpportunityProbability(input.stage, input.probability);
  if (probability === null) {
    return { ok: false, reason: 'invalid_probability' };
  }

  if (input.wonAmount !== undefined && input.wonAmount !== null && !isNonNegativeInteger(input.wonAmount)) {
    return { ok: false, reason: 'invalid_won_amount' };
  }

  if (input.stage === 'won' && !isNonNegativeInteger(input.wonAmount)) {
    return { ok: false, reason: 'won_amount_required' };
  }

  if (input.stage !== 'lost' && input.lossReason) {
    return { ok: false, reason: 'loss_reason_not_allowed' };
  }

  if (input.stage === 'lost' && !input.lossReason) {
    return { ok: false, reason: 'loss_reason_required' };
  }

  if (input.lossReason === 'other' && !hasText(input.lossReasonDetail)) {
    return { ok: false, reason: 'loss_reason_detail_required' };
  }

  return {
    ok: true,
    probability,
    clearLossFields: input.stage !== 'lost',
    clearFollowUp: TERMINAL_STAGES.includes(input.stage)
  };
}

export function defaultOpportunityProbability(stage: OpportunityStage): number {
  return DEFAULT_PROBABILITY[stage];
}

export function canEditOpportunityFields(role: OpportunityRole, isOwnerOrUnassigned = false): boolean {
  if (role === 'manager' || role === 'admin') return true;
  return role === 'operator' && isOwnerOrUnassigned;
}

export function isTerminalOpportunityStage(stage: OpportunityStage): boolean {
  return TERMINAL_STAGES.includes(stage);
}

function transitionAccessFailure(input: OpportunityTransitionInput): OpportunityPolicyFailureReason | null {
  if (input.role === 'viewer') return 'forbidden_role';
  if (input.role === 'system') return null;
  if (input.role === 'operator') {
    if (!input.isOwnerOrUnassigned) return 'owner_scope_required';
    if (input.toStage === 'won') return 'forbidden_role';
  }
  return null;
}

function resolveOpportunityProbability(stage: OpportunityStage, probability?: number): number | null {
  if (probability === undefined) return defaultOpportunityProbability(stage);
  if (!Number.isInteger(probability) || probability < 0 || probability > 100) return null;
  return probability;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function hasText(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}
