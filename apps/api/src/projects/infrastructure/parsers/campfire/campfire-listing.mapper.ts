import { CampfireListingItem } from './campfire.types';

export type CampfireListingCandidate = {
  title: string;
  url: string;
  amount: number;
  supporterCount: number;
  category: string;
  daysLeft: number | null;
  isActive: boolean;
  profileProjectCount: number | null;
  summary: string;
};

export function mapCampfireListingItem(item: CampfireListingItem): CampfireListingCandidate {
  const daysLeft = item.daysLeft ? parseInteger(item.daysLeft) : null;
  return {
    title: item.projectTitle.slice(0, 140),
    url: item.projectUrl,
    amount: parseInteger(item.supportAmount),
    supporterCount: parseInteger(item.supporters),
    category: item.category,
    daysLeft,
    isActive: isFundraisingProject(item.publicStatus, daysLeft),
    profileProjectCount: item.profileProjectCount === null ? null : parseInteger(item.profileProjectCount),
    summary: item.summary
  };
}

function isFundraisingProject(publicStatus: string, daysLeft: number | null) {
  if (/(もうすぐ公開|近日公開|公開予定|COMING\s*SOON|終了したもの|終了しました|募集終了|受付終了|終了|SUCCESS|失敗)/i.test(publicStatus)) {
    return false;
  }
  return daysLeft !== null;
}

function parseInteger(value: string) {
  const number = Number((value || '').replace(/[^0-9]/g, ''));
  return Number.isFinite(number) ? number : 0;
}
