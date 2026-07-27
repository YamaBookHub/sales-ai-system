export type GreenFundingListingItem = {
  title: string;
  url: string;
  summary: string;
  amountText: string | null;
  supporterCountText: string | null;
  daysLeftText: string | null;
  statusText: string;
  category: string;
  thumbnailUrl: string;
};

export type GreenFundingDetail = {
  title: string;
  url: string;
  executorName: string;
  amountText: string | null;
  supporterCountText: string | null;
  daysLeftText: string | null;
  statusText: string;
  description: string;
  category: string;
  categories: string[];
  thumbnailUrl: string;
  websiteUrl: string;
  inquiryUrl: string;
  externalUrls: string[];
};
