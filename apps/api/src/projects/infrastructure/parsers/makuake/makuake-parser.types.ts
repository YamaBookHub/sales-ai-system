export type MakuakeListingItem = {
  title: string;
  url: string;
  summary: string;
  amountText: string | null;
  supporterCountText: string | null;
  daysLeftText: string | null;
  category: string;
  location: string;
  statusText: string;
};

export type MakuakeDetail = {
  title: string;
  url: string;
  executorName: string;
  amountText: string | null;
  supporterCountText: string | null;
  daysLeftText: string | null;
  statusText: string;
  description: string;
  category: string;
  location: string;
  thumbnailUrl: string;
  websiteUrl: string;
  inquiryUrl: string;
  externalUrls: string[];
  memberUrl: string;
};

export type MakuakeProfile = {
  url: string;
  name: string;
  totalAmountText: string | null;
  projectCountText: string | null;
  supporterCountText: string | null;
  description: string;
};
