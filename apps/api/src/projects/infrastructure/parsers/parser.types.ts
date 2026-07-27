export type ProjectSourceType = 'campfire' | 'makuake' | 'green_funding';

export type ProjectPageKind = 'listing' | 'detail' | 'profile';

export type RawProjectPageSnapshot = {
  source: ProjectSourceType;
  kind: ProjectPageKind;
  url: string;
  html: string;
  visibleText?: string;
};

export type ProjectParserResult<T> = {
  value: T;
  fallbacksUsed: string[];
};
