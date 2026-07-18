import {
  canEditOpportunityFields,
  defaultOpportunityProbability,
  evaluateOpportunityReopen,
  evaluateOpportunityTransition,
  isTerminalOpportunityStage,
  validateOpportunityFields
} from './opportunity-policy';

describe('opportunity-policy', () => {
  it.each([
    ['uncontacted', 'contacted'],
    ['uncontacted', 'excluded'],
    ['contacted', 'replied'],
    ['contacted', 'meeting'],
    ['contacted', 'proposal'],
    ['contacted', 'lost'],
    ['contacted', 'excluded'],
    ['replied', 'meeting'],
    ['replied', 'proposal'],
    ['replied', 'lost'],
    ['replied', 'excluded'],
    ['meeting', 'proposal'],
    ['meeting', 'won'],
    ['meeting', 'lost'],
    ['proposal', 'won'],
    ['proposal', 'lost']
  ] as const)('allows normal transition %s to %s', (currentStage, toStage) => {
    const result = evaluateOpportunityTransition({
      currentStage,
      toStage,
      role: 'manager',
      wonAmount: toStage === 'won' ? 100000 : undefined,
      lossReason: toStage === 'lost' ? 'timing' : undefined
    });

    expect(result.ok).toBe(true);
  });

  it('rejects same-stage, backward, and terminal-state normal transitions', () => {
    expect(evaluateOpportunityTransition({ currentStage: 'contacted', toStage: 'contacted', role: 'manager' })).toEqual({ ok: false, reason: 'same_stage' });
    expect(evaluateOpportunityTransition({ currentStage: 'proposal', toStage: 'meeting', role: 'manager' })).toEqual({ ok: false, reason: 'invalid_transition' });
    expect(evaluateOpportunityTransition({ currentStage: 'lost', toStage: 'contacted', role: 'manager' })).toEqual({ ok: false, reason: 'terminal_stage' });
  });

  it('requires the appropriate role and assignment scope', () => {
    expect(evaluateOpportunityTransition({ currentStage: 'uncontacted', toStage: 'contacted', role: 'viewer' })).toEqual({ ok: false, reason: 'forbidden_role' });
    expect(evaluateOpportunityTransition({ currentStage: 'uncontacted', toStage: 'contacted', role: 'operator', isOwnerOrUnassigned: false })).toEqual({ ok: false, reason: 'owner_scope_required' });
    expect(evaluateOpportunityTransition({ currentStage: 'meeting', toStage: 'won', role: 'operator', isOwnerOrUnassigned: true, wonAmount: 100000 })).toEqual({ ok: false, reason: 'forbidden_role' });
    expect(evaluateOpportunityTransition({ currentStage: 'meeting', toStage: 'won', role: 'manager', wonAmount: 100000 })).toMatchObject({ ok: true, probability: 100 });
    expect(canEditOpportunityFields('operator', true)).toBe(true);
    expect(canEditOpportunityFields('operator', false)).toBe(false);
    expect(canEditOpportunityFields('manager')).toBe(true);
    expect(canEditOpportunityFields('viewer')).toBe(false);
  });

  it('only lets system events move known email and reply stages forward', () => {
    expect(evaluateOpportunityTransition({ currentStage: 'uncontacted', toStage: 'contacted', role: 'system' })).toMatchObject({ ok: true, probability: 10 });
    expect(evaluateOpportunityTransition({ currentStage: 'contacted', toStage: 'meeting', role: 'system' })).toMatchObject({ ok: true, probability: 50 });
    expect(evaluateOpportunityTransition({ currentStage: 'meeting', toStage: 'proposal', role: 'system' })).toEqual({ ok: false, reason: 'system_transition_not_allowed' });
    expect(evaluateOpportunityTransition({ currentStage: 'contacted', toStage: 'lost', role: 'system', lossReason: 'no_interest' })).toEqual({ ok: false, reason: 'system_transition_not_allowed' });
  });

  it('validates explicit probability values and uses stage defaults', () => {
    expect(defaultOpportunityProbability('uncontacted')).toBe(0);
    expect(defaultOpportunityProbability('contacted')).toBe(10);
    expect(defaultOpportunityProbability('replied')).toBe(25);
    expect(defaultOpportunityProbability('meeting')).toBe(50);
    expect(defaultOpportunityProbability('proposal')).toBe(75);
    expect(defaultOpportunityProbability('won')).toBe(100);
    expect(defaultOpportunityProbability('lost')).toBe(0);
    expect(defaultOpportunityProbability('excluded')).toBe(0);
    expect(validateOpportunityFields({ stage: 'proposal', probability: 60 })).toMatchObject({ ok: true, probability: 60 });
    expect(validateOpportunityFields({ stage: 'proposal', probability: -1 })).toEqual({ ok: false, reason: 'invalid_probability' });
    expect(validateOpportunityFields({ stage: 'proposal', probability: 101 })).toEqual({ ok: false, reason: 'invalid_probability' });
    expect(validateOpportunityFields({ stage: 'proposal', probability: 50.5 })).toEqual({ ok: false, reason: 'invalid_probability' });
  });

  it('requires a valid won amount only when winning', () => {
    expect(validateOpportunityFields({ stage: 'won' })).toEqual({ ok: false, reason: 'won_amount_required' });
    expect(validateOpportunityFields({ stage: 'won', wonAmount: -1 })).toEqual({ ok: false, reason: 'invalid_won_amount' });
    expect(validateOpportunityFields({ stage: 'won', wonAmount: 120000 })).toMatchObject({ ok: true, probability: 100, clearFollowUp: true });
    expect(validateOpportunityFields({ stage: 'proposal', wonAmount: 0 })).toMatchObject({ ok: true, probability: 75 });
  });

  it('requires a loss reason and an other detail only for lost opportunities', () => {
    expect(validateOpportunityFields({ stage: 'lost' })).toEqual({ ok: false, reason: 'loss_reason_required' });
    expect(validateOpportunityFields({ stage: 'lost', lossReason: 'other' })).toEqual({ ok: false, reason: 'loss_reason_detail_required' });
    expect(validateOpportunityFields({ stage: 'lost', lossReason: 'other', lossReasonDetail: 'Scope changed' })).toMatchObject({ ok: true, probability: 0, clearFollowUp: true });
    expect(validateOpportunityFields({ stage: 'contacted', lossReason: 'no_interest' })).toEqual({ ok: false, reason: 'loss_reason_not_allowed' });
  });

  it('reopens lost and excluded opportunities only for managers and admins', () => {
    expect(evaluateOpportunityReopen({ currentStage: 'lost', toStage: 'contacted', role: 'operator', reason: 'New contact' })).toEqual({ ok: false, reason: 'forbidden_role' });
    expect(evaluateOpportunityReopen({ currentStage: 'lost', toStage: 'proposal', role: 'manager', reason: 'Budget approved' })).toEqual({ ok: true, probability: 75, clearLossFields: true, clearFollowUp: false });
    expect(evaluateOpportunityReopen({ currentStage: 'excluded', toStage: 'uncontacted', role: 'admin', reason: 'Duplicate resolved' })).toEqual({ ok: true, probability: 0, clearLossFields: true, clearFollowUp: false });
    expect(evaluateOpportunityReopen({ currentStage: 'won', toStage: 'proposal', role: 'manager', reason: 'Correction' })).toEqual({ ok: false, reason: 'forbidden_role' });
    expect(evaluateOpportunityReopen({ currentStage: 'won', toStage: 'proposal', role: 'admin', reason: 'Correction' })).toEqual({ ok: true, probability: 75, clearLossFields: true, clearFollowUp: false });
  });

  it('requires a reopening reason and an active pipeline target', () => {
    expect(evaluateOpportunityReopen({ currentStage: 'lost', toStage: 'contacted', role: 'manager' })).toEqual({ ok: false, reason: 'reopen_reason_required' });
    expect(evaluateOpportunityReopen({ currentStage: 'lost', toStage: 'lost', role: 'manager', reason: 'Retry' })).toEqual({ ok: false, reason: 'same_stage' });
    expect(evaluateOpportunityReopen({ currentStage: 'lost', toStage: 'won', role: 'manager', reason: 'Retry' })).toEqual({ ok: false, reason: 'reopen_target_not_allowed' });
    expect(evaluateOpportunityReopen({ currentStage: 'meeting', toStage: 'contacted', role: 'admin', reason: 'Retry' })).toEqual({ ok: false, reason: 'reopen_not_allowed' });
  });

  it('marks terminal stages for follow-up cleanup', () => {
    expect(isTerminalOpportunityStage('won')).toBe(true);
    expect(isTerminalOpportunityStage('lost')).toBe(true);
    expect(isTerminalOpportunityStage('excluded')).toBe(true);
    expect(isTerminalOpportunityStage('proposal')).toBe(false);
    expect(evaluateOpportunityTransition({ currentStage: 'proposal', toStage: 'lost', role: 'manager', lossReason: 'timing' })).toMatchObject({ ok: true, clearFollowUp: true });
  });
});
