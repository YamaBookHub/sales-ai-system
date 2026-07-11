import { LeadPriority, LeadStatus } from '@prisma/client';

export const COMPANY_MATERIAL_LINK_LABEL = 'company_material';

export type MaterialEngagement = {
  label: 'none' | 'interested' | 'hot';
  scoreFloor: number;
  priority?: LeadPriority;
  leadStatus?: LeadStatus;
  nextActionInDays?: number;
};

export function materialEngagementForClickCount(clickCount: number): MaterialEngagement {
  if (clickCount >= 3) {
    return {
      label: 'hot',
      scoreFloor: 85,
      priority: 'high',
      leadStatus: 'meeting_candidate',
      nextActionInDays: 1
    };
  }

  if (clickCount >= 1) {
    return {
      label: 'interested',
      scoreFloor: 70,
      priority: 'high',
      leadStatus: 'replied',
      nextActionInDays: 1
    };
  }

  return {
    label: 'none',
    scoreFloor: 0
  };
}

export function nextActionAtForMaterialEngagement(now = new Date(), days = 1) {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}
