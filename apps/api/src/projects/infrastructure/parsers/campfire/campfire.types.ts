export type CampfireListingItem = {
  projectUrl: string;
  projectTitle: string;
  supportAmount: string;
  supporters: string;
  daysLeft: string | null;
  category: string;
  publicStatus: string;
  profileProjectCount: string | null;
  summary: string;
};

export type CampfireDetail = {
  projectUrl: string;
  projectId: string;
  projectTitle: string;
  executorName: string;
  brandName: string;
  supportAmount: string;
  supporters: string;
  achievementRate: string;
  daysLeft: string | null;
  publicStatus: string;
  mainDescription: string;
  category: string;
  features: string[];
  profileUrl: string;
  websiteUrl: string;
  inquiryUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
  xUrl: string;
  externalUrls: string[];
};

export type CampfireProfile = {
  executorName: string;
  projectCount: string | null;
};
